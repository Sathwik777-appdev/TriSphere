const sharp = require('sharp');

async function main() {
  const templatePath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/trisphere_light_template_1780816411667.png';
  const logoPath = '/Users/sathwikjpoojary/Documents/TriSphere/frontend/public/logo.png';
  const adminPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780815151881.png';
  const studentPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780816070400.png';
  const teacherPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780816079793.png';

  // 1. Process the Admin screenshot to cover the old text and add "School Overview"
  const adminOverlaySvg = `
    <svg width="940" height="559" viewBox="0 0 940 559" xmlns="http://www.w3.org/2000/svg">
      <rect x="90" y="285" width="340" height="35" fill="#080c18" />
      <text x="90" y="310" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="21" font-weight="600" fill="#ffffff">School Overview</text>
    </svg>
  `;

  const modifiedAdmin = await sharp(adminPath)
    .composite([{
      input: Buffer.from(adminOverlaySvg),
      top: 0,
      left: 0
    }])
    .toBuffer();

  // 2. Resize mockups
  const resizedAdmin = await sharp(modifiedAdmin)
    .resize(436, 275, { fit: 'fill' })
    .toBuffer();

  const resizedStudent = await sharp(studentPath)
    .resize(99, 204, { fit: 'fill' })
    .toBuffer();

  const resizedTeacher = await sharp(teacherPath)
    .resize(101, 204, { fit: 'fill' })
    .toBuffer();

  // 3. Prepare your exact logo. Since the logo is 800x639, let's scale it down to a clean width, e.g. 180px width (height 144px).
  // We want to overlay it at the top center.
  // First, we'll cover the old AI-generated logo area with a solid white block to erase it.
  const logoWidth = 150;
  const logoHeight = Math.round((logoWidth * 639) / 800); // 120px

  const resizedLogo = await sharp(logoPath)
    .resize(logoWidth, logoHeight)
    .toBuffer();

  // Erase SVG covering old logo area (approx x=350 to x=674, y=40 to y=135)
  const eraseSvg = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <!-- Cover old logo with background white color -->
      <rect x="300" y="30" width="424" height="110" fill="#ffffff" />
    </svg>
  `;

  // 4. Composite everything
  const outputPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/trisphere_perfect_composite_banner.png';
  
  await sharp(templatePath)
    .composite([
      // Erase the old logo
      {
        input: Buffer.from(eraseSvg),
        left: 0,
        top: 0
      },
      // Draw your exact logo centered at top (x = (1024 - 150) / 2 = 437)
      {
        input: resizedLogo,
        left: 437,
        top: 40
      },
      // Place mockups
      {
        input: resizedAdmin,
        left: 151,
        top: 559
      },
      {
        input: resizedStudent,
        left: 692,
        top: 668
      },
      {
        input: resizedTeacher,
        left: 833,
        top: 668
      }
    ])
    .toFile(outputPath);

  console.log(`Success! Banner generated at: ${outputPath}`);
}

main().catch(console.error);
