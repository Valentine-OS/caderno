import { hoje, montarEntrada, conferirEntrada, repetida, posicaoDe, montarItemHangar, conferirItemHangar, jaNoHangar } from './regras.js';
import { atualizarFeed, lerFeed, atualizarHangar, lerHangar } from './github.js';

const $ = (id) => document.getElementById(id);
const PADRAO = { token: '', repo: 'Valentine-OS/caderno', site: 'https://lurzzo.com/' };
const CAMPOS = ['titulo', 'link', 'fonte', 'data', 'nota', 'texto'];
const QUANTOS_RECENTES = 15;

// Quando não é nulo, o formulário está editando esta entrada (a cópia exata lida do feed).
let editando = null;
// Quando não é nulo, o formulário está registrando este item do hangar ("usei"); ao registrar, ele sai do hangar.
let doHangar = null;
const DIAS_DE_POEIRA = 30;

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
// O mesmo formulário serve para registrar, editar e registrar algo que estava no hangar.
function modoDoFormulario() {
  $('registrar').textContent = editando ? 'Salvar alteração' : doHangar ? 'Registrar e tirar do hangar' : 'Registrar';
  $('guardar').hidden = !!(editando || doHangar);
  $('limpar').hidden = !!(editando || doHangar);
  $('cancelar-edicao').hidden = !(editando || doHangar);
  $('cancelar-edicao').textContent = editando ? 'cancelar a edição' : 'voltar ao hangar';
}
// Só o registro novo comum usa o rascunho; edição e "usei" não o sobrescrevem.
const usaRascunho = () => !editando && !doHangar;

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
  doHangar = null;
  modoDoFormulario();
  avisar('aviso', '');
  const rascunho = recapturar ? null : await lerRascunho();
  preencher(rascunho || await capturar());
  mostrar('registro');
  $('titulo').focus();
}

// "usei": o item do hangar vira um registro novo, já com título, link e fonte.
function abrirUsei(item) {
  editando = null;
  doHangar = item;
  modoDoFormulario();
  avisar('aviso', '');
  preencher({ tipo: 'artigo', titulo: item.titulo, link: item.link, fonte: item.fonte, data: hoje() });
  mostrar('registro');
  $('nota').focus();
}

function abrirEdicao(entrada) {
  doHangar = null;
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
  doHangar = null;
  const config = await lerConfig();
  if (!config.token) return abrirConfig();
  mostrar('recentes');
  avisar('aviso-recentes', '');
  avisar('ok-recentes', mensagem);
  mostrarHangar(config);
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

// A parte do hangar na aba recentes: os mais antigos primeiro, para não ficarem esquecidos.
async function mostrarHangar(config) {
  const lista = $('lista-hangar');
  lista.replaceChildren();
  const linha = (texto) => { const li = document.createElement('li'); li.className = 'vazia'; li.textContent = texto; lista.append(li); };
  linha('Lendo o hangar…');
  let hangar;
  try {
    ({ feed: hangar } = await lerHangar(config));
  } catch (e) {
    lista.replaceChildren();
    return avisar('aviso-recentes', e.message);
  }
  lista.replaceChildren();
  const itens = hangar.filter(x => x && typeof x === 'object' && x.titulo).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  if (!itens.length) return linha('Nada no hangar.');
  for (const item of itens) lista.append(itemDoHangar(item, config));
}

function diasDesde(iso) {
  const d = new Date(String(iso) + 'T00:00:00');
  const h = new Date(hoje() + 'T00:00:00');
  return isNaN(d) ? 0 : Math.max(0, Math.round((h - d) / 864e5));
}

function itemDoHangar(item, config) {
  const li = document.createElement('li');
  const dias = diasDesde(item.data);
  if (dias >= DIAS_DE_POEIRA) li.classList.add('poeira');
  const rotulo = document.createElement('div');
  rotulo.className = 'rotulo';
  rotulo.textContent = [dias === 0 ? 'guardado hoje' : dias === 1 ? 'guardado ontem' : `guardado há ${dias} dias`, item.fonte].filter(Boolean).join(' · ');
  const titulo = document.createElement('div');
  titulo.className = 'titulo';
  titulo.textContent = item.titulo;
  const acoes = document.createElement('div');
  acoes.className = 'acoes';

  const usei = document.createElement('button');
  usei.type = 'button';
  usei.className = 'link';
  usei.textContent = 'usei';
  usei.addEventListener('click', () => abrirUsei(item));

  const descartar = document.createElement('button');
  descartar.type = 'button';
  descartar.className = 'link';
  descartar.textContent = 'descartar';
  let armado = null;
  descartar.addEventListener('click', async () => {
    if (!armado) {
      descartar.textContent = 'toque de novo para descartar';
      descartar.classList.add('perigo');
      armado = setTimeout(() => { armado = null; descartar.textContent = 'descartar'; descartar.classList.remove('perigo'); }, 4000);
      return;
    }
    clearTimeout(armado);
    descartar.disabled = usei.disabled = true;
    descartar.textContent = 'descartando…';
    try {
      await atualizarHangar(config, (hangar) => {
        const i = posicaoDe(hangar, item);
        if (i < 0) throw new Error('Esse item mudou no GitHub desde que a lista foi lida. Recarregue e tente de novo.');
        return hangar.filter((_, j) => j !== i);
      }, `hangar: descartado ${item.titulo}`);
      abrirRecentes(`"${item.titulo}" saiu do hangar.`);
    } catch (e) {
      avisar('aviso-recentes', e.message);
      descartar.disabled = usei.disabled = false;
      descartar.textContent = 'descartar';
      descartar.classList.remove('perigo');
      armado = null;
    }
  });

  acoes.append(usei, descartar);
  li.append(rotulo, titulo, acoes);
  return li;
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
  if (usaRascunho()) salvarRascunho(lerFormulario());
}));
// O rascunho guarda só o registro novo comum; edição e "usei" não o sobrescrevem.
$('registro').addEventListener('input', () => { if (usaRascunho()) salvarRascunho(lerFormulario()); });
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
      const item = doHangar;
      await atualizarFeed(config, (feed) => {
        if (repetida(feed, entrada)) throw new Error('Isso já está no caderno com essa data.');
        return [entrada, ...feed];
      }, `registro: ${entrada.titulo}`);
      if (!item) {
        await apagarRascunho();
        mostrarFeito('Registrado.', 'Aparece no site em cerca de um minuto, depois que a conferência do GitHub passar.', config);
      } else {
        // O registro já foi feito; agora o item sai do hangar. Se isso falhar, o registro continua valendo.
        doHangar = null;
        let saiu = true;
        try {
          await atualizarHangar(config, (hangar) => {
            const i = posicaoDe(hangar, item);
            if (i < 0) throw Object.assign(new Error('já saiu'), { jaSaiu: true });
            return hangar.filter((_, j) => j !== i);
          }, `hangar: usado ${item.titulo}`);
        } catch (e) {
          saiu = !!e.jaSaiu; // se já não estava lá, não há nada a fazer
        }
        mostrarFeito('Registrado.', saiu
          ? 'Saiu do hangar e entra no caderno em cerca de um minuto.'
          : 'Entra no caderno em cerca de um minuto, mas não deu para tirar do hangar. Descarte o item na aba recentes.', config);
      }
    }
  } catch (e) {
    // O que foi digitado continua no formulário (e, num registro novo, no rascunho).
    avisar('aviso', e.message || 'Não deu para gravar. Tente de novo.');
  } finally {
    $('registrar').disabled = false;
    modoDoFormulario();
  }
});

// Guardar no hangar: só título, link, fonte e nota, para testar depois.
$('guardar').addEventListener('click', async () => {
  const f = lerFormulario();
  const item = montarItemHangar(f);
  const erros = conferirItemHangar(item);
  if (erros.length) return avisar('aviso', erros.join(' '));

  const config = await lerConfig();
  if (!config.token) return abrirConfig();

  avisar('aviso', '');
  $('guardar').disabled = $('registrar').disabled = true;
  $('guardar').textContent = 'Guardando…';
  try {
    await atualizarHangar(config, (hangar) => {
      if (jaNoHangar(hangar, item)) throw new Error('Isso já está no hangar.');
      return [item, ...hangar];
    }, `hangar: guardado ${item.titulo}`);
    await apagarRascunho();
    mostrarFeito('Guardado no hangar.', `Aparece em ${config.site.replace(/\/?$/, '/')}#hangar em cerca de um minuto. Quando usar, marque "usei" na aba recentes.`, config);
  } catch (e) {
    avisar('aviso', e.message || 'Não deu para guardar. Tente de novo.');
  } finally {
    $('guardar').disabled = $('registrar').disabled = false;
    $('guardar').textContent = 'Guardar no hangar, para testar depois';
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
