"""
Simple script to create PWA icons for Voice Transcriber Pro
Requires: Pillow (PIL)
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("❌ Pillow nicht installiert!")
    print("Installation mit: pip install Pillow")
    exit(1)


def create_icon(size, output_path):
    """Create a simple icon with microphone symbol"""
    # Create image with gradient background
    img = Image.new('RGB', (size, size), color='#6366f1')
    draw = ImageDraw.Draw(img)

    # Draw microphone shape (simplified)
    # Mic body (rounded rectangle)
    mic_width = size // 3
    mic_height = size // 2.5
    mic_x = (size - mic_width) // 2
    mic_y = size // 5

    # Draw microphone body
    draw.rounded_rectangle(
        [mic_x, mic_y, mic_x + mic_width, mic_y + mic_height],
        radius=mic_width // 2,
        fill='white'
    )

    # Draw microphone stand (line)
    stand_x = size // 2
    stand_y1 = mic_y + mic_height
    stand_y2 = size - size // 5
    draw.line(
        [(stand_x, stand_y1), (stand_x, stand_y2)],
        fill='white',
        width=max(2, size // 40)
    )

    # Draw microphone base (horizontal line)
    base_width = mic_width * 1.5
    base_x1 = stand_x - base_width // 2
    base_x2 = stand_x + base_width // 2
    base_y = stand_y2
    draw.line(
        [(base_x1, base_y), (base_x2, base_y)],
        fill='white',
        width=max(2, size // 30)
    )

    # Save
    img.save(output_path, 'PNG')
    print(f"✅ Icon erstellt: {output_path} ({size}x{size})")


def main():
    """Create all required icons"""
    print("🎨 Erstelle PWA Icons...")

    # Ensure static directory exists
    static_dir = 'static'
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)

    # Create icons in different sizes
    sizes = [192, 512]

    for size in sizes:
        output_path = os.path.join(static_dir, f'icon-{size}.png')
        create_icon(size, output_path)

    print("\n✨ Alle Icons erfolgreich erstellt!")
    print("\nErstellte Dateien:")
    print("  - static/icon-192.png (192x192)")
    print("  - static/icon-512.png (512x512)")


if __name__ == '__main__':
    main()
