from PIL import Image

img = Image.open("/Users/sathwikjpoojary/Documents/TriSphere/frontend/public/photorealistic-lock.png")
print("Image size:", img.size)
print("Image mode:", img.mode)

# Let's inspect some pixels at the corners and edges
print("Top-left pixel (RGBA):", img.getpixel((0, 0)))
print("Top-right pixel (RGBA):", img.getpixel((img.size[0] - 1, 0)))
print("Bottom-left pixel (RGBA):", img.getpixel((0, img.size[1] - 1)))
print("Bottom-right pixel (RGBA):", img.getpixel((img.size[0] - 1, img.size[1] - 1)))
print("Center pixel (RGBA):", img.getpixel((img.size[0] // 2, img.size[1] // 2)))

# Count transparent vs opaque pixels
opaque_count = 0
transparent_count = 0
semi_transparent_count = 0

for x in range(img.size[0]):
    for y in range(img.size[1]):
        r, g, b, a = img.getpixel((x, y))
        if a == 0:
            transparent_count += 1
        elif a == 255:
            opaque_count += 1
        else:
            semi_transparent_count += 1

print(f"Transparent pixels: {transparent_count}")
print(f"Opaque pixels: {opaque_count}")
print(f"Semi-transparent pixels: {semi_transparent_count}")
