/* Zaino Hero - servizio personale per riconoscere i libri dall'ISBN (Cloudflare Worker, gratuito).
   Come usarlo (5 minuti):
   1. Vai su https://dash.cloudflare.com  >  Workers e Pages  >  Crea  >  Crea Worker  >  Distribuisci.
   2. Premi «Modifica codice», cancella tutto, incolla questo file, premi «Distribuisci».
   3. Copia l'indirizzo che compare (es. https://libri.tuonome.workers.dev).
   4. In Zaino Hero: Altro (tieni premuto) > Ricerca dei libri online > incolla l'indirizzo > «Prova la ricerca».
   Il servizio riceve solo il numero ISBN: nessun dato personale. Consulta Libraccio, IBS, Mondadori Store e
   Libreria Universitaria e restituisce titolo, autore e copertina. */
const SOURCES = [
  ['Libraccio', (i) => `https://www.libraccio.it/libro/${i}`],
  ['IBS', (i) => `https://www.ibs.it/search/?ts=as&query=${i}`],
  ['Mondadori Store', (i) => `https://www.mondadoristore.it/search/?g=${i}`],
  ['Libreria Universitaria', (i) => `https://www.libreriauniversitaria.it/ricerca.htm?q=${i}`]
];
const names = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => (typeof x === 'string' ? x : (x && x.name) || '')).filter(Boolean).join(', ');
const clean = (t) => String(t || '').replace(/\s*[-|–]\s*(Libro|Libraccio|IBS|Mondadori|Libreria|Giunti|Acquista).*$/i, '').replace(/\s+/g, ' ').trim();

function parse(html, isbn) {
  const found = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n['@graph']) walk(n['@graph']);
    const types = [].concat(n['@type'] || []).map(String);
    if (types.some((t) => /Book|Product/i.test(t)) && n.name) {
      const ids = [n.isbn, n.gtin13, n.gtin, n.sku, n.productID].filter(Boolean).map((x) => String(x).replace(/\D/g, ''));
      const img = Array.isArray(n.image) ? n.image[0] : n.image;
      found.push({ title: String(n.name), authors: names(n.author || n.creator), publisher: names(n.publisher || n.brand), cover: typeof img === 'string' ? img : (img && img.url) || '', ids });
    }
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1])); } catch (e) { /* JSON non valido */ }
  }
  const digits = html.replace(/[-\s]/g, '');
  let pick = found.find((f) => f.ids.includes(isbn)) || (digits.includes(isbn) ? found[0] : null);
  if (!pick && digits.includes(isbn)) {
    const t = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1];
    const c = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1];
    if (t) pick = { title: t, authors: '', publisher: '', cover: c || '' };
  }
  return pick ? { title: clean(pick.title).slice(0, 120), authors: pick.authors, hint: `${pick.title} ${pick.publisher}`, cover: pick.cover } : null;
}

export default {
  async fetch(request) {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' } });
    const isbn = (new URL(request.url).searchParams.get('isbn') || '').replace(/\D/g, '');
    if (!/^97[89]\d{10}$/.test(isbn)) return new Response(JSON.stringify({ error: 'ISBN non valido' }), { status: 400, headers: cors });
    for (const [name, make] of SOURCES) {
      try {
        const res = await fetch(make(isbn), { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZainoHero/1.0)', 'Accept-Language': 'it-IT,it;q=0.9' } });
        if (!res.ok) continue;
        const info = parse(await res.text(), isbn);
        if (info) return new Response(JSON.stringify({ ...info, source: name }), { headers: cors });
      } catch (e) { /* prossima libreria */ }
    }
    return new Response(JSON.stringify({ error: 'non trovato' }), { status: 404, headers: cors });
  }
};
