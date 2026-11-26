#!/usr/bin/env python3
"""Confere o hangar.json. Sai com 1 se algo está errado, e aí o site não é publicado.

O hangar guarda ferramentas para testar depois, à parte do feed. Cada item:
    { "data": "AAAA-MM-DD", "titulo": "...", "link": "https://...", "fonte": "...", "nota": "..." }
Só data (quando foi guardado) e titulo são obrigatórios.

    python3 tools/conferir_hangar.py [caminho do hangar.json]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conferir import NO_GITHUB, data_valida  # noqa: E402

OBRIGATORIOS = ('data', 'titulo')
OPCIONAIS = ('link', 'fonte', 'nota')
CONHECIDOS = set(OBRIGATORIOS) | set(OPCIONAIS)


def conferir(hangar):
    if not isinstance(hangar, list):
        return ['o hangar.json precisa ser uma lista de itens, entre [ e ]'], []

    erros, avisos, vistos = [], [], {}
    for i, e in enumerate(hangar, start=1):
        rot = f'item {i}'
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
        if not isinstance(titulo, str) or not titulo.strip():
            erros.append(f'{rot}: título vazio')
        for campo in OPCIONAIS:
            if campo in e and not isinstance(e[campo], str):
                erros.append(f'{rot}: {campo} precisa ser texto entre aspas')
        link = e.get('link')
        if isinstance(link, str) and link and not link.startswith(('http://', 'https://')):
            erros.append(f'{rot}: link "{link[:40]}" precisa começar com http:// ou https://')
        estranhos = sorted(set(e) - CONHECIDOS)
        if estranhos:
            avisos.append(f'{rot}: campos que o site ignora: {", ".join(estranhos)}')

        # No hangar a mesma ferramenta não aparece duas vezes, em qualquer data.
        if isinstance(titulo, str):
            chave = (link or titulo).strip().lower()
            if chave in vistos:
                erros.append(f'{rot}: repete o item {vistos[chave]} (mesmo {"link" if link else "título"})')
            else:
                vistos[chave] = i
    return erros, avisos


def main():
    caminho = Path(sys.argv[1] if len(sys.argv) > 1 else 'hangar.json')
    if not caminho.exists():
        print(f'{caminho.name} não existe; nada a conferir.')
        return
    try:
        hangar = json.loads(caminho.read_text(encoding='utf-8'))
    except json.JSONDecodeError as x:
        erros, avisos, hangar = [f'o {caminho.name} não é um JSON válido: linha {x.lineno}, coluna {x.colno} ({x.msg}). '
                                 'Costuma ser uma vírgula sobrando ou faltando.'], [], None
    else:
        erros, avisos = conferir(hangar)

    for a in avisos:
        print(f'::warning title=hangar.json::{a}' if NO_GITHUB else f'aviso: {a}')
    for e in erros:
        print(f'::error title=hangar.json::{e}' if NO_GITHUB else f'erro: {e}')
    if erros:
        print(f'\n{len(erros)} erro(s). O site não foi publicado; corrija o {caminho.name} e salve de novo.')
        sys.exit(1)
    print(f'{caminho.name}: {len(hangar)} item(ns), tudo certo.')


if __name__ == '__main__':
    main()
