const sharp = require('sharp');

async function main() {
  const adminPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780815151881.png';
  const { data, info } = await sharp(adminPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Scan top-left region: y=0 to 100, x=40 to 400
  let minX = 9999, maxX = -1, minY = 9999, maxY = -1;
  let lightCount = 0;

  for (let y = 30; y <= 75; y++) {
    for (let x = 60; x <= 300; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Scan for greyish text
      if (r > 100 && g > 110 && b > 120) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        lightCount++;
      }
    }
  }

  console.log(`Top-left light pixels found: ${lightCount}`);
  console.log(`Bounding box: x: ${minX} to ${maxX}, y: ${minY} to ${maxY}`);
}

main().catch(console.error);
