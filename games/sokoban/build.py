from pathlib import Path
p=Path(__file__).parent
html=(p/'index.html').read_text()
for name in ['engine','app']:
 html=html.replace(f'<script src="{name}.js"></script>', '<script>\n'+(p/f'{name}.js').read_text()+'\n</script>')
(p/'sokoban.html').write_text(html)
