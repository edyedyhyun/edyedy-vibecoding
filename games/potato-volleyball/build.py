#!/usr/bin/env python3
"""
build.py — index.html + engine.js + app.js를 하나의 오프라인 HTML
파일(potato-volleyball.html)로 합친다. 외부 의존성 없이 표준 라이브러리만
사용하며, <script src="engine.js"></script> / <script src="app.js"></script>
두 태그를 각 파일 내용을 담은 인라인 <script> 태그로 치환한다.

사용법: python3 build.py
"""
import pathlib

BASE_DIR = pathlib.Path(__file__).resolve().parent
INDEX_PATH = BASE_DIR / "index.html"
ENGINE_PATH = BASE_DIR / "engine.js"
APP_PATH = BASE_DIR / "app.js"
OUTPUT_PATH = BASE_DIR / "potato-volleyball.html"


def inline_script(html: str, src: str, code: str) -> str:
    tag = '<script src="%s"></script>' % src
    if tag not in html:
        raise ValueError("expected tag not found: %s" % tag)
    replacement = "<script>\n%s\n</script>" % code
    return html.replace(tag, replacement, 1)


def build() -> None:
    html = INDEX_PATH.read_text(encoding="utf-8")
    engine_js = ENGINE_PATH.read_text(encoding="utf-8")
    app_js = APP_PATH.read_text(encoding="utf-8")

    html = inline_script(html, "engine.js", engine_js)
    html = inline_script(html, "app.js", app_js)

    OUTPUT_PATH.write_text(html, encoding="utf-8")
    print("wrote %s" % OUTPUT_PATH)


if __name__ == "__main__":
    build()
