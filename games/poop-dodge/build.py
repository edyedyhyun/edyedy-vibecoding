#!/usr/bin/env python3
"""poop-dodge.html 을 생성합니다: index.html 의 engine.js / app.js 스크립트 태그를
실제 소스로 인라인해 외부 의존성이 없는 단일 파일로 만듭니다.

사용법: python3 build.py   (표준 라이브러리만 사용)
"""
from pathlib import Path

DIR = Path(__file__).resolve().parent


def read(name):
    return (DIR / name).read_text(encoding='utf-8')


def build():
    html = read('index.html')
    for name in ('engine.js', 'app.js'):
        tag = '<script src="%s"></script>' % name
        if tag not in html:
            raise SystemExit('index.html 에 %s 태그가 없습니다' % tag)
        # 소스에 '</script' 가 있으면 인라인이 깨지므로 미리 막는다
        src = read(name)
        if '</script' in src.lower():
            raise SystemExit('%s 에 </script 문자열이 있어 인라인할 수 없습니다' % name)
        html = html.replace(tag, '<script>\n' + src + '\n</script>')
    out = DIR / 'poop-dodge.html'
    out.write_text(html, encoding='utf-8')
    print('Built %s' % out)


if __name__ == '__main__':
    build()
