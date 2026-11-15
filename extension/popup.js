import { hoje, montarEntrada, conferirEntrada, repetida } from './regras.js';
import { atualizarFeed, lerFeed } from './github.js';

const $ = (id) => document.getElementById(id);
const PADRAO = { token: '', repo: 'Valentine-OS/caderno', site: 'https://valentine-os.github.io/caderno/' };
const CAMPOS = ['titulo', 'link', 'fonte', 'data', 'nota', 'texto'];

// Configuração e rascunho ficam no storage.local: o token não deve ser sincronizado
// para outros aparelhos da conta do navegador (mesma escolha do logbook).
async function lerConfig() {
  const { config } = await chrome.storage.local.get('config');
  return { ...PADRAO, ...(config || {}) };
}
const salvarConfig = (config) => chrome.storage.local.set({ config });
const lerRascunho = async () => (await chrome.storage.local.get('rascunho')).rascunho || null;
const salvarRascunho = (rascunho) => chrome.storage.local.set({ rascunho });
const apagarRascunho = () => chrome.storage.local.remove('rascunho');

function mostrar(tela) {
  for (const id of ['registro', 'feito', 'config']) $(id).hidden = id !== tela;
}
function avisar(id, msg) {
  $(id).textContent = msg || '';
  $(id).hidden = !msg;
}

/* ---------- formulário ---------- */
function tipoMarcado() {
  return document.querySelector('input[name="tipo"]:checked')?.value || '';
}
function lerFormulario() {
  const f = { tipo: tipoMarcado() };
  for (const c of CAMPOS) f[c] = $(c).value;
  return f;
}
function preencher(f) {
  for (const c of CAMPOS) $(c).value = f[c] || '';
  if (!$('data').value) $('data').value = hoje();
  const radio = document.querySelector(`input[name="tipo"][value="${f.tipo || 'artigo'}"]`);
  if (radio) radio.checked = true;
  ajustarTexto();
}
// O campo de texto só aparece para escritos curtos.
function ajustarTexto() {
  $('campo-texto').hidden = tipoMarcado() !== 'escrito';
}

/* ---------- raspagem da página aberta ---------- */
// Roda dentro da página. Precisa ser autocontida: não enxerga nada deste arquivo.
// Simplificada da scrapePage do logbook.
function rasparPagina() {
  const meta = (...nomes) => {
    for (const n of nomes) {
      const el = document.querySelector(`meta[name="${n}"], meta[property="${n}"]`);
      if (el?.content?.trim()) return el.content.trim();
    }
    return '';
  };
  let ld = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const d = JSON.parse(s.textContent);
      const nos = Array.isArray(d) ? d : Array.isArray(d['@graph']) ? d['@graph'] : [d];
      ld = nos.find(n => n && (n.headline || n.name) && n['@type']) || ld;
      if (ld) break;
    } catch {}
  }
  const autor = ld?.author ? (Array.isArray(ld.author) ? ld.author.map(a => a?.name).filter(Boolean).join(', ') : ld.author.name) : '';
  return {
    titulo: meta('og:title', 'twitter:title') || ld?.headline || document.title || '',
    link: document.querySelector('link[rel="canonical"]')?.href || location.href,
    autor: meta('author') || autor || '',
    site: meta('og:site_name', 'application-name') || '',
    dominio: location.hostname.replace(/^www\./, ''),
  };
}

function palpiteDeTipo(url) {
  const u = (url || '').toLowerCase();
  if (/open\.spotify\.com\/(episode|show)|podcasts\.apple\.com|pocketcasts|overcast\.fm|castbox|podcast/.test(u)) return 'podcast';
  if (/udemy|coursera|alura|pluralsight|edx\.org|egghead|domestika|rocketseat|linkedin\.com\/learning|frontendmasters|exercism/.test(u)) return 'curso';
  return 'artigo';
}

// Tira do título o nome do site que muitos colocam no fim ("Título | Site").
function limparTitulo(titulo, site) {
  let t = (titulo || '').replace(/\s+/g, ' ').trim();
  if (site) {
    const sufixo = new RegExp(`\\s*[|·•—–-]\\s*${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    t = t.replace(sufixo, '');
  }
  return t;
}

async function capturar() {
  const vazio = { tipo: 'artigo', data: hoje() };
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!aba?.id || !/^https?:/i.test(aba.url || '')) return vazio;
    const [{ result: r }] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: rasparPagina });
    return {
      tipo: palpiteDeTipo(r.link),
      titulo: limparTitulo(r.titulo, r.site),
      link: r.link,
      fonte: r.autor || r.site || r.dominio,
      data: hoje(),
    };
  } catch {
    // Páginas do próprio navegador e da loja de extensões não deixam ler: formulário em branco.
    return vazio;
  }
}

/* ---------- telas ---------- */
async function abrirRegistro({ recapturar = false } = {}) {
  avisar('aviso', '');
  const rascunho = recapturar ? null : await lerRascunho();
  preencher(rascunho || await capturar());
  mostrar('registro');
  $('titulo').focus();
}

async function abrirConfig() {
  const c = await lerConfig();
  $('token').value = c.token;
  $('repo').value = c.repo;
  $('site').value = c.site;
  $('voltar').hidden = !c.token;
  avisar('aviso-config', '');
  mostrar('config');
}

/* ---------- ações ---------- */
document.querySelectorAll('input[name="tipo"]').forEach(r => r.addEventListener('change', () => { ajustarTexto(); salvarRascunho(lerFormulario()); }));
$('registro').addEventListener('input', () => salvarRascunho(lerFormulario()));
$('limpar').addEventListener('click', async () => { await apagarRascunho(); abrirRegistro({ recapturar: true }); });
$('ir-config').addEventListener('click', abrirConfig);
$('voltar').addEventListener('click', () => abrirRegistro());
$('outro').addEventListener('click', () => abrirRegistro({ recapturar: true }));

$('registro').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = lerFormulario();
  const entrada = montarEntrada({ ...f, texto: f.tipo === 'escrito' ? f.texto : '' });
  const erros = conferirEntrada(entrada);
  if (erros.length) return avisar('aviso', erros.join(' '));

  const config = await lerConfig();
  if (!config.token) return abrirConfig();

  avisar('aviso', '');
  $('registrar').disabled = true;
  $('registrar').textContent = 'Gravando…';
  try {
    await atualizarFeed(config, (feed) => {
      if (repetida(feed, entrada)) throw new Error('Isso já está no caderno com essa data.');
      return [entrada, ...feed];
    }, `registro: ${entrada.titulo}`);
    await apagarRascunho();
    $('ver-site').href = config.site;
    $('ver-actions').href = `https://github.com/${config.repo}/actions`;
    mostrar('feito');
  } catch (e) {
    // O rascunho continua salvo: nada do que foi digitado se perde.
    avisar('aviso', e.message || 'Não deu para gravar. Tente de novo.');
  } finally {
    $('registrar').disabled = false;
    $('registrar').textContent = 'Registrar';
  }
});

$('config').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const config = {
    token: $('token').value.trim(),
    repo: $('repo').value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$|\/$/g, ''),
    site: $('site').value.trim() || PADRAO.site,
  };
  if (!config.token) return avisar('aviso-config', 'Cole o token do GitHub.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(config.repo)) return avisar('aviso-config', 'O repositório precisa estar no formato dono/repositorio.');
  await salvarConfig(config);
  $('salvar').disabled = true;
  $('salvar').textContent = 'Testando…';
  try {
    const { feed } = await lerFeed(config);
    avisar('aviso-config', '');
    await abrirRegistro();
    console.info(`caderno: acesso confirmado, ${feed.length} entrada(s) no feed`);
  } catch (e) {
    avisar('aviso-config', e.message);
  } finally {
    $('salvar').disabled = false;
    $('salvar').textContent = 'Salvar e testar';
  }
});

/* ---------- início ---------- */
(async () => {
  const c = await lerConfig();
  if (c.token) abrirRegistro();
  else abrirConfig();
})();
