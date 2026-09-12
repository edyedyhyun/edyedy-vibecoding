#!/usr/bin/env python3
"""Builds breakout.html — a single self-contained file with no external
dependencies, by inlining engine.js and app.js into index.html.

Usage: python3 build.py
Uses only the Python standard library.
"""
import re
from pathlib import Path

DIR = Path(__file__).resolve().parent


def read(name):
    return (DIR / name).read_text(encoding='utf-8')


def build():
    html = read('index.html')
    engine_js = read('engine.js')
    app_js = read('app.js')

    # Replace <script src="engine.js"></script> and app.js script tags
    # with inline <script> blocks containing their content.
    html = re.sub(
        r'<script\s+src="engine\.js"></script>',
        '<script>\n' + engine_js + '\n</script>',
        html
    )
    html = re.sub(
        r'<script\s+src="app\.js"></script>',
        '<script>\n' + app_js + '\n</script>',
        html
    )

    out_path = DIR / 'breakout.html'
    out_path.write_text(html, encoding='utf-8')
    print('Built {}'.format(out_path))


if __name__ == '__main__':
    build()
