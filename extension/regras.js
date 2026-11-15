// As mesmas regras do tools/conferir.py, para a extensão recusar um erro antes de gravar.
// Se mudar aqui, mude lá também (e em TIPOS no caderno.js).

export const TIPOS = ['curso', 'podcast', 'artigo', 'escrito', 'projeto'];

export function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

// Hoje no fuso de quem está registrando, não em UTC: à noite no Brasil, UTC já é amanhã.
export function hoje() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Monta a entrada na ordem do README, sem campos vazios. */
export function montarEntrada({ data, tipo, titulo, link, fonte, nota, texto }) {
  const e = { data, tipo, titulo: (titulo || '').trim() };
  if (link && link.trim()) e.link = link.trim();
  if (fonte && fonte.trim()) e.fonte = fonte.trim();
  if (nota && nota.trim()) e.nota = nota.trim();
  const paragrafos = (texto || '').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paragrafos.length) e.texto = paragrafos;
  return e;
}

/** Devolve a lista de problemas da entrada; vazia quando está tudo certo. */
export function conferirEntrada(e) {
  const erros = [];
  if (!dataValida(e.data)) erros.push('A data precisa ser um dia real.');
  if (!TIPOS.includes(e.tipo)) erros.push('Escolha um tipo.');
  if (!e.titulo) erros.push('O título não pode ficar vazio.');
  if (e.link && !/^https?:\/\//i.test(e.link)) erros.push('O link precisa começar com http:// ou https://.');
  return erros;
}

/** Mesma regra de duplicata do conferir.py: mesmo dia e mesmo link (ou título, sem link). */
export function repetida(feed, e) {
  const alvo = (e.link || e.titulo).trim().toLowerCase();
  return feed.find(x => x && x.data === e.data && String(x.link || x.titulo || '').trim().toLowerCase() === alvo);
}
