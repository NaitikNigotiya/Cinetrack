import os
from PIL import Image, ImageDraw, ImageFont

def generate_icon(size, filename, maskable=False):
    # Create image
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Red circle color
    red_color = (229, 9, 20, 255) # E50914

    if maskable:
        # Maskable: solid red background
        draw.rectangle([0, 0, size, size], fill=red_color)
        # We draw a white circle centered inside the safe area
        margin = int(size * 0.1)
        draw.ellipse([margin, margin, size - margin, size - margin], fill=(255, 255, 255, 30))
    else:
        # Regular: red circle in transparent box
        margin = int(size * 0.05)
        draw.ellipse([margin, margin, size - margin, size - margin], fill=red_color)

    # Font sizing
    font_size = int(size * 0.5)
    
    # Try using default font or system fonts
    font = None
    try:
        # Try standard sans-serif system fonts
        font_paths = [
            "arial.ttf", "Helvetica.ttf", "LiberationSans-Regular.ttf", 
            "C:\\Windows\\Fonts\\arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        ]
        for path in font_paths:
            if os.path.exists(path) or not path.startswith("C:") and not path.startswith("/"):
                try:
                    font = ImageFont.truetype(path, font_size)
                    break
                except:
                    continue
    except Exception as e:
        print("Font load warning:", e)
        
    if not font:
        font = ImageFont.load_default()

    # Draw the character "C" in center
    text = "C"
    
    # Get text size
    if hasattr(draw, 'textbbox'):
        # Pillow 9+
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
    else:
        # Older Pillow
        w, h = draw.textsize(text, font=font)
        
    x = (size - w) / 2
    y = (size - h) / 2 - (font_size * 0.1) # shift up slightly to visually balance

    text_color = (255, 255, 255, 255) if not maskable else (255, 255, 255, 255)
    draw.text((x, y), text, fill=text_color, font=font)

    # Save to disk
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    img.save(filename, 'PNG')
    print(f"Generated {filename}")

if __name__ == "__main__":
    generate_icon(192, "public/icons/icon-192.png")
    generate_icon(512, "public/icons/icon-512.png")
    generate_icon(512, "public/icons/icon-maskable-512.png", maskable=True)
