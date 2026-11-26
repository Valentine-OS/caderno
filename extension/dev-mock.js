// Simulador para testar o popup numa aba comum (http://localhost/.../extension/popup.html).
// Dentro da extensão instalada este arquivo não faz nada: lá o chrome.* é real.
//
// Finge o chrome.storage, a aba aberta e a API do GitHub (feed.json e hangar.json). Parâmetros na URL:
//   ?config      já começa com um token de teste salvo
//   ?conflito    a primeira gravação responde 409, para testar a nova tentativa
//   ?recusado    o GitHub recusa o token (401)
//   ?semhangar   o hangar.json ainda não existe no repositório
(function () {
  if (!/^https?:$/.test(location.protocol) || (globalThis.chrome && chrome.storage)) return;

  const p = new URLSearchParams(location.search);
  const memoria = {};
  if (p.has('config')) memoria.config = { token: 'teste', repo: 'Valentine-OS/caderno', site: 'https://lurzzo.com/' };

  // Cada arquivo do repositório: a lista e o sha atual (null = o arquivo não existe).
  const arquivos = {
    'feed.json': { lista: [{ data: '2026-11-10', tipo: 'artigo', titulo: 'Local-first software', link: 'https://www.inkandswitch.com/local-first/' }], sha: 'sha-1' },
    'hangar.json': p.has('semhangar') ? { lista: [], sha: null } : {
      lista: [
        { data: '2026-10-01', titulo: 'Bruno', link: 'https://www.usebruno.com/', fonte: 'usebruno.com', nota: 'Cliente de API em arquivos de texto.' },
        { data: '2026-11-24', titulo: 'Zed', link: 'https://zed.dev/', fonte: 'zed.dev', nota: 'Editor rápido.' },
      ],
      sha: 'sha-h1',
    },
  };
  const estado = {
    arquivos, gravacoes: [], conflitoPendente: p.has('conflito'),
    get feed() { return arquivos['feed.json'].lista; }, set feed(v) { arquivos['feed.json'].lista = v; },
    get hangar() { return arquivos['hangar.json'].lista; },
    get sha() { return arquivos['feed.json'].sha; }, set sha(v) { arquivos['feed.json'].sha = v; },
  };
  globalThis.__mock = estado;

  globalThis.chrome = {
    storage: { local: {
      get: async (k) => (typeof k === 'string' ? { [k]: memoria[k] } : { ...memoria }),
      set: async (obj) => { Object.assign(memoria, JSON.parse(JSON.stringify(obj))); },
      remove: async (k) => { delete memoria[k]; },
    } },
    tabs: { query: async () => [{ id: 1, url: 'https://www.exemplo.com/artigos/ownership' }] },
    scripting: { executeScript: async () => [{ result: {
      titulo: 'Entendendo ownership em Rust | Exemplo Blog',
      link: 'https://www.exemplo.com/artigos/ownership?utm_source=x',
      autor: 'Fulana de Tal', site: 'Exemplo Blog', dominio: 'exemplo.com',
    } }] },
  };

  const b64 = (t) => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
  const deB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  const resposta = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchReal = globalThis.fetch.bind(globalThis);
  let contador = 1;

  globalThis.fetch = async (url, opcoes = {}) => {
    if (!String(url).startsWith('https://api.github.com/')) return fetchReal(url, opcoes);
    await new Promise(r => setTimeout(r, 150));
    if (p.has('recusado')) return resposta(401, { message: 'Bad credentials' });
    const nome = decodeURIComponent(String(url).split('/contents/')[1].split('?')[0]);
    const arq = arquivos[nome];
    if (!arq) return resposta(404, { message: 'Not Found' });

    if ((opcoes.method || 'GET') === 'GET') {
      if (arq.sha === null) return resposta(404, { message: 'Not Found' });
      return resposta(200, { content: b64(JSON.stringify(arq.lista, null, 2)), sha: arq.sha });
    }
    const corpo = JSON.parse(opcoes.body);
    if (estado.conflitoPendente && nome === 'feed.json') {
      // Simula alguém gravando no meio: o feed muda e o sha antigo deixa de valer.
      estado.conflitoPendente = false;
      arq.lista = [{ data: '2026-11-12', tipo: 'podcast', titulo: 'Gravado por outro lugar' }, ...arq.lista];
      arq.sha = 'sha-outro';
      return resposta(409, { message: 'sha does not match' });
    }
    if ((corpo.sha || null) !== arq.sha) return resposta(409, { message: 'sha does not match' });
    arq.lista = JSON.parse(deB64(corpo.content));
    arq.sha = `sha-${++contador}`;
    estado.gravacoes.push({ arquivo: nome, mensagem: corpo.message, ramo: corpo.branch });
    return resposta(200, { content: { sha: arq.sha } });
  };
})();
