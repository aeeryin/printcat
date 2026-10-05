"""Create the bitmap used by Printcat's borderless Windows installer.

The BMP is committed so CI builds do not need Pillow. Run this script only
when changing the installer artwork.
"""

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
LOGO = Image.open(ROOT / "src/assets/images/logoWithText.png").convert("RGBA")

WIDTH, HEIGHT = 680, 420
image = Image.new("RGB", (WIDTH, HEIGHT), "#171717")
draw = ImageDraw.Draw(image)

# Dark graphite canvas with the bright blue of the existing Printcat logo.
for y in range(HEIGHT):
    t = y / (HEIGHT - 1)
    draw.line((0, y, WIDTH, y), fill=(int(23 + 7*t), int(23 + 9*t), int(23 + 16*t)))

draw.rounded_rectangle((29, 28, 650, 390), radius=23, fill="#202226", outline="#353942", width=1)
draw.rounded_rectangle((44, 44, 203, 124), radius=18, fill="#F7FAFF")
logo = LOGO.copy()
logo.thumbnail((139, 66), Image.Resampling.LANCZOS)
image.paste(logo, (44 + (159 - logo.width)//2, 44 + (80 - logo.height)//2), logo)

# Screenshot-selection corners, drawn once instead of stock wizard art.
accent = "#2675FF"
draw.line((497, 79, 497, 57, 519, 57), fill=accent, width=3)
draw.line((610, 57, 632, 57, 632, 79), fill=accent, width=3)
draw.line((497, 131, 497, 153, 519, 153), fill=accent, width=3)
draw.line((610, 153, 632, 153, 632, 131), fill=accent, width=3)
draw.rounded_rectangle((533, 94, 596, 112), radius=9, fill="#2B4774")
draw.rounded_rectangle((539, 99, 570, 107), radius=4, fill=accent)

draw.rounded_rectangle((44, 170, 102, 174), radius=2, fill=accent)
draw.line((44, 297, 636, 297), fill="#383D47", width=1)
draw.rounded_rectangle((44, 315, 636, 331), radius=8, fill="#313946")
draw.ellipse((48, 367, 54, 373), fill=accent)
draw.ellipse((61, 367, 67, 373), fill="#485773")
draw.ellipse((74, 367, 80, 373), fill="#485773")

image.save(OUT / "screen.bmp", format="BMP")
