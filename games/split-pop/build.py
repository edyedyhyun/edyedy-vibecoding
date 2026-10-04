from pathlib import Path
p=Path(__file__).parent
s=(p/'index.html').read_text()
for n in ['engine','app']:s=s.replace(f'<script src="{n}.js"></script>','<script>\n'+(p/f'{n}.js').read_text()+'\n</script>')
(p/'split-pop.html').write_text(s)
