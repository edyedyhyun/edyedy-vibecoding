#!/usr/bin/env python3
"""build.py — bundles index.html + engine.js + app.js into a single
standalone falling-blocks.html in the same directory. No dependencies
beyond the Python 3 standard library.
"""
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent


def inline_script(html, src_name, code):
    pattern = re.compile(r'<script src="%s"></script>' % re.escape(src_name))
    replacement = '<script>\n%s\n</script>' % code
    new_html, count = pattern.subn(replacement, html)
    if count != 1:
        raise SystemExit('expected exactly one <script src="%s"> tag, found %d' % (src_name, count))
    return new_html


def main():
    html = (HERE / 'index.html').read_text(encoding='utf-8')
    engine_js = (HERE / 'engine.js').read_text(encoding='utf-8')
    app_js = (HERE / 'app.js').read_text(encoding='utf-8')

    html = inline_script(html, 'engine.js', engine_js)
    html = inline_script(html, 'app.js', app_js)

    out_path = HERE / 'falling-blocks.html'
    out_path.write_text(html, encoding='utf-8')
    print('wrote', out_path)


if __name__ == '__main__':
    main()
