#!/usr/bin/env python3
"""index.html 의 <script src> 를 인라인해 단일 파일 janggi.html 을 만든다 (표준 라이브러리만 사용)."""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent


def inline(match):
    js = (HERE / match.group(1)).read_text(encoding="utf-8")
    if "</script" in js.lower():
        sys.exit("오류: %s 안에 </script 문자열이 있어 인라인할 수 없습니다." % match.group(1))
    return "<script>\n" + js.rstrip() + "\n</script>"


def main():
    html = (HERE / "index.html").read_text(encoding="utf-8")
    out, n = re.subn(r'<script\s+src="([^"]+)"\s*>\s*</script>', inline, html)
    if n == 0:
        sys.exit("오류: 인라인할 <script src> 가 없습니다.")
    target = HERE / "janggi.html"
    target.write_text(out, encoding="utf-8")
    print("wrote %s (%d bytes, %d scripts inlined)" % (target, len(out.encode("utf-8")), n))


if __name__ == "__main__":
    main()
