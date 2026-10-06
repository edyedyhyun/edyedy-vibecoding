from pathlib import Path
p=Path(__file__).parent
s=(p/'index.html').read_text()
for name in ['engine','app']:
 s=s.replace(f'<script src="{name}.js"></script>','<script>\n'+(p/f'{name}.js').read_text()+'\n</script>')
(p/'snow-roll.html').write_text(s)
