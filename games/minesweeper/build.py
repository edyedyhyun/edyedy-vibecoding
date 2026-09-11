#!/usr/bin/env python3
"""
index.html + engine.js + app.js를 합쳐서 외부 리소스가 전혀 없는 단일 파일
minesweeper.html을 만든다. index.html의 <script src="engine.js"></script>,
<script src="app.js"></script> 두 줄만 각 파일 내용을 인라인한 <script> 태그로
바꾸고, 나머지 마크업/스타일은 그대로 둔다.

`python3 build.py`로 minesweeper.html을 다시 생성한다.
"""
import pathlib

BASE_DIR = pathlib.Path(__file__).resolve().parent
INDEX_PATH = BASE_DIR / "index.html"
ENGINE_PATH = BASE_DIR / "engine.js"
APP_PATH = BASE_DIR / "app.js"
OUTPUT_PATH = BASE_DIR / "minesweeper.html"

ENGINE_TAG = '<script src="engine.js"></script>'
APP_TAG = '<script src="app.js"></script>'


def escape_script_close(js_source):
    """
    JS 소스 안에(문자열/주석 어디든) "</script"가 그대로 있으면 감싸고 있는
    HTML <script> 태그가 거기서 끝나버린다. 대소문자 관계없이 찾아서
    "<\\/script"로 바꿔 이스케이프한다. 이 프로젝트의 engine.js/app.js에는
    현재 이런 문자열이 없지만, 나중에 누가 주석/문자열에 실수로 넣어도
    깨지지 않도록 항상 방어적으로 처리한다.
    """
    import re

    return re.sub(r"</(script)", r"<\\/\1", js_source, flags=re.IGNORECASE)


def build_inline_script(js_source):
    return "<script>\n" + escape_script_close(js_source) + "\n</script>"


def main():
    index_html = INDEX_PATH.read_text(encoding="utf-8")
    engine_js = ENGINE_PATH.read_text(encoding="utf-8")
    app_js = APP_PATH.read_text(encoding="utf-8")

    if ENGINE_TAG not in index_html:
        raise SystemExit(f"index.html에서 {ENGINE_TAG!r}를 찾을 수 없습니다.")
    if APP_TAG not in index_html:
        raise SystemExit(f"index.html에서 {APP_TAG!r}를 찾을 수 없습니다.")

    combined = index_html.replace(ENGINE_TAG, build_inline_script(engine_js))
    combined = combined.replace(APP_TAG, build_inline_script(app_js))

    OUTPUT_PATH.write_text(combined, encoding="utf-8")
    print(f"wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
