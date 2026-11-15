#!/usr/bin/env python3
"""Confere o feed.json. Sai com 1 se algo está errado, e aí o site não é publicado.

O feed.json tem dois escritores: a extensão e edições à mão no site do GitHub.
Um erro de digitação não deve chegar ao ar; esta conferência roda antes de cada
publicação. Adaptado do validate_data.py do logbook.

    python3 tools/conferir.py [caminho do feed.json]
"""
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

TIPOS = {'curso', 'podcast', 'artigo', 'escrito', 'projeto'}
OBRIGATORIOS = ('data', 'tipo', 'titulo')
OPCIONAIS_TEXTO = ('link', 'fonte', 'nota')
CONHECIDOS = set(OBRIGATORIOS) | set(OPCIONAIS_TEXTO) | {'texto'}
DATA_ISO = re.compile(r'^\d{4}-\d{2}-\d{2}$')
NO_GITHUB = os.environ.get('GITHUB_ACTIONS') == 'true'


def data_valida(v):
    if not isinstance(v, str) or not DATA_ISO.match(v):
        return False
    try:
        date.fromisoformat(v)
        return True
    except ValueError:
        return False


def conferir(feed):
    """Devolve (erros, avisos). Cada mensagem já diz qual entrada e qual campo."""
    if not isinstance(feed, list):
        return ['o feed.json precisa ser uma lista de entradas, entre [ e ]'], []

    erros, avisos = [], []
    vistos = {}

    for i, e in enumerate(feed, start=1):
        rot = f'entrada {i}'
        if not isinstance(e, dict):
            erros.append(f'{rot}: não é um objeto entre {{ e }}')
            continue
        titulo = e.get('titulo')
        if isinstance(titulo, str) and titulo.strip():
            rot = f'{rot} ("{titulo.strip()[:50]}")'

        faltando = [c for c in OBRIGATORIOS if c not in e]
        if faltando:
            erros.append(f'{rot}: falta {", ".join(faltando)}')
            continue

        if not data_valida(e['data']):
            erros.append(f'{rot}: data "{e["data"]}" não é uma data AAAA-MM-DD válida')
        elif e['data'] > date.today().isoformat():
            avisos.append(f'{rot}: data {e["data"]} está no futuro')

        if e['tipo'] not in TIPOS:
            erros.append(f'{rot}: tipo "{e["tipo"]}" não existe; use {", ".join(sorted(TIPOS))}')

        if not isinstance(titulo, str) or not titulo.strip():
            erros.append(f'{rot}: título vazio')

        for campo in OPCIONAIS_TEXTO:
            if campo in e and not isinstance(e[campo], str):
                erros.append(f'{rot}: {campo} precisa ser texto entre aspas')

        link = e.get('link')
        if isinstance(link, str) and link and not link.startswith(('http://', 'https://')):
            erros.append(f'{rot}: link "{link[:40]}" precisa começar com http:// ou https://')

        if 'texto' in e:
            t = e['texto']
            if not isinstance(t, list) or any(not isinstance(p, str) for p in t):
                erros.append(f'{rot}: texto precisa ser uma lista de parágrafos entre aspas')

        estranhos = sorted(set(e) - CONHECIDOS)
        if estranhos:
            avisos.append(f'{rot}: campos que o site ignora: {", ".join(estranhos)}')

        # Duplicata: mesmo link no mesmo dia, ou, sem link, mesmo título no mesmo dia.
        if isinstance(titulo, str) and isinstance(e.get('data'), str):
            chave = (e['data'], (link or titulo).strip().lower())
            if chave in vistos:
                erros.append(f'{rot}: repete a entrada {vistos[chave]} (mesmo dia e mesmo {"link" if link else "título"})')
            else:
                vistos[chave] = i

    return erros, avisos


def main():
    caminho = Path(sys.argv[1] if len(sys.argv) > 1 else 'feed.json')
    try:
        feed = json.loads(caminho.read_text(encoding='utf-8'))
    except FileNotFoundError:
        erros, avisos, feed = [f'{caminho} não existe'], [], None
    except json.JSONDecodeError as x:
        erros, avisos, feed = [f'o {caminho.name} não é um JSON válido: linha {x.lineno}, coluna {x.colno} ({x.msg}). '
                               'Costuma ser uma vírgula sobrando ou faltando.'], [], None
    else:
        erros, avisos = conferir(feed)

    for a in avisos:
        print(f'::warning title=feed.json::{a}' if NO_GITHUB else f'aviso: {a}')
    for e in erros:
        print(f'::error title=feed.json::{e}' if NO_GITHUB else f'erro: {e}')

    if erros:
        print(f'\n{len(erros)} erro(s). O site não foi publicado; corrija o {caminho.name} e salve de novo.')
        sys.exit(1)
    total = len(feed) if isinstance(feed, list) else 0
    print(f'{caminho.name}: {total} entrada(s), tudo certo.')


if __name__ == '__main__':
    main()
