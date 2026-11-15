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

Os tipos são `curso`, `podcast`, `artigo`, `escrito` e `projeto`. Só `data`, `tipo` e `titulo` são obrigatórios. Se uma entrada vier com erro, ela simplesmente não aparece, e o resto da página segue normal.

## Rodar no computador

A página precisa ser aberta por um servidor local, porque lê o `feed.json` pela rede. Qualquer servidor estático serve, por exemplo:

```bash
python -m http.server
```

e depois `http://localhost:8000/`.

## Próximos passos

- Uma conferência automática do `feed.json` antes de cada publicação, e o RSS.
- Uma extensão de navegador para registrar a página que estou lendo em poucos segundos.
- Textos longos em arquivos próprios, em `escritos/`.

## Feito com IA

Este site foi desenvolvido com IA. O código, o visual e este README foram escritos pelo Claude, da Anthropic, numa conversa comigo. A ideia, as escolhas e o conteúdo do feed são meus; a programação não.

## Créditos

Os desenhos técnicos são de domínio público, via Wikimedia Commons: o F-16 em três vistas, da Força Aérea dos Estados Unidos, e o esquema do Saturn V, da NASA. As fontes são Barlow, Barlow Condensed e IBM Plex Mono, do Google Fonts.
