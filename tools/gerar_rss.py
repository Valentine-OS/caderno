#!/usr/bin/env python3
"""Gera o feed.xml (RSS 2.0) a partir do feed.json. Só biblioteca padrão.

Adaptado do gen_feed.py do logbook. Cada item aponta para a folha de diário da
entrada no site (#ler/<chave>), com o link original no corpo.

    python3 tools/gerar_rss.py [feed.json] [saída.xml]

O endereço do site vem de SITE_URL ou, nas Actions, do nome do repositório
(https://<dono>.github.io/<repo>/). Quando o lurzzo.com apontar para cá, basta
definir SITE_URL=https://lurzzo.com/ no workflow.
"""
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

LIMITE = 30
TITULO = 'caderno.'
DESCRICAO = 'O que ando estudando, lendo, ouvindo, escrevendo e construindo. Em público.'


def endereco_do_site():
    url = os.environ.get('SITE_URL', '').strip()
    if not url:
        repo = os.environ.get('GITHUB_REPOSITORY', 'Valentine-OS/caderno')
        dono, nome = repo.split('/', 1)
        url = f'https://{dono.lower()}.github.io/{nome}/'
    return url if url.endswith('/') else url + '/'


def chave(e):
    """A mesma chave que o caderno.js usa no endereço #ler/<chave>."""
    t = unicodedata.normalize('NFD', e['titulo'].lower())
    t = ''.join(c for c in t if not '̀' <= c <= 'ͯ')
    return e['data'] + '-' + re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def rfc2822(iso):
    return format_datetime(datetime.fromisoformat(iso).replace(hour=12, tzinfo=timezone.utc))


def item(e, base):
    corpo = []
    if e.get('nota'):
        corpo.append(e['nota'].strip())
    if isinstance(e.get('texto'), list):
        corpo.extend(p.strip() for p in e['texto'] if isinstance(p, str) and p.strip())
    if e.get('link'):
        corpo.append(f'Original: {e["link"]}')
    titulo = e['titulo'].strip()
    if e.get('fonte'):
        titulo += f' · {e["fonte"].strip()}'
    return (
        '<item>'
        f'<title>{escape(titulo)}</title>'
        f'<link>{escape(base)}#ler/{escape(chave(e))}</link>'
        f'<guid isPermaLink="false">{escape(chave(e))}</guid>'
        f'<pubDate>{rfc2822(e["data"])}</pubDate>'
        f'<category>{escape(e["tipo"])}</category>'
        f'<description>{escape(chr(10).join(corpo))}</description>'
        '</item>'
    )


def main():
    origem = Path(sys.argv[1] if len(sys.argv) > 1 else 'feed.json')
    destino = Path(sys.argv[2] if len(sys.argv) > 2 else 'feed.xml')
    feed = json.loads(origem.read_text(encoding='utf-8'))
    base = endereco_do_site()
    entradas = sorted(feed, key=lambda e: e['data'], reverse=True)[:LIMITE]

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
        f'<title>{escape(TITULO)}</title>'
        f'<link>{escape(base)}</link>'
        f'<description>{escape(DESCRICAO)}</description>'
        '<language>pt-BR</language>'
        f'<lastBuildDate>{format_datetime(datetime.now(timezone.utc))}</lastBuildDate>'
        f'<atom:link href="{escape(base)}feed.xml" rel="self" type="application/rss+xml"/>'
        + ''.join(item(e, base) for e in entradas)
        + '</channel></rss>\n'
    )
    destino.write_text(xml, encoding='utf-8')
    resumo = f'{destino.name}: {len(entradas)} item(ns), endereço {base}'
    if entradas:
        resumo += f'; o mais recente é "{entradas[0]["titulo"]}"'
    print(f'::notice title=RSS::{resumo}' if os.environ.get('GITHUB_ACTIONS') == 'true' else resumo)


if __name__ == '__main__':
    main()
