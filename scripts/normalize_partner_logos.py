"""Normalize partner logos before adding them to the landing-page logo rail.

Run this script whenever new logos are added: it crops excessive flat-color
padding and places each mark on a wide canvas so the name uses the card width.
"""

from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
LOGO_DIR = ROOT / "public" / "assets-clientes-monnera" / "parceiros-comerciais"
CANVAS = (520, 180)
TARGETS = ("parceiro-01.png", "parceiro-04.png")


def font(size, bold=False):
    names = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for name in names:
        path = Path(name)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def edge_color(img):
    rgb = img.convert("RGB")
    w, h = rgb.size
    samples = []
    for x in range(w):
        samples.append(rgb.getpixel((x, 0)))
        samples.append(rgb.getpixel((x, h - 1)))
    for y in range(h):
        samples.append(rgb.getpixel((0, y)))
        samples.append(rgb.getpixel((w - 1, y)))
    return tuple(int(median(channel)) for channel in zip(*samples))


def color_distance(a, b):
    return sum((int(a[i]) - int(b[i])) ** 2 for i in range(3)) ** 0.5


def content_bbox(img, bg):
    rgb = img.convert("RGB")
    w, h = rgb.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            if color_distance(rgb.getpixel((x, y)), bg) > 34:
                xs.append(x)
                ys.append(y)
    if not xs:
        return (0, 0, w, h)
    pad = 4
    return (
        max(min(xs) - pad, 0),
        max(min(ys) - pad, 0),
        min(max(xs) + pad + 1, w),
        min(max(ys) + pad + 1, h),
    )


def normalize_existing(path):
    img = Image.open(path).convert("RGBA")
    bg = edge_color(img)
    cropped = img.crop(content_bbox(img, bg))
    canvas = Image.new("RGBA", CANVAS, (*bg, 255))
    max_w, max_h = int(CANVAS[0] * 0.9), int(CANVAS[1] * 0.68)
    scale = min(max_w / cropped.width, max_h / cropped.height)
    resized = cropped.resize((int(cropped.width * scale), int(cropped.height * scale)), Image.Resampling.LANCZOS)
    x = (CANVAS[0] - resized.width) // 2
    y = (CANVAS[1] - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    canvas.convert("RGB").save(path, optimize=True)


def draw_centered(draw, box, text, fill, text_font, spacing=0):
    left, top, right, bottom = box
    bbox = draw.textbbox((0, 0), text, font=text_font, spacing=spacing)
    x = left + (right - left - (bbox[2] - bbox[0])) / 2
    y = top + (bottom - top - (bbox[3] - bbox[1])) / 2
    draw.text((x, y), text, fill=fill, font=text_font, spacing=spacing)


def create_biomax(path):
    img = Image.new("RGB", CANVAS, "white")
    draw = ImageDraw.Draw(img)
    green = "#5b9c2a"
    red = "#e6330a"
    draw_centered(draw, (0, 18, CANVAS[0], 56), "R E D E   D E   F A R M A C I A S", green, font(24, True))

    main_font = font(86, True)
    x = 42
    y = 66
    draw.text((x, y), "BIOMAX", fill=red, font=main_font)

    bi_width = draw.textlength("BI", font=main_font)
    o_width = draw.textlength("O", font=main_font)
    o_size = 54
    ox = int(x + bi_width + (o_width - o_size) / 2)
    oy = y + 22
    draw.ellipse((ox, oy, ox + o_size, oy + o_size), fill=red)
    draw.ellipse((ox + 6, oy + 6, ox + o_size - 6, oy + o_size - 6), fill="white")
    draw.ellipse((ox + 10, oy + 10, ox + o_size - 10, oy + o_size - 10), fill=green)
    draw.ellipse((ox + 18, oy + 18, ox + o_size - 18, oy + o_size - 18), fill="white")
    draw.rounded_rectangle((ox + 25, oy + 20, ox + 31, oy + 34), radius=3, fill=green)
    draw.rounded_rectangle((ox + 21, oy + 24, ox + 35, oy + 30), radius=3, fill=green)
    img.save(path, optimize=True)


def create_unipreco(path):
    img = Image.new("RGB", CANVAS, "#0aa39a")
    draw = ImageDraw.Draw(img)
    red = "#ed3343"
    draw.ellipse((116, 58, 180, 122), fill=red)
    draw.rounded_rectangle((140, 70, 156, 110), radius=5, fill="white")
    draw.rounded_rectangle((128, 82, 168, 98), radius=5, fill="white")
    draw.text((188, 72), "unipreco", fill="white", font=font(52, True))
    draw.text((328, 53), "farmacias", fill="white", font=font(22, True))
    img.save(path, optimize=True)


def create_cruzeiro(path):
    img = Image.new("RGB", CANVAS, "white")
    draw = ImageDraw.Draw(img)
    blue = "#0b67a8"
    navy = "#123b68"
    cx, cy = 70, 90
    points = [(cx, 14), (cx + 24, cy - 24), (cx + 84, cy), (cx + 24, cy + 24), (cx, 166), (cx - 24, cy + 24), (cx - 84, cy), (cx - 24, cy - 24)]
    draw.polygon(points, fill=blue)
    draw.polygon([(cx, 28), (cx + 15, cy - 15), (cx + 64, cy), (cx + 15, cy + 15), (cx, 152), (cx - 15, cy + 15), (cx - 64, cy), (cx - 15, cy - 15)], fill=navy)
    draw.rounded_rectangle((cx - 13, cy - 38, cx + 13, cy + 38), radius=5, fill="white")
    draw.rounded_rectangle((cx - 38, cy - 13, cx + 38, cy + 13), radius=5, fill="white")
    draw.text((150, 24), "FARMACIAS", fill=navy, font=font(38, False))
    draw.text((146, 66), "CRUZEIRO", fill=blue, font=font(66, True))
    img.save(path, optimize=True)


def main():
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    for name in TARGETS:
        normalize_existing(LOGO_DIR / name)
    create_unipreco(LOGO_DIR / "parceiro-13.png")
    create_biomax(LOGO_DIR / "parceiro-25.png")
    create_cruzeiro(LOGO_DIR / "parceiro-26.png")


if __name__ == "__main__":
    main()
