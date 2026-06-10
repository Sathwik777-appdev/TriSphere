import sys
from PIL import Image, ImageFilter

def main():
    img_path = "/Users/sathwikjpoojary/Documents/TriSphere/frontend/public/photorealistic-lock.png"
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    
    # We will do a BFS/Flood Fill from the four corners to find the background.
    # We define a pixel as background-candidate if max(R, G, B) < threshold.
    # Since the background is very dark, let's start with a threshold of 45.
    threshold = 45
    
    # Visited/background mask
    background_mask = [[False for _ in range(height)] for _ in range(width)]
    
    # Queue for BFS
    queue = []
    
    # Initialize queue with corners
    corners = [
        (0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)
    ]
    
    for cx, cy in corners:
        r, g, b, a = img.getpixel((cx, cy))
        if max(r, g, b) < threshold:
            queue.append((cx, cy))
            background_mask[cx][cy] = True
            
    # Directions for 4-connectivity or 8-connectivity
    dx = [0, 0, 1, -1, 1, 1, -1, -1]
    dy = [1, -1, 0, 0, 1, -1, 1, -1]
    
    print("Starting BFS to find connected background...")
    
    while queue:
        x, y = queue.pop(0)
        
        # Check neighbors
        for i in range(8):
            nx, ny = x + dx[i], y + dy[i]
            if 0 <= nx < width and 0 <= ny < height:
                if not background_mask[nx][ny]:
                    r, g, b, a = img.getpixel((nx, ny))
                    # If neighbor is dark enough, it's part of the background
                    if max(r, g, b) < threshold:
                        background_mask[nx][ny] = True
                        queue.append((nx, ny))
                        
    # Now create the output image
    # To avoid hard jagged edges, we can do a soft transition:
    # Any pixel in the background mask gets alpha = 0.
    # Any pixel that is NOT in the background mask but has max(r,g,b) < 80 and is near a background pixel,
    # can get an intermediate alpha.
    # Let's do this: for every background pixel, set its alpha to 0.
    # For pixels not in the mask, if they are very dark, they might be part of the outer glow.
    # We can calculate alpha as a function of brightness or distance.
    # Let's write the simple version first, and then apply a small blur to the alpha channel only.
    
    pixels = img.load()
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            if background_mask[x][y]:
                # Background pixel is transparent
                pixels[x, y] = (r, g, b, 0)
            else:
                # If a pixel is extremely dark but wasn't visited (maybe inside or isolated),
                # let's still give it some transparency if it's below a threshold.
                # Actually, to prevent isolated black spots inside the lock from being fully transparent,
                # we keep them mostly opaque. But if max(r,g,b) is very small, we can lower its alpha slightly
                # so it blends nicely.
                # Let's check if it's near the boundary.
                # A simple way to soften the edges is to blur the alpha channel.
                pass
                
    # Soften the alpha mask using ImageFilter
    # Extract alpha channel
    r, g, b, alpha = img.split()
    # Apply a light blur to the alpha channel to smooth out the edges
    alpha_blurred = alpha.filter(ImageFilter.GaussianBlur(radius=1.5))
    
    # Merge channels back
    result_img = Image.merge("RGBA", (r, g, b, alpha_blurred))
    
    # Save the result
    out_path = "/Users/sathwikjpoojary/Documents/TriSphere/frontend/public/photorealistic-lock.png"
    result_img.save(out_path, "PNG")
    print("Processed image saved to", out_path)

if __name__ == "__main__":
    main()
