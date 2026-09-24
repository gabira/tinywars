// Cliente mínimo para o fluxo público de download GRATUITO do itch.io.
// Fluxo (verificado em 2026-09): GET /purchase → POST /download_url → GET /download/<key>
// → POST /file/<id>?source=game_download → GET da URL pré-assinada (expira em 60 s).

const GAME_URL = 'https://pixelfrog-assets.itch.io/tiny-swords';
const UA = 'TinyWars-asset-fetcher/0.1 (+https://pixelfrog-assets.itch.io/tiny-swords)';

export class ItchBlockedError extends Error {}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function detectChallenge(res, text) {
  if (res.status === 403 || res.status === 503 || /cf-chl|challenge-platform/i.test(text)) {
    throw new ItchBlockedError(`itch.io bloqueou a requisição (HTTP ${res.status}).`);
  }
}

export class ItchSession {
  constructor(log) {
    this.log = log;
    this.cookies = new Map();
    this.csrf = null;
  }

  cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  absorbCookies(res) {
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const [pair] = c.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  async request(url, { method = 'GET', form, json = false } = {}) {
    const headers = { 'User-Agent': UA, Cookie: this.cookieHeader() };
    let body;
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['X-Requested-With'] = 'XMLHttpRequest';
      body = new URLSearchParams(form).toString();
    }
    const res = await fetch(url, { method, headers, body, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
    this.absorbCookies(res);
    const text = await res.text();
    detectChallenge(res, text);
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${method} ${url}`);
    if (json) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Resposta não-JSON de ${url}`);
      }
    }
    return text;
  }

  async open() {
    this.log('→ Abrindo página de download do itch.io…');
    const html = await this.request(`${GAME_URL}/purchase`);
    const m =
      html.match(/name="csrf_token"\s+value="([^"]+)"/) || html.match(/<meta\s+name="csrf_token"\s+value="([^"]+)"/);
    if (!m) throw new Error('csrf_token não encontrado na página de compra.');
    this.csrf = m[1];
  }

  /** Lista os arquivos gratuitos da página de download: [{id, name}] */
  async listUploads() {
    this.log('→ Solicitando página de downloads gratuitos ("No thanks, just take me to the downloads")…');
    const r = await this.request(`${GAME_URL}/download_url`, { method: 'POST', form: { csrf_token: this.csrf }, json: true });
    if (!r.url) throw new Error('download_url não retornou URL.');
    const html = await this.request(r.url);
    const csrf2 = html.match(/name="csrf_token"\s+value="([^"]+)"/);
    if (csrf2) this.csrf = csrf2[1];
    const uploads = [];
    const re = /data-upload_id="(\d+)"/g;
    const hits = [...html.matchAll(re)];
    for (let i = 0; i < hits.length; i++) {
      const start = hits[i].index;
      const end = i + 1 < hits.length ? hits[i + 1].index : html.length;
      const chunk = html.slice(start, end);
      const nm = chunk.match(/class="name"[^>]*title="([^"]+)"/) || chunk.match(/title="([^"]+)"[^>]*class="name"/);
      const id = hits[i][1];
      if (nm && !uploads.some((u) => u.id === id)) uploads.push({ id, name: decodeEntities(nm[1]) });
    }
    return uploads;
  }

  /** Obtém a URL pré-assinada (expira em ~60 s) de um upload. */
  async fileUrl(id) {
    const r = await this.request(`${GAME_URL}/file/${id}?source=game_download`, {
      method: 'POST',
      form: { csrf_token: this.csrf },
      json: true,
    });
    if (r.errors) throw new Error(`itch.io recusou o arquivo ${id}: ${r.errors.join(', ')}`);
    if (!r.url || !/^https:\/\//.test(r.url)) throw new Error(`URL inválida para o arquivo ${id}.`);
    return r.url;
  }
}
