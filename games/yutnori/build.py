#!/usr/bin/env python3
"""index.html + engine.js + app.js 를 하나의 yutnori.html 파일로 합친다. 의존성 없음."""
import pathlib

HERE = pathlib.Path(__file__).parent


def build():
    html = (HERE / "index.html").read_text(encoding="utf-8")
    engine = (HERE / "engine.js").read_text(encoding="utf-8")
    app = (HERE / "app.js").read_text(encoding="utf-8")
    html = html.replace(
        '<script src="engine.js"></script>\n<script src="app.js"></script>',
        "<script>\n" + engine + "\n</script>\n<script>\n" + app + "\n</script>",
    )
    out = HERE / "yutnori.html"
    out.write_text(html, encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    build()
