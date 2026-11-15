import { hoje, montarEntrada, conferirEntrada, repetida, posicaoDe } from './regras.js';
import { atualizarFeed, lerFeed } from './github.js';

const $ = (id) => document.getElementById(id);
const PADRAO = { token: '', repo: 'Valentine-OS/caderno', site: 'https://lurzzo.com/' };
const CAMPOS = ['titulo', 'link', 'fonte', 'data', 'nota', 'texto'];
const QUANTOS_RECENTES = 15;

// Quando não é nulo, o formulário está editando esta entrada (a cópia exata lida do feed).
let editando = null;

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
  for (const id of ['registro', 'feito', 'recentes', 'config']) $(id).hidden = id !== tela;
  $('ir-registro').classList.toggle('atual', tela === 'registro' && !editando);
  $('ir-recentes').classList.toggle('atual', tela === 'recentes' || (tela === 'registro' && !!editando));
  $('ir-config').classList.toggle('atual', tela === 'config');
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
// O mesmo formulário serve para registrar e para editar.
function modoDoFormulario() {
  $('registrar').textContent = editando ? 'Salvar alteração' : 'Registrar';
  $('limpar').hidden = !!editando;
  $('cancelar-edicao').hidden = !editando;
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
  editando = null;
  modoDoFormulario();
  avisar('aviso', '');
  const rascunho = recapturar ? null : await lerRascunho();
  preencher(rascunho || await capturar());
  mostrar('registro');
  $('titulo').focus();
}

function abrirEdicao(entrada) {
  editando = entrada;
  modoDoFormulario();
  avisar('aviso', '');
  preencher({ ...entrada, texto: (entrada.texto || []).join('\n\n') });
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

function mostrarFeito(titulo, texto, config) {
  $('feito-titulo').textContent = titulo;
  $('feito-texto').textContent = texto;
  $('ver-site').href = config.site;
  $('ver-actions').href = `https://github.com/${config.repo}/actions`;
  mostrar('feito');
}

/* ---------- recentes: editar e excluir ---------- */
async function abrirRecentes(mensagem = '') {
  editando = null;
  const config = await lerConfig();
  if (!config.token) return abrirConfig();
  mostrar('recentes');
  avisar('aviso-recentes', '');
  avisar('ok-recentes', mensagem);
  const lista = $('lista-recentes');
  lista.replaceChildren();
  const carregando = document.createElement('li');
  carregando.className = 'vazia';
  carregando.textContent = 'Lendo o feed…';
  lista.append(carregando);

  let feed;
  try {
    ({ feed } = await lerFeed(config));
  } catch (e) {
    lista.replaceChildren();
    return avisar('aviso-recentes', e.message);
  }

  lista.replaceChildren();
  const recentes = feed
    .filter(e => e && typeof e === 'object' && e.titulo)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .slice(0, QUANTOS_RECENTES);
  if (!recentes.length) {
    const li = document.createElement('li');
    li.className = 'vazia';
    li.textContent = 'Nada registrado ainda.';
    return lista.append(li);
  }
  for (const entrada of recentes) lista.append(itemDaLista(entrada, config));
}

function itemDaLista(entrada, config) {
  const li = document.createElement('li');
  const rotulo = document.createElement('div');
  rotulo.className = 'rotulo';
  rotulo.textContent = [entrada.data, entrada.tipo, entrada.fonte].filter(Boolean).join(' · ');
  const titulo = document.createElement('div');
  titulo.className = 'titulo';
  titulo.textContent = entrada.titulo;
  const acoes = document.createElement('div');
  acoes.className = 'acoes';

  const editar = document.createElement('button');
  editar.type = 'button';
  editar.className = 'link';
  editar.textContent = 'editar';
  editar.addEventListener('click', () => abrirEdicao(entrada));

  // Excluir pede um segundo toque, para um clique distraído não apagar nada.
  const excluir = document.createElement('button');
  excluir.type = 'button';
  excluir.className = 'link';
  excluir.textContent = 'excluir';
  let armado = null;
  excluir.addEventListener('click', async () => {
    if (!armado) {
      excluir.textContent = 'toque de novo para excluir';
      excluir.classList.add('perigo');
      armado = setTimeout(() => { armado = null; excluir.textContent = 'excluir'; excluir.classList.remove('perigo'); }, 4000);
      return;
    }
    clearTimeout(armado);
    excluir.disabled = editar.disabled = true;
    excluir.textContent = 'excluindo…';
    try {
      await atualizarFeed(config, (feed) => {
        const i = posicaoDe(feed, entrada);
        if (i < 0) throw new Error('Essa entrada mudou no GitHub desde que a lista foi lida. Recarregue a lista e tente de novo.');
        return feed.filter((_, j) => j !== i);
      }, `exclusão: ${entrada.titulo}`);
      abrirRecentes(`"${entrada.titulo}" foi excluída. Some do site em cerca de um minuto.`);
    } catch (e) {
      avisar('aviso-recentes', e.message);
      excluir.disabled = editar.disabled = false;
      excluir.textContent = 'excluir';
      excluir.classList.remove('perigo');
      armado = null;
    }
  });

  acoes.append(editar, excluir);
  li.append(rotulo, titulo, acoes);
  return li;
}

/* ---------- ações ---------- */
document.querySelectorAll('input[name="tipo"]').forEach(r => r.addEventListener('change', () => {
  ajustarTexto();
  if (!editando) salvarRascunho(lerFormulario());
}));
// O rascunho guarda só o registro novo; uma edição em andamento não o sobrescreve.
$('registro').addEventListener('input', () => { if (!editando) salvarRascunho(lerFormulario()); });
$('limpar').addEventListener('click', async () => { await apagarRascunho(); abrirRegistro({ recapturar: true }); });
$('cancelar-edicao').addEventListener('click', () => abrirRecentes());
$('ir-registro').addEventListener('click', () => abrirRegistro());
$('ir-recentes').addEventListener('click', () => abrirRecentes());
$('recarregar').addEventListener('click', () => abrirRecentes());
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

  const original = editando;
  avisar('aviso', '');
  $('registrar').disabled = true;
  $('registrar').textContent = 'Gravando…';
  try {
    if (original) {
      await atualizarFeed(config, (feed) => {
        const i = posicaoDe(feed, original);
        if (i < 0) throw new Error('Essa entrada mudou no GitHub desde que foi aberta. Volte aos recentes, recarregue e edite de novo.');
        if (repetida(feed, entrada, i)) throw new Error('Já existe outra entrada com essa data e esse link ou título.');
        return feed.map((x, j) => (j === i ? entrada : x));
      }, `edição: ${entrada.titulo}`);
      editando = null;
      mostrarFeito('Alteração salva.', 'O site mostra a versão nova em cerca de um minuto, depois que a conferência do GitHub passar.', config);
    } else {
      await atualizarFeed(config, (feed) => {
        if (repetida(feed, entrada)) throw new Error('Isso já está no caderno com essa data.');
        return [entrada, ...feed];
      }, `registro: ${entrada.titulo}`);
      await apagarRascunho();
      mostrarFeito('Registrado.', 'Aparece no site em cerca de um minuto, depois que a conferência do GitHub passar.', config);
    }
  } catch (e) {
    // O que foi digitado continua no formulário (e, num registro novo, no rascunho).
    avisar('aviso', e.message || 'Não deu para gravar. Tente de novo.');
  } finally {
    $('registrar').disabled = false;
    modoDoFormulario();
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
