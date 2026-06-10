const sharp = require('sharp');

async function main() {
  const teacherPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780816079793.png';
  const { data, info } = await sharp(teacherPath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`Teacher Image size: ${info.width}x${info.height}`);

  // We want to find the position of "Chemistry • Trinity Central School"
  // Let's sample colors in a region where this text is likely to be (y = 60 to 130, x = 150 to 500)
  // Let's print out rows where light pixels exist.
  let minX = 9999, maxX = -1, minY = 9999, maxY = -1;
  let lightCount = 0;

  for (let y = 60; y <= 130; y++) {
    for (let x = 150; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Scan for the greyish-blue text pixels of "Chemistry • Trinity Central School"
      if (r > 130 && g > 140 && b > 150) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        lightCount++;
      }
    }
  }

  console.log(`Light pixels found: ${lightCount}`);
  console.log(`Bounding box of subtitle text: x: ${minX} to ${maxX}, y: ${minY} to ${maxY}`);

  // Let's also check the most common background color in this area
  const colorMap = {};
  for (let y = 70; y <= 110; y++) {
    for (let x = 180; x <= 450; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const rgb = `${r},${g},${b}`;
      colorMap[rgb] = (colorMap[rgb] || 0) + 1;
    }
  }

  const sortedColors = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
  console.log('Top colors in the subtitle area:');
  sortedColors.slice(0, 5).forEach(([rgb, count]) => {
    console.log(`RGB(${rgb}): ${count} pixels`);
  });
}

main().catch(console.error);
