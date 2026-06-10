from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "app_icon_source.png"
RES_DIR = ROOT / "android" / "app" / "src" / "main" / "res"

LAUNCHER_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

FOREGROUND_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}


def centered_square(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side))


def save_resized(source: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    resized = source.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(path, "PNG", optimize=True)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing icon source: {SOURCE}")

    with Image.open(SOURCE) as original:
        if original.format != "PNG":
            raise SystemExit(f"Icon source must be PNG, got: {original.format}")

        square = centered_square(original.convert("RGBA"))

        for folder, size in LAUNCHER_SIZES.items():
            target_dir = RES_DIR / folder
            save_resized(square, target_dir / "ic_launcher.png", size)
            save_resized(square, target_dir / "ic_launcher_round.png", size)

        for folder, size in FOREGROUND_SIZES.items():
            save_resized(square, RES_DIR / folder / "ic_launcher_foreground.png", size)

    print("Android launcher icons generated.")


if __name__ == "__main__":
    main()
