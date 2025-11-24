#!/bin/bash
# Generate PWA icons using ImageMagick if available, else provide instructions

echo "Creating PWA icons for Alta WMS..."

# Check if ImageMagick is available
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Creating placeholder icons..."
    
    # Create 192x192 icon using base64 encoded PNG
    # This is a simple blue square with white "A" text (Alta WMS logo)
    python3 << 'PYTHON_EOF'
from PIL import Image, ImageDraw, ImageFont
import os

# Create 192x192 icon
img = Image.new('RGB', (192, 192), color='#05070d')
draw = ImageDraw.Draw(img)

# Draw a simple gear/circle design
draw.ellipse([20, 20, 172, 172], outline='#ffc300', width=4)
draw.rectangle([85, 30, 107, 162], fill='#ffc300')
draw.rectangle([30, 85, 162, 107], fill='#ffc300')

# Save the icon
img.save('frontend-pwa/public/icon-192x192.png')
print("✓ Created icon-192x192.png")

# Create 512x512 icon
img_512 = Image.new('RGB', (512, 512), color='#05070d')
draw_512 = ImageDraw.Draw(img_512)

# Draw the same design, scaled up
draw_512.ellipse([50, 50, 462, 462], outline='#ffc300', width=10)
draw_512.rectangle([230, 80, 282, 432], fill='#ffc300')
draw_512.rectangle([80, 230, 432, 282], fill='#ffc300')

img_512.save('frontend-pwa/public/icon-512x512.png')
print("✓ Created icon-512x512.png")

# Create maskable versions (with safe zone - 80% of image)
img_mask = Image.new('RGBA', (192, 192), color=(0, 0, 0, 0))
draw_mask = ImageDraw.Draw(img_mask)

# Draw on maskable version
draw_mask.ellipse([20, 20, 172, 172], outline='#ffc300', width=4)
draw_mask.rectangle([85, 30, 107, 162], fill='#ffc300')
draw_mask.rectangle([30, 85, 162, 107], fill='#ffc300')

img_mask.save('frontend-pwa/public/icon-192x192-maskable.png')
print("✓ Created icon-192x192-maskable.png")

img_mask_512 = Image.new('RGBA', (512, 512), color=(0, 0, 0, 0))
draw_mask_512 = ImageDraw.Draw(img_mask_512)

draw_mask_512.ellipse([50, 50, 462, 462], outline='#ffc300', width=10)
draw_mask_512.rectangle([230, 80, 282, 432], fill='#ffc300')
draw_mask_512.rectangle([80, 230, 432, 282], fill='#ffc300')

img_mask_512.save('frontend-pwa/public/icon-512x512-maskable.png')
print("✓ Created icon-512x512-maskable.png")

PYTHON_EOF

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ All icons created successfully!"
        exit 0
    fi
    
    echo ""
    echo "⚠️  Could not create icons automatically."
    echo ""
    echo "Manual steps to add PWA icons:"
    echo "1. Create or obtain:"
    echo "   - 192x192 PNG icon: frontend-pwa/public/icon-192x192.png"
    echo "   - 512x512 PNG icon: frontend-pwa/public/icon-512x512.png"
    echo ""
    echo "2. Icon requirements:"
    echo "   - Background color should match theme (#05070d)"
    echo "   - Contains visible logo/design (e.g., gear, A, or WMS logo)"
    echo "   - Square format (192x192, 512x512)"
    echo ""
    echo "3. Optional - Maskable icons (for rounded corners on some Android devices):"
    echo "   - icon-192x192-maskable.png (transparent background)"
    echo "   - icon-512x512-maskable.png (transparent background)"
    exit 1
fi

# ImageMagick is available - use it
convert -size 192x192 xc:'#05070d' \
  -fill '#ffc300' -draw "circle 96,96 20,96" \
  -draw "rectangle 85,30 107,162" \
  -draw "rectangle 30,85 162,107" \
  frontend-pwa/public/icon-192x192.png

convert -size 512x512 xc:'#05070d' \
  -fill '#ffc300' -draw "circle 256,256 50,256" \
  -draw "rectangle 230,80 282,432" \
  -draw "rectangle 80,230 432,282" \
  frontend-pwa/public/icon-512x512.png

echo "✅ Icons created with ImageMagick"
