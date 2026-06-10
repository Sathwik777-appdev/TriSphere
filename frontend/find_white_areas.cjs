const sharp = require('sharp');

async function main() {
  const imagePath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/trisphere_light_template_1780816411667.png';
  const { data, info } = await sharp(imagePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`Image info: ${info.width}x${info.height}`);

  const grid = [];
  for (let y = 0; y < info.height; y++) {
    const row = [];
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      
      // Check if it's very close to white
      if (r > 252 && g > 252 && b > 252) {
        row.push(1);
      } else {
        row.push(0);
      }
    }
    grid.push(row);
  }

  const visited = Array(info.height).fill(null).map(() => Array(info.width).fill(false));
  const regions = [];

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (grid[y][x] === 1 && !visited[y][x]) {
        let minX = x, maxX = x, minY = y, maxY = y;
        const queue = [[x, y]];
        visited[y][x] = true;
        let count = 0;

        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          count++;
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

          const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1]
          ];

          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < info.width && ny >= 0 && ny < info.height) {
              if (grid[ny][nx] === 1 && !visited[ny][nx]) {
                visited[ny][nx] = true;
                queue.push([nx, ny]);
              }
            }
          }
        }

        if (count > 500) {
          regions.push({ minX, maxX, minY, maxY, count });
        }
      }
    }
  }

  console.log('Detected white regions (screens):');
  regions.forEach((r, idx) => {
    console.log(`Region ${idx + 1}: Bounding Box: [x: ${r.minX} to ${r.maxX}, y: ${r.minY} to ${r.maxY}] (width: ${r.maxX - r.minX + 1}, height: ${r.maxY - r.minY + 1}), pixels: ${r.count}`);
  });
}

main().catch(console.error);
