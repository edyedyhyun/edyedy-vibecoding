#!/usr/bin/env python3
"""
Builds a single self-contained gomoku.html by inlining engine.js and app.js
into index.html. No external dependencies, no network access.

Usage:
    python3 build.py
"""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def read(name):
    path = os.path.join(BASE_DIR, name)
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def build():
    html = read('index.html')
    engine_js = read('engine.js')
    app_js = read('app.js')

    html = html.replace(
        '<script src="engine.js"></script>',
        '<script>\n' + engine_js + '\n</script>'
    )
    html = html.replace(
        '<script src="app.js"></script>',
        '<script>\n' + app_js + '\n</script>'
    )

    if '<script src=' in html:
        raise RuntimeError('unresolved external script reference remains in output')

    out_path = os.path.join(BASE_DIR, 'gomoku.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print('Wrote', out_path)


if __name__ == '__main__':
    build()
