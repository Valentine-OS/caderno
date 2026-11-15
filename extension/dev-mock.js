// Simulador para testar o popup numa aba comum (http://localhost/.../extension/popup.html).
// Dentro da extensão instalada este arquivo não faz nada: lá o chrome.* é real.
//
// Finge o chrome.storage, a aba aberta e a API do GitHub. Parâmetros na URL:
//   ?config      já começa com um token de teste salvo
//   ?conflito    a primeira gravação responde 409, para testar a nova tentativa
//   ?recusado    o GitHub recusa o token (401)
(function () {
  if (!/^https?:$/.test(location.protocol) || (globalThis.chrome && chrome.storage)) return;

  const p = new URLSearchParams(location.search);
  const memoria = {};
  if (p.has('config')) memoria.config = { token: 'teste', repo: 'Valentine-OS/caderno', site: 'https://valentine-os.github.io/caderno/' };

  const estado = {
    feed: [{ data: '2026-11-10', tipo: 'artigo', titulo: 'Local-first software', link: 'https://www.inkandswitch.com/local-first/' }],
    sha: 'sha-1', gravacoes: [], conflitoPendente: p.has('conflito'),
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

  globalThis.fetch = async (url, opcoes = {}) => {
    if (!String(url).startsWith('https://api.github.com/')) return fetchReal(url, opcoes);
    await new Promise(r => setTimeout(r, 150));
    if (p.has('recusado')) return resposta(401, { message: 'Bad credentials' });
    if ((opcoes.method || 'GET') === 'GET') return resposta(200, { content: b64(JSON.stringify(estado.feed, null, 2)), sha: estado.sha });
    const corpo = JSON.parse(opcoes.body);
    if (estado.conflitoPendente) {
      // Simula alguém gravando no meio: o feed muda e o sha antigo deixa de valer.
      estado.conflitoPendente = false;
      estado.feed = [{ data: '2026-11-12', tipo: 'podcast', titulo: 'Gravado por outro lugar' }, ...estado.feed];
      estado.sha = 'sha-2';
      return resposta(409, { message: 'sha does not match' });
    }
    if (corpo.sha !== estado.sha) return resposta(409, { message: 'sha does not match' });
    estado.feed = JSON.parse(deB64(corpo.content));
    estado.sha = 'sha-' + (Number(estado.sha.split('-')[1]) + 1);
    estado.gravacoes.push({ mensagem: corpo.message, ramo: corpo.branch });
    return resposta(200, { content: { sha: estado.sha } });
  };
})();
