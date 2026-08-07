import argparse
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
IMPORT_DIR = ROOT / "work" / "desktop-wallpaper-import"
THUMBS_DIR = IMPORT_DIR / "thumbs"


def load_desktop_data():
    source = (ROOT / "desktop-wallpapers-data.js").read_text(encoding="utf-8")
    payload = re.sub(r"^\s*window\.PMW_DESKTOP_WALLPAPERS\s*=\s*", "", source)
    payload = re.sub(r";\s*$", "", payload)
    return json.loads(payload)


def safe_thumb_name(public_id, suffix):
    stem = re.sub(r"[^a-zA-Z0-9_-]", "-", public_id).strip("-")
    return THUMBS_DIR / f"{stem}.{suffix.lower()}"


def dct_matrix(size):
    matrix = np.zeros((size, size), dtype=np.float64)
    scale0 = math.sqrt(1 / size)
    scale = math.sqrt(2 / size)
    for row in range(size):
        factor = scale0 if row == 0 else scale
        for col in range(size):
            matrix[row, col] = factor * math.cos(math.pi * (2 * col + 1) * row / (2 * size))
    return matrix


DCT32 = dct_matrix(32)


def image_fingerprint(path):
    with Image.open(path) as image:
        rgb = ImageOps.fit(image.convert("RGB"), (64, 36), method=Image.Resampling.LANCZOS)
        small_rgb = np.asarray(rgb, dtype=np.float32) / 255.0
        gray = ImageOps.fit(image.convert("L"), (32, 32), method=Image.Resampling.LANCZOS)
        pixels = np.asarray(gray, dtype=np.float64)
        dct = DCT32 @ pixels @ DCT32.T
        low = dct[:8, :8].flatten()
        median = np.median(low[1:])
        phash = low > median
    return phash, small_rgb


def hash_similarity(left, right):
    return 1.0 - float(np.count_nonzero(left != right)) / left.size


def pixel_similarity(left, right):
    return 1.0 - float(np.mean(np.abs(left - right)))


def load_items():
    manifest = json.loads((IMPORT_DIR / "cloudinary-assets.json").read_text(encoding="utf-8"))
    existing = load_desktop_data()
    rows = []
    for index, asset in enumerate(manifest, start=1):
        path = safe_thumb_name(asset["public_id"], asset.get("format", "jpg"))
        rows.append({
            "batch_index": index,
            "kind": "new",
            "public_id": asset["public_id"],
            "category": asset["category"],
            "path": path,
            "asset": asset,
        })
    for item in existing:
        path = safe_thumb_name(item["publicId"], item.get("format", "jpg"))
        rows.append({
            "kind": "existing",
            "public_id": item["publicId"],
            "category": item["category"],
            "path": path,
            "asset": item,
        })
    return rows


def find_duplicates(rows, threshold):
    for row in rows:
        if not row["path"].exists():
            raise FileNotFoundError(f"Missing thumbnail: {row['path']}")
        row["phash"], row["pixels"] = image_fingerprint(row["path"])

    new_rows = [row for row in rows if row["kind"] == "new"]
    pairs = []
    for new_index, left in enumerate(new_rows):
        for right in rows:
            if right is left:
                continue
            if right["kind"] == "new" and right["batch_index"] <= left["batch_index"]:
                continue
            hash_score = hash_similarity(left["phash"], right["phash"])
            if hash_score < threshold:
                continue
            pixel_score = pixel_similarity(left["pixels"], right["pixels"])
            pairs.append({
                "left_index": left["batch_index"],
                "left_public_id": left["public_id"],
                "left_category": left["category"],
                "right_kind": right["kind"],
                "right_index": right.get("batch_index"),
                "right_public_id": right["public_id"],
                "right_category": right["category"],
                "hash_similarity": round(hash_score, 4),
                "pixel_similarity": round(pixel_score, 4),
            })
    return sorted(pairs, key=lambda pair: (-pair["hash_similarity"], -pair["pixel_similarity"]))


def make_contact_sheets(rows, columns=4, rows_per_sheet=5):
    output = IMPORT_DIR / "contact-sheets"
    output.mkdir(parents=True, exist_ok=True)
    new_rows = [row for row in rows if row["kind"] == "new"]
    tile_width, image_height, label_height = 480, 270, 54
    page_size = columns * rows_per_sheet
    font = ImageFont.load_default(size=18)
    small_font = ImageFont.load_default(size=14)
    index_rows = []

    for sheet_index in range(0, len(new_rows), page_size):
        chunk = new_rows[sheet_index:sheet_index + page_size]
        sheet = Image.new("RGB", (tile_width * columns, (image_height + label_height) * rows_per_sheet), "#101114")
        draw = ImageDraw.Draw(sheet)
        for position, row in enumerate(chunk):
            col = position % columns
            grid_row = position // columns
            x = col * tile_width
            y = grid_row * (image_height + label_height)
            with Image.open(row["path"]) as image:
                fitted = ImageOps.fit(image.convert("RGB"), (tile_width, image_height), method=Image.Resampling.LANCZOS)
            sheet.paste(fitted, (x, y))
            draw.rectangle((x, y + image_height, x + tile_width, y + image_height + label_height), fill="#101114")
            label = f"{row['batch_index']:03d}  {row['category']}"
            draw.text((x + 12, y + image_height + 6), label, fill="white", font=font)
            draw.text((x + 12, y + image_height + 30), row["public_id"][-34:], fill="#a9adb7", font=small_font)
            index_rows.append({
                "index": row["batch_index"],
                "category": row["category"],
                "public_id": row["public_id"],
                "thumbnail": str(row["path"].relative_to(ROOT)).replace("\\", "/"),
            })
        sheet_number = sheet_index // page_size + 1
        sheet.save(output / f"sheet-{sheet_number:02d}.jpg", quality=92)

    (IMPORT_DIR / "contact-sheet-index.json").write_text(
        json.dumps(index_rows, indent=2), encoding="utf-8"
    )
    return math.ceil(len(new_rows) / page_size)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=0.90)
    args = parser.parse_args()
    rows = load_items()
    duplicates = find_duplicates(rows, args.threshold)
    (IMPORT_DIR / "duplicate-candidates.json").write_text(
        json.dumps(duplicates, indent=2), encoding="utf-8"
    )
    sheet_count = make_contact_sheets(rows)
    print(f"New assets: {sum(row['kind'] == 'new' for row in rows)}")
    print(f"Existing assets compared: {sum(row['kind'] == 'existing' for row in rows)}")
    print(f"Similarity candidates >= {args.threshold:.0%}: {len(duplicates)}")
    print(f"Contact sheets: {sheet_count}")


if __name__ == "__main__":
    main()
