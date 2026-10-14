"""Combine local source files into one offline HTML file (Python 3, no packages)."""
from pathlib import Path

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + (root / 'styles.css').read_text(encoding='utf-8') + '\n</style>')
html = html.replace('<script src="app.js" defer></script>', '')
html = html.replace('<script src="economy.js" defer></script>', '')
html = html.replace('</body>', '<script>\n' + (root / 'economy.js').read_text(encoding='utf-8') + '\n' + (root / 'app.js').read_text(encoding='utf-8') + '\n</script>\n</body>')
(root / 'one-coin-life.html').write_text(html, encoding='utf-8')
print('Built one-coin-life.html')
