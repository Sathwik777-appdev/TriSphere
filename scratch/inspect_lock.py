from PIL import Image

img = Image.open("/Users/sathwikjpoojary/Documents/TriSphere/frontend/public/photorealistic-lock.png")
print("Image size:", img.size)
print("Image mode:", img.mode)

# Let's inspect some pixels at the corners and edges
print("Top-left pixel:", img.getpixel((0, 0)))
print("Top-right pixel:", img.getpixel((img.size[0] - 1, 0)))
print("Bottom-left pixel:", img.getpixel((0, img.size[1] - 1)))
print("Bottom-right pixel:", img.getpixel((img.size[0] - 1, img.size[1] - 1)))
print("Center pixel:", img.getpixel((img.size[0] // 2, img.size[1] // 2)))
