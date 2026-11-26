// Leitura e gravação de listas JSON do repositório (feed.json e hangar.json) pela API do GitHub.
// Adaptado do utils/github.js do logbook: lê, aplica a mudança, grava; em conflito,
// relê e tenta mais uma vez, em vez de perder o que foi digitado.

const API = 'https://api.github.com';

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

async function erroDe(res, arquivo) {
  const corpo = await res.json().catch(() => ({}));
  const msg = res.status === 401 ? 'O token foi recusado. Confira se ele não expirou.'
    : res.status === 403 ? 'O token não tem permissão para gravar neste repositório.'
    : res.status === 404 ? `Repositório ou ${arquivo} não encontrado. Confira o nome do repositório e o acesso do token.`
    : corpo.message || `O GitHub respondeu ${res.status}.`;
  const e = new Error(msg);
  e.status = res.status;
  return e;
}

/**
 * Lê uma lista JSON do repositório. Devolve { feed, sha }.
 * Com `podeFaltar`, um arquivo que ainda não existe vale como lista vazia (sha nulo).
 */
export async function lerArquivo({ token, repo, ramo = 'main' }, arquivo, { podeFaltar = false } = {}) {
  const res = await fetch(`${API}/repos/${repo}/contents/${arquivo}?ref=${encodeURIComponent(ramo)}`, { headers: cabecalhos(token), cache: 'no-store' });
  if (res.status === 404 && podeFaltar) return { feed: [], sha: null };
  if (!res.ok) throw await erroDe(res, arquivo);
  const dados = await res.json();
  let feed;
  try {
    feed = JSON.parse(deBase64(dados.content));
  } catch {
    throw new Error(`O ${arquivo} no GitHub está com erro de JSON. Corrija no site do GitHub antes de gravar.`);
  }
  if (!Array.isArray(feed)) throw new Error(`O ${arquivo} no GitHub precisa ser uma lista entre [ e ].`);
  return { feed, sha: dados.sha };
}

async function gravarArquivo({ token, repo, ramo = 'main' }, arquivo, lista, sha, mensagem) {
  const corpo = { message: mensagem, content: paraBase64(JSON.stringify(lista, null, 2) + '\n'), branch: ramo };
  if (sha) corpo.sha = sha;
  const res = await fetch(`${API}/repos/${repo}/contents/${arquivo}`, { method: 'PUT', headers: cabecalhos(token), body: JSON.stringify(corpo) });
  if (!res.ok) throw await erroDe(res, arquivo);
  return res.json();
}

/**
 * Rota única de escrita: lê, aplica `mudar(lista)` e grava.
 * `mudar` devolve a lista nova, ou lança um erro para desistir sem gravar.
 * Se alguém gravou entre a leitura e a gravação (409/422), relê e tenta mais uma vez.
 */
export async function atualizarArquivo(config, arquivo, mudar, mensagem, opcoes = {}) {
  for (let tentativa = 0; ; tentativa++) {
    const { feed, sha } = await lerArquivo(config, arquivo, opcoes);
    const nova = mudar(feed);
    try {
      return await gravarArquivo(config, arquivo, nova, sha, mensagem);
    } catch (e) {
      if (tentativa === 0 && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}

export const lerFeed = (config) => lerArquivo(config, 'feed.json');
export const atualizarFeed = (config, mudar, mensagem) => atualizarArquivo(config, 'feed.json', mudar, mensagem);
// O hangar.json pode ainda não existir no repositório: nesse caso a primeira gravação o cria.
export const lerHangar = (config) => lerArquivo(config, 'hangar.json', { podeFaltar: true });
export const atualizarHangar = (config, mudar, mensagem) => atualizarArquivo(config, 'hangar.json', mudar, mensagem, { podeFaltar: true });
