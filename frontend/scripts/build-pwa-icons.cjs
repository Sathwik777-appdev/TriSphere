/**
 * build-pwa-icons.js
 * ───────────────────────────────────────────────────────────────────
 * One-shot script that generates the three PWA icons PWABuilder needs
 * (192, 512, 512-maskable) from `public/logo-mark.png` — the
 * transparent-background emblem with no wordmark.
 *
 * Why these specific files:
 *   • icon-192.png         — required by Web App Manifest spec.
 *                            Used by Chrome on install + various
 *                            launcher fallbacks.
 *   • icon-512.png         — required for the Play Store listing and
 *                            high-DPI launcher icons.
 *   • icon-maskable-512.png — Android's adaptive icon system crops the
 *                            outer ~20% (the "safe zone"). This image
 *                            puts the emblem inside the safe inner
 *                            ~80% so it survives the crop, with the
 *                            outer band filled in the TriSphere brand
 *                            navy (#070b1a) so it never reads as a
 *                            transparent block.
 *
 * Run:  node scripts/build-pwa-icons.js   (from frontend/)
 *
 * Sharp is loaded dynamically (try/catch + install hint) so this
 * script also works in a fresh clone where sharp isn't installed yet.
 */

const path = require('path');
const fs = require('fs');

let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.error(
        '\nMissing dependency: sharp\n\n' +
            'Install it (no-save is fine — only used by this build step):\n' +
            '  npm install --no-save sharp\n'
    );
    process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'logo-mark.png');
const OUT_DIR = path.join(ROOT, 'public', 'icons');

if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Brand background used to fill the maskable icon's bleed area. Has to
// be opaque so the adaptive-icon mask never reveals a transparent edge.
const BRAND_BG = { r: 0x07, g: 0x0b, b: 0x1a, alpha: 1 };

async function buildSquareIcon(sizePx, outFile) {
    // Resize so the longer edge equals `sizePx`, then center on a square
    // canvas of size `sizePx × sizePx`. Transparent background — the
    // emblem in logo-mark.png already has a transparent edge so this
    // produces a clean icon that adapters can recolor if they want.
    await sharp(SRC)
        .resize(sizePx, sizePx, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outFile);
    console.log('  ✔', path.relative(ROOT, outFile));
}

async function buildMaskableIcon(sizePx, outFile) {
    // Android adaptive icons crop the outer ~20% (circle / squircle /
    // rounded square). To survive ALL mask shapes the emblem has to
    // live inside the inner 80% safe area. We render it inside a
    // ~62% inner box (a bit tighter than the bare minimum) so even the
    // most aggressive circle mask doesn't clip our ribbons.
    const inner = Math.round(sizePx * 0.62);
    const offset = Math.round((sizePx - inner) / 2);

    const resizedEmblem = await sharp(SRC)
        .resize(inner, inner, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

    await sharp({
        create: {
            width: sizePx,
            height: sizePx,
            channels: 4,
            background: BRAND_BG,
        },
    })
        .composite([{ input: resizedEmblem, top: offset, left: offset }])
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outFile);
    console.log('  ✔', path.relative(ROOT, outFile));
}

(async () => {
    console.log('Building PWA icons from', path.relative(ROOT, SRC));
    await buildSquareIcon(192, path.join(OUT_DIR, 'icon-192.png'));
    await buildSquareIcon(512, path.join(OUT_DIR, 'icon-512.png'));
    await buildMaskableIcon(512, path.join(OUT_DIR, 'icon-maskable-512.png'));
    // An Apple touch icon while we're here — Safari iOS reads this
    // separately from the manifest. Same emblem on the brand navy
    // background so it doesn't look transparent on the iOS home screen.
    await buildMaskableIcon(180, path.join(OUT_DIR, 'icon-apple-180.png'));
    console.log('\nDone. Output in', path.relative(ROOT, OUT_DIR));
})().catch((err) => {
    console.error('Icon build failed:', err);
    process.exit(1);
});
