#!/usr/bin/env python3
"""Render a TDPlay-style glossy black oval button with pink glowing text to a
transparent PNG.  python3 make_button.py "Search" search-button.png [--font PATH] [--magnifier]
"""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 3                               # supersample for smooth edges
W, H = 700 * SS, 260 * SS            # final 700x260 px (transparent)
BW, BH = 620 * SS, 210 * SS          # oval size
PINK, PINK_GLOW, PINK_DARK = (255, 108, 196), (255, 31, 149), (110, 10, 63)


def ellipse_mask(size, box):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    return m


def vgradient(size, top, bottom):
    """Vertical RGBA gradient image."""
    g = Image.new("RGBA", size)
    px = g.load()
    for y in range(size[1]):
        t = y / max(1, size[1] - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(4))
        for x in range(size[0]):
            px[x, y] = c
    return g


def draw_magnifier(d, x, y, size, fill):
    """Magnifying glass: ring + 45° handle, drawn inside the (x, y, size, size) box."""
    stroke = max(2, int(size * 0.17))
    ring = int(size * 0.70)
    d.ellipse((x, y, x + ring, y + ring), outline=fill, width=stroke)
    # handle from the ring's lower-right edge to the box corner
    hx0 = x + ring - int(ring * 0.12)
    hy0 = y + ring - int(ring * 0.12)
    hx1, hy1 = x + size, y + size
    d.line((hx0, hy0, hx1, hy1), fill=fill, width=int(stroke * 1.35))
    r = int(stroke * 1.35 / 2)
    d.ellipse((hx1 - r, hy1 - r, hx1 + r, hy1 + r), fill=fill)   # round cap


def render(text, out, font_path, magnifier=False):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x0, y0 = (W - BW) // 2, (H - BH) // 2
    box = (x0, y0, x0 + BW, y0 + BH)

    # soft drop shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((x0, y0 + 10 * SS, x0 + BW, y0 + BH + 10 * SS), fill=(0, 0, 0, 170))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14 * SS)))

    # body: dark vertical gradient, darker rim
    body = vgradient((BW, BH), (46, 46, 48, 255), (4, 4, 5, 255))
    # subtle lighter bloom at the bottom centre (like the reference's lower rim)
    bloom = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    ImageDraw.Draw(bloom).ellipse((BW * 0.15, BH * 0.55, BW * 0.85, BH * 1.25), fill=(70, 70, 74, 150))
    body.alpha_composite(bloom.filter(ImageFilter.GaussianBlur(26 * SS)))
    img.paste(body, (x0, y0), ellipse_mask((BW, BH), (0, 0, BW - 1, BH - 1)))

    # rim highlight
    ImageDraw.Draw(img).ellipse(box, outline=(72, 72, 76, 255), width=2 * SS)

    # glass reflection on the upper half
    gw, gh = int(BW * 0.84), int(BH * 0.48)
    gloss = vgradient((gw, gh), (255, 255, 255, 88), (255, 255, 255, 0))
    gm = ellipse_mask((gw, gh), (0, 0, gw - 1, gh - 1))
    gloss.putalpha(Image.composite(gloss.getchannel("A"), Image.new("L", (gw, gh), 0), gm))
    img.alpha_composite(gloss, (x0 + (BW - gw) // 2, y0 + int(BH * 0.06)))

    # text with pink glow
    font = ImageFont.truetype(font_path, int(BH * 0.50))
    try:
        font.set_variation_by_axes([600])
    except Exception:
        pass
    bb = ImageDraw.Draw(img).textbbox((0, 0), text, font=font)
    text_w, text_h = bb[2] - bb[0], bb[3] - bb[1]
    icon = int(text_h * 0.92) if magnifier else 0
    gap = int(text_h * 0.30) if magnifier else 0
    group_w = icon + gap + text_w
    gx = (W - group_w) // 2
    tx = gx + icon + gap - bb[0]
    ty = (H - text_h) // 2 - bb[1] - 2 * SS
    iy = (H - icon) // 2 - 2 * SS

    def paint(d, color, dy=0):
        if magnifier:
            draw_magnifier(d, gx, iy + dy, icon, color)
        d.text((tx, ty + dy), text, font=font, fill=color)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    paint(ImageDraw.Draw(glow), PINK_GLOW + (255,))
    for r in (26, 14, 7, 3):
        img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(r * SS)))
    d = ImageDraw.Draw(img)
    paint(d, PINK_DARK + (255,), dy=3 * SS)   # depth
    paint(d, PINK + (255,))

    img = img.resize((W // SS, H // SS), Image.LANCZOS)
    img.save(out, optimize=True)
    return img.size


if __name__ == "__main__":
    text = sys.argv[1] if len(sys.argv) > 1 else "Search"
    out = sys.argv[2] if len(sys.argv) > 2 else "search-button.png"
    font = sys.argv[sys.argv.index("--font") + 1] if "--font" in sys.argv else "Oswald.ttf"
    print(render(text, out, font, magnifier="--magnifier" in sys.argv))
