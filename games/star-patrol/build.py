#!/usr/bin/env python3
"""index.html + engine.js + app.js 를 하나의 standalone star-patrol.html 로 합칩니다."""
import re
from pathlib import Path

HERE = Path(__file__).parent

def main():
    html = (HERE / "index.html").read_text(encoding="utf-8")
    engine = (HERE / "engine.js").read_text(encoding="utf-8")
    app = (HERE / "app.js").read_text(encoding="utf-8")

    html = re.sub(
        r'<script src="engine\.js"></script>\s*<script src="app\.js"></script>',
        "<script>\n" + engine + "\n</script>\n<script>\n" + app + "\n</script>",
        html,
    )

    out = HERE / "star-patrol.html"
    out.write_text(html, encoding="utf-8")
    print("built", out)

if __name__ == "__main__":
    main()
