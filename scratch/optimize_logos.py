"""
Resize + recompress the logo PNGs so they load fast. The displayed sizes
are at most ~260px (loader) and ~120px (headers); shipping a 1254x877 image
is just wasted bytes. Target 800px wide with PNG optimize=True.
"""
from PIL import Image
import os

TARGET_WIDTH = 800

for name in ("logo.png", "logo-mark.png"):
    path = os.path.join("frontend", "public", name)
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    if w <= TARGET_WIDTH:
        print(f"{name}: already {w}x{h}, skipping")
        continue
    new_h = int(h * TARGET_WIDTH / w)
    resized = img.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
    resized.save(path, "PNG", optimize=True)
    new_size = os.path.getsize(path)
    print(f"{name}: {w}x{h} -> {TARGET_WIDTH}x{new_h}, {new_size / 1024:.0f} KB")
