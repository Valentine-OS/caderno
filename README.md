# caderno.

[![Feito com IA: Claude](https://img.shields.io/badge/feito%20com%20IA-Claude-1d4b80?style=flat-square)](#feito-com-ia)

O que ando estudando, lendo, ouvindo, escrevendo e construindo. Em público.

**→ [valentine-os.github.io/caderno](https://valentine-os.github.io/caderno/)**

Um feed de tudo que eu termino para aprender: cursos concluídos, podcasts, artigos, textos meus e projetos. Cada coisa entra uma vez, no dia em que acabou, com uma linha sobre o que ficou dela.

A página imita uma prancha de desenho técnico: folha azul quadriculada, traço branco, cotas e um F-16 cujas peças numeradas servem de filtro. Clicar numa entrada abre a ficha dela, como o quadro de especificações no canto de um blueprint.

Quer ver a página cheia antes de eu ter registrado muita coisa? Abra com dados de exemplo: [valentine-os.github.io/caderno/?exemplo](https://valentine-os.github.io/caderno/?exemplo).

## Como funciona

Não tem servidor nem banco de dados. Tudo que aparece no site mora num único arquivo, o [`feed.json`](feed.json), e a página é HTML, CSS e JavaScript puros que leem esse arquivo no navegador. O GitHub Pages publica cada mudança em menos de um minuto.

Para registrar algo, eu acrescento uma entrada no `feed.json`:

```json
{
  "data": "2026-11-10",
  "tipo": "artigo",
  "titulo": "Local-first software",
  "link": "https://www.inkandswitch.com/local-first/",
  "fonte": "Ink & Switch",
  "nota": "Sincronização é o problema difícil; o resto é detalhe."
}
```

Os tipos são `curso`, `podcast`, `artigo`, `escrito` e `projeto`. Só `data`, `tipo` e `titulo` são obrigatórios.

Antes de cada publicação, uma GitHub Action confere o `feed.json` inteiro e gera o [RSS](https://valentine-os.github.io/caderno/feed.xml). Se algo estiver errado, como uma data impossível ou uma vírgula sobrando, nada é publicado, o site continua como estava e a Action diz qual entrada corrigir.

## Escritos longos

Textos meus mais longos não cabem bem numa entrada do `feed.json`. Cada um vira um arquivo `.md` na pasta [`escritos/`](escritos/), com um cabeçalho e o texto embaixo:

```markdown
---
titulo: O nome do texto
data: 2026-11-20
nota: Uma frase sobre o que ficou.
---

Primeiro parágrafo.

Segundo parágrafo, depois de uma linha em branco.
```

Na publicação, eles entram no feed como escritos e abrem inteiros na ficha. O [`_modelo.md`](escritos/_modelo.md) está lá para copiar; arquivos que começam com `_` não vão para o site. Por enquanto o texto é só parágrafos: negrito, itálico e links em Markdown aparecem como foram escritos.

## Registrar pela extensão

Na pasta [`extension/`](extension/) há uma extensão para Chrome e navegadores parecidos. Na página do artigo, curso ou podcast que acabei de terminar, abro a extensão: ela já traz título, link e fonte, eu escolho o tipo, escrevo o que ficou e clico em Registrar. A extensão grava a entrada no `feed.json` pela API do GitHub, e a publicação segue o caminho normal.

Para instalar: em `chrome://extensions`, ligue o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e escolha a pasta `extension`. Na primeira abertura ela pede um token do GitHub restrito a este repositório, com permissão **Contents: Read and write**. O token fica guardado só naquele navegador.

## Rodar no computador

A extensão grava direto no GitHub, então antes de mexer no código localmente vale um `git pull`. A página precisa ser aberta por um servidor local, porque lê o `feed.json` pela rede; os escritos longos só aparecem no site publicado, porque são juntados ao feed na publicação. Qualquer servidor estático serve, por exemplo:

```bash
python -m http.server
```

e depois `http://localhost:8000/`.

## Feito com IA

Este site foi desenvolvido com IA. O código, o visual e este README foram escritos pelo Claude, da Anthropic, numa conversa comigo. A ideia, as escolhas e o conteúdo do feed são meus; a programação não.

## Créditos

Os desenhos técnicos são de domínio público, via Wikimedia Commons: o F-16 em três vistas, da Força Aérea dos Estados Unidos, e o esquema do Saturn V, da NASA. As fontes são Barlow, Barlow Condensed e IBM Plex Mono, do Google Fonts.
