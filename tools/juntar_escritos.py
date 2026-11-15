#!/usr/bin/env python3
"""Junta os escritos longos de escritos/ ao feed e grava o feed publicado.

Cada escrito é um arquivo .md com um cabeçalho e o texto embaixo:

    ---
    titulo: O nome do texto
    data: 2026-11-20
    nota: Uma frase sobre o que ficou (opcional).
    ---

    Primeiro parágrafo. Pode ocupar várias linhas.

    Segundo parágrafo, depois de uma linha em branco.

Arquivos que começam com _ (como _modelo.md) são ignorados. O texto é tratado
como parágrafos simples; formatação Markdown aparece como está escrita.

    python3 tools/juntar_escritos.py feed.json escritos/ _site/feed.json
"""
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

NO_GITHUB = os.environ.get('GITHUB_ACTIONS') == 'true'
CAMPOS = {'titulo', 'data', 'nota'}


def ler_escrito(caminho):
    """Devolve (entrada, erros) de um arquivo de escrito."""
    texto = caminho.read_text(encoding='utf-8').replace('\r\n', '\n').lstrip('﻿')
    m = re.match(r'^---\n(.*?)\n---\n?(.*)$', texto, re.S)
    if not m:
        return None, ['falta o cabeçalho entre duas linhas com ---']

    cabecalho, corpo = m.groups()
    campos, erros = {}, []
    for n, linha in enumerate(cabecalho.split('\n'), start=2):
        if not linha.strip():
            continue
        if ':' not in linha:
            erros.append(f'linha {n} do cabeçalho não está no formato "campo: valor"')
            continue
        chave, valor = (p.strip() for p in linha.split(':', 1))
        if len(valor) >= 2 and valor[0] == valor[-1] and valor[0] in '"\'':
            valor = valor[1:-1]
        if chave not in CAMPOS:
            erros.append(f'campo "{chave}" não existe; use titulo, data e nota')
        else:
            campos[chave] = valor

    if not campos.get('titulo'):
        erros.append('falta o titulo')
    try:
        date.fromisoformat(campos.get('data', ''))
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', campos['data']):
            raise ValueError
    except ValueError:
        erros.append(f'data "{campos.get("data", "")}" não é uma data AAAA-MM-DD válida')

    paragrafos = [' '.join(l.strip() for l in p.split('\n') if l.strip())
                  for p in re.split(r'\n\s*\n', corpo)]
    paragrafos = [p for p in paragrafos if p]
    if not paragrafos:
        erros.append('o texto está vazio')

    if erros:
        return None, erros
    entrada = {'data': campos['data'], 'tipo': 'escrito', 'titulo': campos['titulo']}
    if campos.get('nota'):
        entrada['nota'] = campos['nota']
    entrada['texto'] = paragrafos
    return entrada, []


def main():
    origem = Path(sys.argv[1] if len(sys.argv) > 1 else 'feed.json')
    pasta = Path(sys.argv[2] if len(sys.argv) > 2 else 'escritos')
    destino = Path(sys.argv[3] if len(sys.argv) > 3 else '_site/feed.json')

    feed = json.loads(origem.read_text(encoding='utf-8'))
    arquivos = sorted(f for f in pasta.glob('*.md') if not f.name.startswith('_')) if pasta.is_dir() else []

    escritos, falhas = [], 0
    for arquivo in arquivos:
        entrada, erros = ler_escrito(arquivo)
        for e in erros:
            print(f'::error file={arquivo.as_posix()},title=escrito::{arquivo.name}: {e}' if NO_GITHUB else f'erro: {arquivo.name}: {e}')
        falhas += bool(erros)
        if entrada:
            escritos.append(entrada)

    if falhas:
        print(f'\n{falhas} escrito(s) com erro. O site não foi publicado; corrija e salve de novo.')
        sys.exit(1)

    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(feed + escritos, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    resumo = f'{len(escritos)} escrito(s) longo(s) juntado(s) ao feed'
    if escritos:
        resumo += ': ' + '; '.join(e['titulo'] for e in escritos)
    print(f'::notice title=Escritos::{resumo}' if NO_GITHUB else resumo)


if __name__ == '__main__':
    main()
