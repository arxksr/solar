import * as GeoTIFF from 'geotiff';
import * as fs from 'fs';

async function check() {
  const buffer = fs.readFileSync('./public/GSA_Iraq_Monthly_PVOUT.tif');
  const tiff = await GeoTIFF.fromArrayBuffer(buffer.buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  
  console.log("Number of bands:", rasters.length);
  
  // Calculate a rough average for each band to see the seasonal curve
  let globalMin = Infinity;
  let globalMax = -Infinity;
  
  for (let i = 0; i < rasters.length; i++) {
    const data = rasters[i] as Float32Array;
    let sum = 0;
    let count = 0;
    for (let j = 0; j < data.length; j++) {
      if (data[j] > 0 && data[j] < 99999) {
        if (data[j] < globalMin) globalMin = data[j];
        if (data[j] > globalMax) globalMax = data[j];
        sum += data[j];
        count++;
      }
    }
    console.log(`Band ${i} average:`, count > 0 ? sum / count : 'No data');
  }
  console.log(`Global Min: ${globalMin}, Global Max: ${globalMax}`);
}

check().catch(console.error);
