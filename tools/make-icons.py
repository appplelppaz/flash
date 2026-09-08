#!/usr/bin/env python3
"""アプリのアイコンを作る（依存ライブラリなし・PNG を直接書き出す）。

    python3 tools/make-icons.py

icons/ に 180 / 192 / 512 / maskable-512 の PNG を書き出す。
"""
import math
import struct
import zlib
import os

BG = (0x0e, 0x0f, 0x13)
ACCENT = (0x7a, 0xa2, 0xf7)
INK = (0x0b, 0x10, 0x20)
LINE = (0x3a, 0x40, 0x55)

SS = 3  # スーパーサンプリング倍率


def rounded_rect_sdf(px, py, cx, cy, w, h, r, angle):
    """回転した角丸長方形の内外判定（内側なら負）"""
    a = math.radians(angle)
    dx, dy = px - cx, py - cy
    x = dx * math.cos(-a) - dy * math.sin(-a)
    y = dx * math.sin(-a) + dy * math.cos(-a)
    qx = abs(x) - (w / 2 - r)
    qy = abs(y) - (h / 2 - r)
    ox, oy = max(qx, 0.0), max(qy, 0.0)
    return math.hypot(ox, oy) + min(max(qx, qy), 0.0) - r


def blend(dst, src, alpha):
    return tuple(int(round(d + (s - d) * alpha)) for d, s in zip(dst, src))


def render(size, safe=1.0):
    """1 枚ぶんのピクセルを返す。safe<1 は maskable 用に図案を内側へ寄せる。"""
    n = size * SS
    u = n / 1024.0            # 1024 を基準に設計
    px = [[BG] * n for _ in range(n)]
    cx = cy = n / 2.0
    s = safe

    back = dict(cx=cx - 40 * u * s, cy=cy - 30 * u * s, w=430 * u * s, h=560 * u * s, r=60 * u * s, angle=-11)
    front = dict(cx=cx + 45 * u * s, cy=cy + 25 * u * s, w=430 * u * s, h=560 * u * s, r=60 * u * s, angle=7)
    bar1 = dict(cx=front['cx'], cy=front['cy'] - 60 * u * s, w=250 * u * s, h=46 * u * s, r=23 * u * s, angle=7)
    bar2 = dict(cx=front['cx'] - 30 * u * s, cy=front['cy'] + 40 * u * s, w=190 * u * s, h=32 * u * s, r=16 * u * s, angle=7)

    for y in range(n):
        row = px[y]
        fy = y + 0.5
        for x in range(n):
            fx = x + 0.5
            c = BG
            d = rounded_rect_sdf(fx, fy, **back)
            if d < 0:
                c = BG
            if abs(d) < 9 * u:                      # 後ろのカードは線だけ
                c = blend(c, LINE, 1.0)
            d = rounded_rect_sdf(fx, fy, **front)
            if d < 0:
                c = ACCENT
                if rounded_rect_sdf(fx, fy, **bar1) < 0 or rounded_rect_sdf(fx, fy, **bar2) < 0:
                    c = INK
            row[x] = c

    # 縮小（平均）
    out = bytearray()
    for y in range(size):
        out.append(0)
        for x in range(size):
            r = g = b = 0
            for sy in range(SS):
                for sx in range(SS):
                    c = px[y * SS + sy][x * SS + sx]
                    r += c[0]; g += c[1]; b += c[2]
            k = SS * SS
            out += bytes((r // k, g // k, b // k))
    return bytes(out)


def write_png(path, size, raw):
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', header)
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('%s (%d×%d, %.1f KB)' % (path, size, size, len(png) / 1024))


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(here, 'icons')
    os.makedirs(out, exist_ok=True)
    for size in (180, 192, 512):
        write_png(os.path.join(out, 'icon-%d.png' % size), size, render(size))
    write_png(os.path.join(out, 'icon-maskable-512.png'), 512, render(512, safe=0.72))


if __name__ == '__main__':
    main()
