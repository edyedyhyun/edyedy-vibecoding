"""Package Sonnet's tested source files into a reproducible offline HTML file."""
from pathlib import Path
import re

game = Path(__file__).resolve().parent
html = (game / 'index.html').read_text()
for name in ('engine.js', 'app.js'):
    source = (game / name).read_text()
    # Even a closing script tag in a JS comment ends an HTML script element.
    source = re.sub(r'</script', r'<\\/script', source, flags=re.I)
    pattern = r'<script\s+src=[\"\x27]' + re.escape(name) + r'[\"\x27]\s*>\s*</script>'
    html, count = re.subn(pattern, lambda _: '<script>\n' + source + '\n</script>', html)
    assert count == 1, name
html = html.replace(' (개발용)', '')
(game / 'snake.html').write_text(html)
print('Built snake.html from index.html, engine.js and app.js')
