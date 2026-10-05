"""Generate the bitmap resources used by the Windows NSIS installer.

Run with a Python installation that has Pillow. The generated BMPs are kept in
Git so GitHub Actions does not need Pillow at build time.
"""

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
LOGO = Image.open(ROOT / "src/assets/images/logoWithText.png").convert("RGBA")
BLUE = (26, 101, 247)


def place_logo(canvas, box):
    x, y, width, height = box
    logo = LOGO.copy()
    logo.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas.paste(logo, (x + (width - logo.width) // 2, y + (height - logo.height) // 2), logo)


def save_bmp(image, name):
    image.convert("RGB").save(OUT / name, format="BMP")


# The header remains visible while Windows installs or updates Printcat.
header = Image.new("RGB", (150, 57), "#FFFFFF")
draw = ImageDraw.Draw(header)
draw.rectangle((0, 54, 149, 56), fill=BLUE)
place_logo(header, (10, 4, 130, 45))
save_bmp(header, "header.bmp")


# Modern UI's 164 x 314 welcome / finish image.
sidebar = Image.new("RGB", (164, 314), "#F6F9FF")
draw = ImageDraw.Draw(sidebar)
for y in range(314):
    t = y / 313
    color = (
        int(246 * (1 - t) + 228 * t),
        int(249 * (1 - t) + 239 * t),
        255,
    )
    draw.line((0, y, 163, y), fill=color)

# Crop-frame corners tie the installer artwork to the screenshot tool.
draw.line((18, 27, 18, 57, 48, 57), fill=BLUE, width=3)
draw.line((116, 57, 146, 57, 146, 27), fill=BLUE, width=3)
draw.line((18, 257, 18, 287, 48, 287), fill=BLUE, width=3)
draw.line((116, 287, 146, 287, 146, 257), fill=BLUE, width=3)
draw.rounded_rectangle((18, 116, 146, 197), radius=20, fill="#FFFFFF", outline="#D6E4FF", width=2)
place_logo(sidebar, (26, 131, 112, 51))
draw.rounded_rectangle((52, 218, 112, 224), radius=3, fill="#C7D8FC")
draw.rounded_rectangle((52, 218, 91, 224), radius=3, fill=BLUE)
save_bmp(sidebar, "sidebar.bmp")
