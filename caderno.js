// caderno. · lê o feed.json e desenha a página.
// Para ver a página cheia sem mexer no feed real, abra com ?exemplo (lê feed.exemplo.json).

/* ---------- tipos ---------- */
// Acrescentar um tipo novo é acrescentar uma linha aqui (e no validador e na extensão, quando existirem).
const TIPOS = {
  curso:   { plural: 'cursos',   n: '01', peca: 'nariz' },
  podcast: { plural: 'podcasts', n: '02', peca: 'cockpit' },
  artigo:  { plural: 'artigos',  n: '03', peca: 'fuselagem' },
  escrito: { plural: 'escritos', n: '04', peca: 'asa' },
  projeto: { plural: 'projetos', n: '05', peca: 'cauda' },
};

// Os tipos se dividem em dois grupos: o que eu consumi e o que eu criei.
const GRUPOS = {
  consumido: ['curso', 'podcast', 'artigo'],
  criado: ['escrito', 'projeto'],
};
const grupoDe = (tipo) => Object.keys(GRUPOS).find(g => GRUPOS[g].includes(tipo)) || null;

const EXEMPLO = new URLSearchParams(location.search).has('exemplo');
const FONTE = EXEMPLO ? 'feed.exemplo.json' : 'feed.json';
const FONTE_HANGAR = EXEMPLO ? 'hangar.exemplo.json' : 'hangar.json';
let HANGAR = [];
let FEED = [];

/* ---------- desenhos soltos ---------- */
// Os traços vêm de desenhos de domínio público (desenhos/desenhos.js). Aqui ficam só o recorte, as cotas e os rótulos.
const DESENHOS = [
  {
    legenda: 'Fig. 02 · F-16 · vista lateral',
    fonte: 'f16', faixa: [253, 372], viewBox: '144 420 400 186', revela: 'revela-direita',
    extra: `
      <g class="depois">
        <path class="fino" d="M160 556 V594 M527 520 V594"/>
        <line class="fino" x1="160" y1="586" x2="527" y2="586" marker-start="url(#ponta)" marker-end="url(#ponta)"/>
        <text x="343" y="600" text-anchor="middle">15,06 m</text>
        <path class="fino" d="M266 492 L240 452 H184"/><text x="186" y="448">cockpit</text>
        <path class="fino" d="M290 527 L262 560 H200"/><text x="202" y="556">entrada de ar</text>
        <path class="fino" d="M303 546 L326 574 H396"/><text x="330" y="570">trem de pouso</text>
      </g>`,
  },
  {
    legenda: 'Fig. 03 · Saturn V',
    fonte: 'saturno', viewBox: '440 0 520 1395', revela: 'revela-cima', classe: 'alto', pd: 'saturno',
    extra: `
      <g class="depois">
        <path class="fino" d="M450 20 H580 M450 1380 H500"/>
        <line class="fino" x1="460" y1="20" x2="460" y2="1380" marker-start="url(#ponta)" marker-end="url(#ponta)"/>
        <text transform="translate(452 700) rotate(-90)" text-anchor="middle">110,6 m</text>
        <path class="fino" d="M592 70 H700"/><text x="708" y="76">torre de escape</text>
        <path class="fino" d="M606 165 H700"/><text x="708" y="171">módulo de comando</text>
        <path class="fino" d="M612 250 H700"/><text x="708" y="256">módulo de serviço</text>
        <path class="fino" d="M627 480 H700"/><text x="708" y="486">3º estágio</text>
        <path class="fino" d="M648 740 H700"/><text x="708" y="746">2º estágio</text>
        <path class="fino" d="M648 1050 H700"/><text x="708" y="1056">1º estágio</text>
        <path class="fino" d="M672 1355 H700"/><text x="708" y="1361">5 motores F-1</text>
      </g>`,
  },
  {
    legenda: 'Fig. 04 · F-16 · vista frontal',
    fonte: 'f16', faixa: [0, 92], viewBox: '280 214 248 172', revela: 'revela-baixo',
    extra: `
      <g class="depois">
        <path class="fino" d="M290 300 V372 M516 300 V372"/>
        <line class="fino" x1="290" y1="366" x2="516" y2="366" marker-start="url(#ponta)" marker-end="url(#ponta)"/>
        <text x="403" y="380" text-anchor="middle">9,96 m</text>
      </g>`,
  },
];

// Coloca os traços de um desenho de domínio público dentro de um grupo; com faixa, mantém só aquela vista.
function montarPD(alvo, fonte, faixa) {
  alvo.innerHTML = window.DESENHOS_PD ? DESENHOS_PD[fonte] : '';
  if (faixa) [...alvo.querySelectorAll('path')].forEach((p, i) => { if (i < faixa[0] || i >= faixa[1]) p.remove(); });
}

/* ---------- utilidades ---------- */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const $ = id => document.getElementById(id);
const dataCurta = iso => `${iso.slice(8)} ${MESES[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;
const dataLonga = iso => `${Number(iso.slice(8))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
const chaveDe = e => e.data + '-' + e.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function no(pai, tag, texto, classe) {
  const n = document.createElement(tag);
  if (texto != null) n.textContent = texto;
  if (classe) n.className = classe;
  pai.appendChild(n);
  return n;
}
function endereco(hash) {
  try { history.replaceState(null, '', hash || location.pathname + location.search); } catch (e) {}
}

/* ---------- leitura do feed ---------- */
// Uma entrada com problema é ignorada (com aviso no console) em vez de derrubar a página inteira.
// A conferência de verdade fica na ativação do GitHub; isto é só uma rede de segurança.
function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function limpar(bruto, i) {
  const motivo = !bruto || typeof bruto !== 'object' ? 'não é um objeto'
    : !dataValida(bruto.data) ? 'data inválida (use AAAA-MM-DD)'
    : !TIPOS[bruto.tipo] ? `tipo desconhecido: ${bruto.tipo}`
    : typeof bruto.titulo !== 'string' || !bruto.titulo.trim() ? 'título vazio'
    : null;
  if (motivo) { console.warn(`caderno: entrada ${i} ignorada, ${motivo}`, bruto); return null; }
  const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const e = { data: bruto.data, tipo: bruto.tipo, titulo: bruto.titulo.trim(), fonte: texto(bruto.fonte), nota: texto(bruto.nota) };
  if (typeof bruto.link === 'string' && /^https?:\/\//i.test(bruto.link)) e.link = bruto.link;
  if (Array.isArray(bruto.texto)) {
    const paragrafos = bruto.texto.filter(p => typeof p === 'string' && p.trim());
    if (paragrafos.length) e.texto = paragrafos;
  }
  return e;
}

async function carregarFeed() {
  const resposta = await fetch(FONTE, { cache: 'no-cache' });
  if (!resposta.ok) throw new Error(`${FONTE} respondeu ${resposta.status}`);
  const dados = await resposta.json();
  if (!Array.isArray(dados)) throw new Error(`${FONTE} precisa ser uma lista de entradas`);
  return dados.map(limpar).filter(Boolean);
}

/* ---------- filtros: chave de grupo, lista de peças e chamadas do jato ---------- */
// Dois níveis: o grupo (consumido ou criado) e o tipo. Escolher um tipo move a chave para o grupo dele.
// O endereço guarda o mais específico: #artigos, ou #consumido, ou nada.
let filtro = null, grupo = null;
function filtroDoEndereco() {
  const h = decodeURIComponent(location.hash.slice(1));
  filtro = Object.keys(TIPOS).find(t => TIPOS[t].plural === h) || null;
  grupo = filtro ? grupoDe(filtro) : (GRUPOS[h] ? h : null);
}
filtroDoEndereco();
const hashDoFiltro = () => (filtro ? '#' + TIPOS[filtro].plural : grupo ? '#' + grupo : '');

function filtrar(tipo) {
  filtro = tipo;
  if (tipo) grupo = grupoDe(tipo);
  endereco(hashDoFiltro());
  desenhar();
}
function escolherGrupo(g) {
  grupo = g || null;
  filtro = null;
  endereco(hashDoFiltro());
  desenhar();
}
const visivel = (e) => (filtro ? e.tipo === filtro : grupo ? GRUPOS[grupo].includes(e.tipo) : true);

function desenharChave() {
  const caixa = $('chave');
  const botoes = [...caixa.querySelectorAll('button')];
  botoes.forEach((b, i) => {
    const g = b.dataset.grupo || null;
    const qtd = g ? FEED.filter(e => GRUPOS[g].includes(e.tipo)).length : FEED.length;
    b.textContent = g || 'tudo';
    no(b, 'sup', String(qtd));
    b.setAttribute('aria-checked', String(g === grupo));
    b.tabIndex = g === grupo ? 0 : -1;
    if (g === grupo) caixa.dataset.pos = String(i);
  });
}
$('chave').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (b) escolherGrupo(b.dataset.grupo);
});
// Setas trocam de posição, como num grupo de rádio.
$('chave').addEventListener('keydown', ev => {
  if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
  ev.preventDefault();
  const ordem = ['', 'consumido', 'criado'];
  const i = ordem.indexOf(grupo || '');
  escolherGrupo(ordem[(i + (ev.key === 'ArrowRight' ? 1 : 2)) % 3]);
  $('chave').querySelector('[aria-checked="true"]').focus();
});

function desenharPecas() {
  const caixa = $('pecas');
  caixa.replaceChildren();
  const linha = (n, rotulo, peca, tipo, qtd) => {
    const b = no(caixa, 'button');
    no(b, 'span', n);
    const meio = no(b, 'span', rotulo);
    no(meio, 'small', peca);
    no(b, 'span', String(qtd));
    b.setAttribute('aria-pressed', String(tipo ? filtro === tipo : !filtro && !grupo));
    if (tipo && grupo && grupoDe(tipo) !== grupo) b.classList.add('fora');
    b.addEventListener('click', () => (tipo ? filtrar(filtro === tipo ? null : tipo) : escolherGrupo(null)));
  };
  linha('00', 'tudo', 'conjunto', null, FEED.length);
  for (const t in TIPOS) linha(TIPOS[t].n, TIPOS[t].plural, TIPOS[t].peca, t, FEED.filter(e => e.tipo === t).length);
  document.querySelectorAll('.chamada').forEach(c => c.classList.toggle('ativa', c.dataset.tipo === filtro));
  desenharChave();
}
document.querySelectorAll('.chamada').forEach(c => {
  c.addEventListener('click', () => filtrar(filtro === c.dataset.tipo ? null : c.dataset.tipo));
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = `${TIPOS[c.dataset.tipo].peca}: ${TIPOS[c.dataset.tipo].plural}`;
  c.prepend(t);
});

/* ---------- feed ---------- */
const olheiro = new IntersectionObserver(vistos => {
  for (const v of vistos) if (v.isIntersecting) { v.target.classList.add('on'); olheiro.unobserve(v.target); }
}, { rootMargin: '0px 0px -20% 0px' });

function desenharFeed() {
  const feed = $('feed');
  feed.replaceChildren();
  const visiveis = FEED.filter(visivel).sort((a, b) => b.data.localeCompare(a.data));
  if (!visiveis.length) {
    const msg = filtro ? `Nenhum registro em ${TIPOS[filtro].plural} ainda.`
      : grupo ? `Nada ${grupo} registrado ainda.` : 'Nada registrado ainda.';
    no(feed, 'div', msg, 'vazio');
    return;
  }

  const porMes = {};
  for (const e of visiveis) (porMes[e.data.slice(0, 7)] ||= []).push(e);

  Object.keys(porMes).sort().reverse().forEach((chave, i) => {
    const itens = porMes[chave];
    const bloco = no(feed, 'section', null, 'bloco');
    const cota = no(bloco, 'div', null, 'cota');
    no(cota, 'span', null, 'ln a');
    no(cota, 'span', `${MESES[Number(chave.slice(5)) - 1]} ${chave.slice(0, 4)} · ${itens.length}`, 'rot');
    no(cota, 'span', null, 'ln b');

    // Sem filtro nenhum, cada mês depois do primeiro ganha um desenho solto.
    if (!filtro && !grupo && i > 0) {
      const d = DESENHOS[(i - 1) % DESENHOS.length];
      const fig = no(bloco, 'figure', null, `solta desenha ${d.classe || ''}`);
      fig.innerHTML = `<svg class="${d.revela}" viewBox="${d.viewBox}" aria-hidden="true"><g class="pd ${d.pd || ''}"></g>${d.extra}</svg>`;
      montarPD(fig.querySelector('.pd'), d.fonte, d.faixa);
      no(fig, 'figcaption', d.legenda, 'mono depois');
      olheiro.observe(fig);
    }

    for (const e of itens) {
      const post = no(bloco, 'article', null, 'post');
      post.tabIndex = 0;
      post.setAttribute('role', 'button');
      no(post, 'div', [dataCurta(e.data), e.tipo, e.fonte].filter(Boolean).join(' · '), 'mono');
      no(post, 'h2', e.titulo);
      if (e.nota) no(post, 'p', e.nota);
      no(post, 'span', 'abrir folha →', 'abrir');
      post.addEventListener('click', () => abrir(e));
      post.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(e); } });
    }
  });
}

/* ---------- o hangar: ferramentas guardadas para testar ---------- */
// Fica à parte do feed: não entra nas contagens, nos filtros nem no RSS.
// Um item é { data, titulo, link?, fonte?, nota? }, com a data em que foi guardado.
const DIAS_DE_POEIRA = 30;

function limparItemHangar(bruto, i) {
  const ok = bruto && typeof bruto === 'object' && dataValida(bruto.data) && typeof bruto.titulo === 'string' && bruto.titulo.trim();
  if (!ok) { console.warn(`caderno: item ${i} do hangar ignorado`, bruto); return null; }
  const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const item = { data: bruto.data, titulo: bruto.titulo.trim(), fonte: texto(bruto.fonte), nota: texto(bruto.nota) };
  if (typeof bruto.link === 'string' && /^https?:\/\//i.test(bruto.link)) item.link = bruto.link;
  return item;
}

async function carregarHangar() {
  try {
    const r = await fetch(FONTE_HANGAR, { cache: 'no-cache' });
    if (!r.ok) return [];
    const dados = await r.json();
    return Array.isArray(dados) ? dados.map(limparItemHangar).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function diasDesde(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const hoje = new Date();
  return Math.max(0, Math.round((Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - Date.UTC(a, m - 1, d)) / 864e5));
}
const haQuanto = (n) => (n === 0 ? 'guardado hoje' : n === 1 ? 'guardado ontem' : `guardado há ${n} dias`);

const hangar = $('hangar'), folhaHangar = $('folha-hangar');

function abrirHangar() {
  folhaHangar.replaceChildren();
  const topo = no(folhaHangar, 'div', null, 'topo');
  no(topo, 'div', `Hangar · ${HANGAR.length}`, 'mono');
  no(topo, 'button', 'fechar ✕', 'fechar').addEventListener('click', fecharHangar);
  no(folhaHangar, 'h2', 'Esperando o primeiro voo').id = 'hangar-titulo';
  no(folhaHangar, 'p', 'Ferramentas que guardei para testar. Quando uma for usada de verdade, ela sai daqui e vira uma entrada do caderno.', 'explica');

  const lista = no(folhaHangar, 'ul', null, 'estante');
  if (!HANGAR.length) no(lista, 'li', 'Nada no hangar agora.', 'vazia');
  for (const item of [...HANGAR].sort((a, b) => a.data.localeCompare(b.data))) {
    const dias = diasDesde(item.data);
    const li = no(lista, 'li', null, dias >= DIAS_DE_POEIRA ? 'poeira' : null);
    no(li, 'div', [haQuanto(dias), item.fonte].filter(Boolean).join(' · '), 'mono');
    const nome = no(li, 'div', null, 'nome');
    if (item.link) { const a = no(nome, 'a', `${item.titulo} ↗`); a.href = item.link; a.target = '_blank'; a.rel = 'noopener'; }
    else nome.append(item.titulo);
    if (item.nota) no(li, 'p', item.nota);
  }

  endereco('#hangar');
  document.documentElement.style.overflow = 'hidden';
  if (!hangar.open) hangar.showModal();
  hangar.scrollTop = 0;
}
function fecharHangar() { if (hangar.open) hangar.close(); arrumar(); }
hangar.addEventListener('close', arrumar);
hangar.addEventListener('click', ev => { if (ev.target === hangar) fecharHangar(); });
$('abrir-hangar').addEventListener('click', abrirHangar);

function mostrarHangarNoCabecalho() {
  $('hangar-n').textContent = String(HANGAR.length);
  $('abrir-hangar').hidden = false;
}

/* ---------- a folha de diário ---------- */
const diario = $('diario'), folha = $('folha');

function abrir(e) {
  folha.replaceChildren();
  const topo = no(folha, 'div', null, 'topo');
  no(topo, 'div', `Folha ${chaveDe(e)}`, 'mono');
  no(topo, 'button', 'fechar ✕', 'fechar').addEventListener('click', fechar);
  no(folha, 'h2', e.titulo).id = 'diario-titulo';

  const selo = no(folha, 'table', null, 'selo');
  const linha = (rotulo, valor, classe) => {
    const tr = no(selo, 'tr');
    no(tr, 'th', rotulo);
    no(tr, 'td', valor, classe);
  };
  linha('Tipo', `${TIPOS[e.tipo].n} · ${e.tipo}`);
  linha('Concluído', dataLonga(e.data));
  if (e.fonte) linha('Fonte', e.fonte);
  if (e.nota) linha('O que ficou', e.nota, 'ficou');

  if (e.texto) {
    const txt = no(folha, 'div', null, 'texto');
    e.texto.forEach(p => no(txt, 'p', p));
  }
  if (e.link) {
    const a = no(folha, 'a', 'Abrir o original ↗', 'original');
    a.href = e.link; a.target = '_blank'; a.rel = 'noopener';
  }
  no(folha, 'div', `rev. caderno. · ${e.data}`, 'mono rev');

  endereco('#ler/' + chaveDe(e));
  document.documentElement.style.overflow = 'hidden';
  if (!diario.open) diario.showModal();
  diario.scrollTop = 0;
}
function arrumar() {
  document.documentElement.style.overflow = '';
  endereco(hashDoFiltro());
}
function fechar() { if (diario.open) diario.close(); arrumar(); }
diario.addEventListener('close', arrumar);
diario.addEventListener('click', ev => { if (ev.target === diario) fechar(); });

function abrirDoEndereco() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h.startsWith('ler/')) return;
  const e = FEED.find(x => chaveDe(x) === h.slice(4));
  if (e) abrir(e);
}

/* ---------- início ---------- */
// Um bloco com desenho solto cresce até caber o desenho inteiro, para ele não invadir o mês seguinte nem o rodapé.
function ajustarBlocos() {
  document.querySelectorAll('#feed .bloco').forEach(b => {
    const fig = b.querySelector('.solta');
    b.style.minHeight = fig && fig.offsetHeight ? `${fig.offsetTop + fig.offsetHeight + 32}px` : '';
  });
}
addEventListener('resize', ajustarBlocos);

function desenhar() { desenharPecas(); desenharFeed(); ajustarBlocos(); }
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#ler/')) { abrirDoEndereco(); return; }
  if (location.hash === '#hangar') { abrirHangar(); return; }
  filtroDoEndereco(); desenhar();
});

// O jato fixo aparece antes do feed carregar.
const carro = $('carro');
montarPD($('jato-pd'), 'f16', [92, 253]);
requestAnimationFrame(() => setTimeout(() => carro.classList.add('on'), 120));
desenharPecas();

carregarFeed()
  .then(entradas => {
    FEED = entradas;
    const ultima = FEED.reduce((m, e) => (e.data > m ? e.data : m), '');
    $('revisao').textContent = ultima || '—';
    desenhar();
    abrirDoEndereco();
  })
  .then(carregarHangar)
  .then(itens => {
    HANGAR = itens || [];
    mostrarHangarNoCabecalho();
    if (location.hash === '#hangar') abrirHangar();
  })
  .catch(erro => {
    console.error('caderno:', erro);
    const feed = $('feed');
    feed.replaceChildren();
    const aviso = location.protocol === 'file:'
      ? 'Não deu para ler o feed: abra a página por um servidor local, não direto do disco.'
      : 'Não deu para ler o feed agora.';
    no(feed, 'div', aviso, 'vazio');
  });
