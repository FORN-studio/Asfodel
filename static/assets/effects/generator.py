# generator.py

from PIL import Image
import json
import os

def main():
    # 1) Prompt user for inputs
    image_path = input("Path to sprite sheet image: ")
    columns = int(input("Number of columns: "))
    rows = int(input("Number of rows: "))

    # 2) Open the image and get dimensions
    img = Image.open(image_path)
    sheet_w, sheet_h = img.size

    # 3) Compute frame dimensions and count
    sprite_w = sheet_w // columns
    sprite_h = sheet_h // rows
    frame_count = columns * rows

    # 4) Build frames dictionary
    frames = {}
    for i in range(frame_count):
        col = i % columns
        row = i // columns
        frames[f"frame_{i}"] = {
            "frame": {"x": col * sprite_w, "y": row * sprite_h, "w": sprite_w, "h": sprite_h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": sprite_w, "h": sprite_h},
            "sourceSize": {"w": sprite_w, "h": sprite_h}
        }

    # 5) Assemble JSON structure
    json_data = {
        "frames": frames,
        "meta": {
            "image": os.path.basename(image_path),
            "size": {"w": sheet_w, "h": sheet_h},
            "scale": "1"
        }
    }

    # 6) Write JSON file
    output_file = "spritesheet.json"
    with open(output_file, "w") as f:
        json.dump(json_data, f, indent=2)

    print(f"✓ {output_file} created ({frame_count} frames, {columns}×{rows}, sheet {sheet_w}×{sheet_h})")

if __name__ == "__main__":
    main()
