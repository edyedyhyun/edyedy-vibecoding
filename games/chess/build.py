#!/usr/bin/env python3
"""build.py — index.html + engine.js + app.js를 하나의 자족형 chess.html로 합칩니다.

사용법:
    python3 build.py

외부 라이브러리 없이 표준 라이브러리만 사용합니다.
"""

import os

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

    if '<script src="engine.js"></script>' not in html:
        raise RuntimeError("index.html에서 engine.js 스크립트 태그를 찾을 수 없습니다.")
    if '<script src="app.js"></script>' not in html:
        raise RuntimeError("index.html에서 app.js 스크립트 태그를 찾을 수 없습니다.")

    bundled = inline_scripts(html, engine_js, app_js)

    out_path = write("chess.html", bundled)
    print("생성 완료: {}".format(out_path))


if __name__ == "__main__":
    main()
