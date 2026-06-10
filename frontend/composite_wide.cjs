const sharp = require('sharp');

async function main() {
  const templatePath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/trisphere_wide_template_1780817408958.png';
  const logoPath = '/Users/sathwikjpoojary/Documents/TriSphere/frontend/public/logo.png';
  const adminPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780815151881.png';
  const studentPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780816070400.png';
  const teacherPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780816079793.png';

  console.log('1. Cleaning Admin screenshot...');
  // Cover "TRINITY CENTRAL SCHOOL" in top left and "Trinity Central School Overview" in the center.
  const adminOverlaySvg = `
    <svg width="940" height="559" viewBox="0 0 940 559" xmlns="http://www.w3.org/2000/svg">
      <!-- Cover school name at top left -->
      <rect x="60" y="52" width="240" height="23" fill="#080c18" />
      <!-- Cover old center text -->
      <rect x="90" y="285" width="340" height="35" fill="#080c18" />
      <!-- Render new clean text -->
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

  console.log('2. Cleaning Teacher screenshot...');
  // Cover "Chemistry • Trinity Central School" and replace with "Chemistry"
  const teacherOverlaySvg = `
    <svg width="532" height="1024" viewBox="0 0 532 1024" xmlns="http://www.w3.org/2000/svg">
      <!-- Cover subtitle line -->
      <rect x="180" y="78" width="330" height="27" fill="#0b1327" />
      <!-- Render new subtitle -->
      <text x="184" y="99" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="19" fill="#94a3b8">Chemistry</text>
    </svg>
  `;

  const modifiedTeacher = await sharp(teacherPath)
    .composite([{
      input: Buffer.from(teacherOverlaySvg),
      top: 0,
      left: 0
    }])
    .toBuffer();

  console.log('3. Resizing mockups...');
  // Bounding boxes on the wide template:
  // Laptop: [x: 142 to 451, y: 631 to 836] (width: 310, height: 206)
  const resizedAdmin = await sharp(modifiedAdmin)
    .resize(310, 206, { fit: 'fill' })
    .toBuffer();

  // Student Phone (Left): [x: 502 to 574, y: 704 to 861] (width: 73, height: 158)
  const resizedStudent = await sharp(studentPath)
    .resize(73, 158, { fit: 'fill' })
    .toBuffer();

  // Teacher Phone (Right): [x: 601 to 672, y: 704 to 861] (width: 72, height: 158)
  const resizedTeacher = await sharp(modifiedTeacher)
    .resize(72, 158, { fit: 'fill' })
    .toBuffer();

  // Logo: [x: 390 to 633, y: 47 to 129] (width: 244, height: 83)
  const logoWidth = 244;
  const logoHeight = Math.round((logoWidth * 639) / 800); // ~195px, wait! 
  // Let's resize logo to fit inside 244 width and 83 height
  const resizedLogo = await sharp(logoPath)
    .resize({
      width: 244,
      height: 83,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toBuffer();

  // 4. Composite onto template
  console.log('4. Compositing template banner...');
  const compedTemplate = await sharp(templatePath)
    .composite([
      // Paste logo
      {
        input: resizedLogo,
        left: 390,
        top: 47
      },
      // Place mockups
      {
        input: resizedAdmin,
        left: 142,
        top: 631
      },
      {
        input: resizedStudent,
        left: 502,
        top: 704
      },
      {
        input: resizedTeacher,
        left: 601,
        top: 704
      }
    ])
    .toBuffer();

  // 5. Crop the banner from y=30 to y=1010 (height 980) to trim empty border space
  console.log('5. Trimming layout...');
  const trimmedBanner = await sharp(compedTemplate)
    .extract({ left: 0, top: 30, width: 1024, height: 970 })
    .toBuffer();

  // 6. Create a new wide canvas of 1724x970 (exactly 16:9 ratio!) and paste the banner in the center
  console.log('6. Creating final wide 16:9 banner...');
  const finalWidth = 1724;
  const finalHeight = 970;
  const leftOffset = Math.round((finalWidth - 1024) / 2); // 350px

  const outputPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/trisphere_wide_perfect_banner.png';

  await sharp({
    create: {
      width: finalWidth,
      height: finalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{
      input: trimmedBanner,
      left: leftOffset,
      top: 0
    }])
    .toFile(outputPath);

  console.log(`Success! Wide Banner generated at: ${outputPath}`);
}

main().catch(console.error);
