const sharp = require('sharp');

async function main() {
  const adminPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780815151881.png';
  const studentPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780816070400.png';
  const teacherPath = '/Users/sathwikjpoojary/.gemini/antigravity/brain/0c4da15b-81b6-4628-9afe-faca0bc61c08/media__1780816079793.png';

  const adminMeta = await sharp(adminPath).metadata();
  const studentMeta = await sharp(studentPath).metadata();
  const teacherMeta = await sharp(teacherPath).metadata();

  console.log(`Admin image size: ${adminMeta.width}x${adminMeta.height}`);
  console.log(`Student image size: ${studentMeta.width}x${studentMeta.height}`);
  console.log(`Teacher image size: ${teacherMeta.width}x${teacherMeta.height}`);
}

main().catch(console.error);
