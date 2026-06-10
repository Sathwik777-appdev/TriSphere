"""
Remove the dark background from logo.png in-place, producing a transparent PNG.

Strategy: each pixel's "darkness" is computed as 255 - max(r,g,b). Pixels that
are nearly black become fully transparent; pixels that are mid-dark get
proportionally faded; bright logo pixels stay opaque. This is a simple
threshold-with-feather approach — good enough for a logo on a near-black
gradient background, no AI model needed.

Also crops away the bottom portion of the source image (the photographic
reflection baked into the original render) before processing — that reflection
shares brightness with the real logo so threshold alone can't strip it.
"""
from PIL import Image
import sys

src = sys.argv[1] if len(sys.argv) > 1 else "frontend/public/logo.png"
dst = sys.argv[2] if len(sys.argv) > 2 else src

img = Image.open(src).convert("RGBA")
w, h = img.size

# Crop the lower CROP_BOTTOM fraction — that's where the reflection lives in
# the original studio render. Tuned by eye on this specific logo. 30% was
# too aggressive (chopped the wordmark descenders); 20% removes only the
# reflection band below the wordmark baseline.
CROP_BOTTOM = 0.20
img = img.crop((0, 0, w, int(h * (1 - CROP_BOTTOM))))
w, h = img.size
pixels = img.load()

# Tuneable thresholds (0..255). Pixels with brightness <= LOW are fully
# transparent; >= HIGH are fully opaque; in between linearly faded.
# Tuned to a HARD cut (95/130) — leaves zero residual background. The
# narrow 35-step feather window keeps edge anti-aliasing clean without
# letting the dark gradient bleed through.
LOW = 95
HIGH = 130

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        brightness = max(r, g, b)
        if brightness <= LOW:
            new_a = 0
        elif brightness >= HIGH:
            new_a = a
        else:
            # Linear feather between LOW and HIGH.
            new_a = int(((brightness - LOW) / (HIGH - LOW)) * a)
        pixels[x, y] = (r, g, b, new_a)

img.save(dst, "PNG")
print(f"Wrote transparent PNG to {dst} ({w}x{h})")
