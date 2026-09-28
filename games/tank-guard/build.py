from pathlib import Path
p=Path(__file__).parent
s=(p/'index.html').read_text()
for name in ['engine.js','app.js']:s=s.replace(f'<script src="{name}"></script>','<script>\n'+(p/name).read_text()+'\n</script>')
(p/'tank-guard.html').write_text(s)
print('Built offline tank-guard.html')
