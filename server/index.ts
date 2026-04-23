import express from 'express';
import { fromFile } from 'geotiff';
import { createCanvas } from 'canvas';

const app = express();

let tiffData: { bbox: number[]; width: number; height: number; data: any; isFlipped: boolean } | null = null;

const IRAQ_BOUNDS = {
  minLon: 42.0,
  maxLon: 46.5,
  minLat: 34.0,
  maxLat: 37.5
};

async function loadTiff() {
  try {
    const tiff = await fromFile('./public/slope/Iraq_Slope_100m_EPSG4326.tif');
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();
    const rasters = await image.readRasters();
    const width = image.getWidth();
    const height = image.getHeight();
    const resolution = image.getResolution();
    const isFlipped = resolution[1] > 0;
    tiffData = { bbox, width, height, data: rasters[0], isFlipped };
    console.log(`Loaded TIF: ${width}x${height}, bbox: ${bbox}, isFlipped: ${isFlipped}`);
  } catch (e) {
    console.error('Failed to load TIF:', e);
  }
}

loadTiff();

const COLORS = [
  [255, 255, 191, 178],
  [253, 174, 97, 204],
  [244, 109, 67, 230],
  [215, 48, 39, 230],
  [165, 0, 38, 242]
];
const MIN_VAL = 5;
const MAX_VAL = 45;

function getColor(val: number): number[] {
  if (val <= MIN_VAL) return COLORS[0];
  if (val >= MAX_VAL) return COLORS[COLORS.length - 1];
  const t = (val - MIN_VAL) / (MAX_VAL - MIN_VAL);
  const scaledT = t * (COLORS.length - 1);
  const idx = Math.floor(scaledT);
  const frac = scaledT - idx;
  const c1 = COLORS[idx];
  const c2 = COLORS[idx + 1];
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * frac),
    Math.round(c1[1] + (c2[1] - c1[1]) * frac),
    Math.round(c1[2] + (c2[2] - c1[2]) * frac),
    Math.round(c1[3] + (c2[3] - c1[3]) * frac)
  ];
}

app.get('/slope/tiles/:z/:x/:y.png', (req, res) => {
  if (!tiffData) {
    return res.status(503).send('TIF not loaded');
  }

  const z = parseInt(req.params.z);
  const x = parseInt(req.params.x);
  const y = parseInt(req.params.y);

  const { bbox, width, height, data } = tiffData;

  const minLon = bbox[0];
  const maxLat = bbox[3];
  const lonRange = bbox[2] - bbox[0];
  const latRange = bbox[3] - bbox[1];

  const worldWidth = lonRange;
  const worldHeight = latRange;

  const tileSize = 256;
  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(tileSize, tileSize);

  const tilesAtZoom = Math.pow(2, z);
  const tileLonSize = worldWidth / tilesAtZoom;
  const tileLatSize = worldHeight / tilesAtZoom;

  const tileMinLon = minLon + x * tileLonSize;
  const tileMaxLat = maxLat - y * tileLatSize;

  const pxPerWorldPx = width / worldWidth;
  const pyPerWorldPx = height / worldHeight;

  for (let py = 0; py < tileSize; py++) {
    for (let px = 0; px < tileSize; px++) {
      const pixelLon = tileMinLon + (px / tileSize) * tileLonSize;
      const pixelLat = tileMaxLat - (py / tileSize) * tileLatSize;

      if (pixelLon < IRAQ_BOUNDS.minLon || pixelLon > IRAQ_BOUNDS.maxLon ||
          pixelLat < IRAQ_BOUNDS.minLat || pixelLat > IRAQ_BOUNDS.maxLat) {
        imageData.data[(py * tileSize + px) * 4 + 3] = 0;
        continue;
      }

      const px2 = Math.floor((pixelLon - minLon) * pxPerWorldPx);
      const py2 = Math.floor((maxLat - pixelLat) * pyPerWorldPx);

      if (px2 >= 0 && px2 < width && py2 >= 0 && py2 < height) {
        const idx = py2 * width + px2;
        const val = data[idx];

        if (val <= 0 || val > 9999 || isNaN(val) || val < MIN_VAL || val > MAX_VAL) {
          imageData.data[(py * tileSize + px) * 4 + 3] = 0;
        } else {
          const color = getColor(val);
          imageData.data[(py * tileSize + px) * 4] = color[0];
          imageData.data[(py * tileSize + px) * 4 + 1] = color[1];
          imageData.data[(py * tileSize + px) * 4 + 2] = color[2];
          imageData.data[(py * tileSize + px) * 4 + 3] = color[3];
        }
      } else {
        imageData.data[(py * tileSize + px) * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  let finalCanvas = canvas;
  if (tiffData.isFlipped) {
    const flippedCanvas = createCanvas(tileSize, tileSize);
    const flippedCtx = flippedCanvas.getContext('2d');
    flippedCtx.scale(1, -1);
    flippedCtx.translate(0, tileSize);
    flippedCtx.drawImage(canvas, 0, 0);
    finalCanvas = flippedCanvas;
  }
  
  res.set('Content-Type', 'image/png');
  finalCanvas.createPNGStream().pipe(res);
});

app.listen(3001, () => {
  console.log('Tile server running on http://localhost:3001');
});

app.get('/slope/point', (req, res) => {
  if (!tiffData) {
    return res.status(503).json({ error: 'TIF not loaded' });
  }

  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Invalid lat/lng' });
  }

  const { bbox, width, height, data } = tiffData;

  if (lng < bbox[0] || lng > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
    return res.status(400).json({ error: 'Coordinates out of bounds' });
  }

  const px = Math.floor((lng - bbox[0]) / (bbox[2] - bbox[0]) * width);
  const py = Math.floor((bbox[3] - lat) / (bbox[3] - bbox[1]) * height);

  if (px >= 0 && px < width && py >= 0 && py < height) {
    const idx = py * width + px;
    const val = data[idx];
    res.json({ value: val > 0 && val < 9999 ? val : null });
  } else {
    res.json({ value: null });
  }
});