// Leitura e gravação do feed.json pela API do GitHub.
// Adaptado do utils/github.js do logbook: lê, aplica a mudança, grava; em conflito,
// relê e tenta mais uma vez, em vez de perder o que foi digitado.

const API = 'https://api.github.com';
const ARQUIVO = 'feed.json';

function cabecalhos(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

function paraBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  bytes.forEach(b => (binario += String.fromCharCode(b)));
  return btoa(binario);
}

function deBase64(b64) {
  const binario = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binario, c => c.charCodeAt(0)));
}

async function erroDe(res) {
  const corpo = await res.json().catch(() => ({}));
  const msg = res.status === 401 ? 'O token foi recusado. Confira se ele não expirou.'
    : res.status === 403 ? 'O token não tem permissão para gravar neste repositório.'
    : res.status === 404 ? 'Repositório ou feed.json não encontrado. Confira o nome do repositório e o acesso do token.'
    : corpo.message || `O GitHub respondeu ${res.status}.`;
  const e = new Error(msg);
  e.status = res.status;
  return e;
}

/** Lê o feed.json do repositório. Devolve { feed, sha }. */
export async function lerFeed({ token, repo, ramo = 'main' }) {
  const res = await fetch(`${API}/repos/${repo}/contents/${ARQUIVO}?ref=${encodeURIComponent(ramo)}`, { headers: cabecalhos(token), cache: 'no-store' });
  if (!res.ok) throw await erroDe(res);
  const arquivo = await res.json();
  let feed;
  try {
    feed = JSON.parse(deBase64(arquivo.content));
  } catch {
    throw new Error('O feed.json no GitHub está com erro de JSON. Corrija no site do GitHub antes de registrar.');
  }
  if (!Array.isArray(feed)) throw new Error('O feed.json no GitHub precisa ser uma lista entre [ e ].');
  return { feed, sha: arquivo.sha };
}

async function gravarFeed({ token, repo, ramo = 'main' }, feed, sha, mensagem) {
  const corpo = { message: mensagem, content: paraBase64(JSON.stringify(feed, null, 2) + '\n'), branch: ramo, sha };
  const res = await fetch(`${API}/repos/${repo}/contents/${ARQUIVO}`, { method: 'PUT', headers: cabecalhos(token), body: JSON.stringify(corpo) });
  if (!res.ok) throw await erroDe(res);
  return res.json();
}

/**
 * Rota única de escrita: lê, aplica `mudar(feed)` e grava.
 * `mudar` devolve o feed novo, ou lança um erro para desistir sem gravar.
 * Se alguém gravou entre a leitura e a gravação (409/422), relê e tenta mais uma vez.
 */
export async function atualizarFeed(config, mudar, mensagem) {
  for (let tentativa = 0; ; tentativa++) {
    const { feed, sha } = await lerFeed(config);
    const novo = mudar(feed);
    try {
      return await gravarFeed(config, novo, sha, mensagem);
    } catch (e) {
      if (tentativa === 0 && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}
