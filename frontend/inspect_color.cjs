const sharp = require('sharp');

async function main() {
  const adminPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780815151881.png';
  const { data, info } = await sharp(adminPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = 9999, maxX = -1, minY = 9999, maxY = -1;
  let textPixelsCount = 0;

  for (let y = 260; y <= 350; y++) {
    for (let x = 40; x <= 500; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Scan for light blue / white text pixels
      if (r > 80 && g > 120 && b > 150) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        textPixelsCount++;
      }
    }
  }

  console.log(`Lighter text pixels found: ${textPixelsCount}`);
  console.log(`Bounding Box for 'Trinity Central School Overview' text:`);
  console.log(`x: ${minX} to ${maxX} (width: ${maxX - minX + 1})`);
  console.log(`y: ${minY} to ${maxY} (height: ${maxY - minY + 1})`);
}

main().catch(console.error);
