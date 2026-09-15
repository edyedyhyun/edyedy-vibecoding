#!/usr/bin/env python3
"""build.py — index.html + engine.js + app.js를 하나의 자족형 reversi.html로 합칩니다.

사용법:
    python3 build.py

외부 라이브러리 없이 표준 라이브러리만 사용합니다.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def read(name):
    path = os.path.join(HERE, name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write(name, content):
    path = os.path.join(HERE, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return path


def inline_scripts(html, engine_js, app_js):
    # <script src="engine.js"></script> -> <script>...engine_js...</script>
    html = html.replace(
        '<script src="engine.js"></script>',
        "<script>\n" + engine_js + "\n</script>",
    )
    html = html.replace(
        '<script src="app.js"></script>',
        "<script>\n" + app_js + "\n</script>",
    )
    return html


def main():
    html = read("index.html")
    engine_js = read("engine.js")
    app_js = read("app.js")

    # 안전 확인: 두 스크립트 태그가 실제로 존재하는지 검사
    if '<script src="engine.js"></script>' not in html:
        raise RuntimeError("index.html에서 engine.js 스크립트 태그를 찾을 수 없습니다.")
    if '<script src="app.js"></script>' not in html:
        raise RuntimeError("index.html에서 app.js 스크립트 태그를 찾을 수 없습니다.")

    bundled = inline_scripts(html, engine_js, app_js)

    out_path = write("reversi.html", bundled)
    print("생성 완료: {}".format(out_path))


if __name__ == "__main__":
    main()
