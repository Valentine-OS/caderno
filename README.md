# caderno.

O que ando estudando, lendo, ouvindo, escrevendo e construindo. Em público.

Site estático numa página só. Tudo o que aparece vem do `feed.json`.

## Ver no computador

A página lê o `feed.json` pela rede, então precisa de um servidor local; aberta direto do disco, ela avisa que não conseguiu ler o feed.

No Claude Code, o servidor se chama `caderno-site` e serve esta pasta em `http://localhost:8139/`.

- `http://localhost:8139/` mostra o feed real.
- `http://localhost:8139/?exemplo` mostra a página cheia, com os dados inventados do `feed.exemplo.json`.

## Registrar algo

Por enquanto, à mão: acrescente uma entrada no `feed.json` e salve. A extensão de navegador vem depois.

```json
[
  {
    "data": "2026-11-15",
    "tipo": "artigo",
    "titulo": "Título do que foi concluído",
    "link": "https://exemplo.com/artigo",
    "fonte": "Autor ou site",
    "nota": "Uma ou duas frases sobre o que ficou."
  }
]
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `data` | Sim | `AAAA-MM-DD`, o dia em que foi concluído |
| `tipo` | Sim | `curso`, `podcast`, `artigo`, `escrito` ou `projeto` |
| `titulo` | Sim | Texto curto |
| `link` | Não | Endereço começando com `http` ou `https` |
| `fonte` | Não | Autor, site ou programa |
| `nota` | Não | O que ficou, em uma ou duas frases |
| `texto` | Não | Lista de parágrafos, para escritos curtos |

Entre uma entrada e outra vai uma vírgula. Uma entrada com problema (data inválida, tipo desconhecido, título vazio) não aparece na página, e o motivo fica no console do navegador.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | A página |
| `caderno.css` | O visual blueprint |
| `caderno.js` | Lê o feed e desenha a página |
| `feed.json` | Todas as entradas |
| `feed.exemplo.json` | Dados inventados, só para ver a página cheia |
| `desenhos/` | Desenhos técnicos de domínio público (F-16 da Força Aérea americana e Saturn V da NASA, via Wikimedia Commons) |
