from pathlib import Path
p=Path(__file__).parent
s=(p/'index.html').read_text()
for f in ['engine.js','app.js']:
 s=s.replace(f'<script src="{f}"></script>','<script>\n'+(p/f).read_text()+'\n</script>')
(p/'beat-window.html').write_text(s)
