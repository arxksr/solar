const fs = require('fs');
const GeoTIFF = require('geotiff');

async function check() {
  const buffer = fs.readFileSync('../../public/GSA_Iraq_Monthly_PVOUT.tif');
  const tiff = await GeoTIFF.fromArrayBuffer(buffer.buffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  
  console.log("Number of bands:", rasters.length);
  
  for (let i = 0; i < rasters.length; i++) {
    const data = rasters[i];
    let sum = 0;
    let count = 0;
    for (let j = 0; j < data.length; j+=100) {
      if (data[j] > 0 && data[j] < 99999) {
        sum += data[j];
        count++;
      }
    }
    console.log(`Band ${i} average:`, count > 0 ? sum / count : 'No data');
  }
}

check().catch(console.error);
