/* ============================================================
   KAWAII ANIME — script.js  v3.0  (FIXED)
   ─────────────────────────────────────────────────────────
   BUGS CORREGIDOS:
   ✅ onclick usaba JSON.stringify → rompía atributos HTML
   ✅ parseInt(slug) = NaN → redirigía a index.html
   ✅ Sin fallback de streams → "no hay servidores"

   APIs:
   1. AnimeFLV (animeflv.ahmedrangel.com) → español Latino/Sub
   2. Consumet mirrors (gogoanime)         → fallback sub español
   3. Jikan v4 / AniList                  → metadata
   ============================================================ */

'use strict';

/* ── Configuración ─────────────────────────────────────── */
const API = {
  JIKAN  : 'https://api.jikan.moe/v4',
  ANILIST: 'https://graphql.anilist.co',
  // AnimeFLV unofficial API
  AFLV   : 'https://animeflv.ahmedrangel.com/api',
  // Consumet mirrors – se prueba el primero disponible
  CONSUMET: [
    'https://consumet-api.vercel.app',
    'https://api.consumet.org',
  ],
  PROXY  : 'https://api.allorigins.win/raw?url=',
};

/* ── Labels de servidores conocidos ─────────────────────── */
const SRV = {
  sw   : { name:'StreamWish',  icon:'🎬', color:'#7c3aed' },
  yu   : { name:'YourUpload',  icon:'📺', color:'#0ea5e9' },
  mp4  : { name:'Mp4Upload',   icon:'💾', color:'#10b981' },
  voe  : { name:'Voe',         icon:'⚡', color:'#f59e0b' },
  dood : { name:'DoodStream',  icon:'🌊', color:'#06b6d4' },
  sb   : { name:'StreamSB',    icon:'📡', color:'#8b5cf6' },
  netu : { name:'Netu.tv',     icon:'🌐', color:'#ec4899' },
  fds  : { name:'Filemoon',    icon:'🌙', color:'#f97316' },
  ok   : { name:'Ok.ru',       icon:'🆗', color:'#22c55e' },
};

/* ── Géneros ───────────────────────────────────────────── */
const GENRES = [
  { name:'Acción',        icon:'⚔️',  al:'Action'       },
  { name:'Aventura',      icon:'🗺️',  al:'Adventure'    },
  { name:'Comedia',       icon:'😂',  al:'Comedy'       },
  { name:'Romance',       icon:'💕',  al:'Romance'      },
  { name:'Fantasía',      icon:'🔮',  al:'Fantasy'      },
  { name:'Isekai',        icon:'🌀',  al:'Isekai'       },
  { name:'Terror',        icon:'👻',  al:'Horror'       },
  { name:'Sci-Fi',        icon:'🚀',  al:'Sci-Fi'       },
  { name:'Slice of Life', icon:'🌸',  al:'Slice of Life'},
  { name:'Deportes',      icon:'⚽',  al:'Sports'       },
  { name:'Misterio',      icon:'🕵️', al:'Mystery'      },
  { name:'Drama',         icon:'🎭',  al:'Drama'        },
  { name:'Mecha',         icon:'🤖',  al:'Mecha'        },
  { name:'Sobrenatural',  icon:'✨',  al:'Supernatural' },
  { name:'Psicológico',   icon:'🧠',  al:'Psychological'},
  { name:'Shounen',       icon:'🔥',  al:'Action'       },
];

/* ── Estado global ─────────────────────────────────────── */
const STATE = {
  heroAnimes    : [],
  heroIndex     : 0,
  heroTimer     : null,
  slugCache     : {},   // animeId → aflv slug
  consumetCache : {},   // animeTitle → gogoanime id
  episodeCache  : {},   // animeId → episodes array
  genrePage     : 1,
  genreActive   : null,
  infScrollPage : 2,
  isLoading     : false,
};

/* ══════════════════════════════════════════════════════════
   UTILIDADES HTTP
══════════════════════════════════════════════════════════ */

async function http(url, opts = {}, timeout = 12000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(tid); }
}

/* Intenta la URL directa primero; si hay error CORS/red, usa allorigins */
async function httpSafe(url, timeout = 10000) {
  try { return await http(url, {}, timeout); }
  catch {
    try {
      return await http(`${API.PROXY}${encodeURIComponent(url)}`, {}, timeout);
    } catch(e) { console.warn('httpSafe failed:', url, e.message); return null; }
  }
}

/* GraphQL AniList */
async function graphql(query, variables = {}) {
  const d = await http(API.ANILIST, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body   : JSON.stringify({ query, variables }),
  });
  return d.data;
}

/* Prueba los mirrors de Consumet hasta encontrar uno que responda */
async function consumetHTTP(path) {
  for (const host of API.CONSUMET) {
    try {
      const d = await http(`${host}${path}`, {}, 8000);
      if (d) return d;
    } catch { /* siguiente mirror */ }
  }
  return null;
}

const sleep    = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const truncate = (s, n)   => s && s.length > n ? s.slice(0,n)+'…' : (s||'Sin sinopsis.');
const qs       = id       => document.getElementById(id);
const setText  = (id, v)  => { const el = qs(id); if (el) el.textContent = v ?? '—'; };

function coverImg(a) {
  return a?.images?.jpg?.large_image_url || a?.images?.jpg?.image_url
    || a?.coverImage?.extraLarge || a?.coverImage?.large || a?.coverImage?.medium
    || a?.poster || a?.cover
    || 'https://placehold.co/300x420/0e1422/7c3aed?text=No+imagen';
}

/* ═══════════════════════════════════════════════════════════
   NAVEGACIÓN  — FIX: usar comillas simples para evitar que
   JSON.stringify genere comillas dobles dentro del onclick
═══════════════════════════════════════════════════════════ */
function goAnime(id, src) {
  location.href = `anime.html?id=${encodeURIComponent(id)}&source=${encodeURIComponent(src)}`;
}
function goPlayer(id, src, ep, slug) {
  const s = slug ? encodeURIComponent(slug) : '';
  location.href = `player.html?id=${encodeURIComponent(id)}&source=${encodeURIComponent(src)}&ep=${ep}${s?'&slug='+s:''}`;
}

/* Toast */
function showToast(msg, type = 'info') {
  let c = qs('toast-container');
  if (!c) { c = Object.assign(document.createElement('div'), {id:'toast-container',className:'toast-container'}); document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ══════════════════════════════════════════════════════════
   TARJETAS  — FIX: onclick con comillas simples
   Antes: onclick="goAnime(${JSON.stringify(id)},${JSON.stringify(src)})"
          → producía: onclick="goAnime(21,"jikan")" ← HTML roto
   Ahora: onclick="goAnime('21','jikan')"           ← correcto
══════════════════════════════════════════════════════════ */
function card(a) {
  const score = a.rating ? parseFloat(a.rating).toFixed(1) : '?';
  const isDub = a.isDub ?? false;
  // Escapa comillas simples por si el ID contiene alguna
  const safeId  = String(a.id).replace(/'/g, "\\'");
  const safeSrc = String(a.source).replace(/'/g, "\\'");
  return `
  <div class="anime-card" onclick="goAnime('${safeId}','${safeSrc}')" title="${a.title||''}">
    <div class="cover-wrap">
      <img src="${a.cover}" alt="${a.title||''}" loading="lazy"
           onerror="this.src='https://placehold.co/300x420/0e1422/7c3aed?text=Error'">
      <span class="badge badge-${isDub?'dub':'sub'}">${isDub?'Latino':'Sub'}</span>
      ${a.episodes?`<span class="ep-badge">EP ${a.episodes}</span>`:''}
      ${a.isNew?'<span class="badge badge-new" style="top:36px;left:8px">Nuevo</span>':''}
      <div class="cover-overlay">
        <div class="play-btn">▶</div>
        <div class="cover-meta"><span>⭐ ${score}</span><span>${a.episodes?a.episodes+' eps':'?'}</span></div>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">${a.title||'Sin título'}</div>
      <div class="card-sub"><span class="dot">●</span><span class="rating-small">⭐ ${score}</span></div>
    </div>
  </div>`;
}

function skeletons(n=8) {
  return Array.from({length:n},()=>`
    <div class="skel-card">
      <div class="skeleton skel-cover"></div>
      <div class="skeleton skel-line"></div>
      <div class="skeleton skel-line short"></div>
    </div>`).join('');
}

/* Normalizadores */
function normJikan(a) {
  if (!a) return null;
  return { id:a.mal_id, source:'jikan', title:a.title_english||a.title, titleJp:a.title_japanese,
    cover:coverImg(a), synopsis:a.synopsis, rating:a.score, episodes:a.episodes, status:a.status,
    genres:(a.genres||[]).map(g=>g.name), year:a.year, members:a.members, type:a.type,
    studios:(a.studios||[]).map(s=>s.name), rank:a.rank, season:a.season };
}
function normAniList(a) {
  if (!a) return null;
  return { id:a.id, source:'anilist', title:a.title?.english||a.title?.romaji, titleJp:a.title?.native,
    cover:coverImg(a), synopsis:a.description?.replace(/<[^>]*>/g,''),
    rating:a.averageScore?(a.averageScore/10).toFixed(1):null, episodes:a.episodes, status:a.status,
    genres:a.genres||[], year:a.seasonYear, members:a.popularity, type:a.format, season:a.season,
    studios:a.studios?.nodes?.map(s=>s.name)||[], banner:a.bannerImage };
}
function normAFLV(a) {
  if (!a) return null;
  return { id:a.id||a.slug, source:'aflv', slug:a.id||a.slug, title:a.title,
    cover:a.poster||a.cover||'https://placehold.co/300x420/0e1422/7c3aed?text=Sin+imagen',
    synopsis:a.synopsis||a.description, rating:a.rating,
    episodes:Array.isArray(a.episodes)?a.episodes.length:(a.episodeCount||null),
    status:a.status, genres:a.genres||[], type:a.type, isDub:false };
}

/* ══════════════════════════════════════════════════════════
   JIKAN API
══════════════════════════════════════════════════════════ */
async function jikanSearch(q, limit=10) {
  try {
    const d = await http(`${API.JIKAN}/anime?q=${encodeURIComponent(q)}&limit=${limit}&sfw=true`);
    return (d.data||[]).map(normJikan).filter(Boolean);
  } catch { return []; }
}
async function jikanDetail(id) {
  const d = await http(`${API.JIKAN}/anime/${id}/full`);
  return normJikan(d.data);
}
async function jikanTopRated(page=1) {
  try {
    const d = await http(`${API.JIKAN}/top/anime?page=${page}&limit=20`);
    return (d.data||[]).map(normJikan).filter(Boolean);
  } catch { return []; }
}
async function jikanSeason() {
  try {
    const d = await http(`${API.JIKAN}/seasons/now?limit=20`);
    return (d.data||[]).slice(0,20).map(normJikan).filter(Boolean);
  } catch { return []; }
}

/* ══════════════════════════════════════════════════════════
   ANILIST API
══════════════════════════════════════════════════════════ */
const GQL = `id title{romaji english native} coverImage{extraLarge large medium}
  bannerImage averageScore episodes status genres seasonYear popularity format
  description studios{nodes{name}} season`;

async function anilistTrending(page=1,pp=20) {
  try {
    const q=`query($p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(sort:TRENDING_DESC,type:ANIME,isAdult:false){${GQL}}}}`;
    const d=await graphql(q,{p:page,pp});
    return d.Page.media.map(normAniList).filter(Boolean);
  } catch { return []; }
}
async function anilistPopular(page=1,pp=20) {
  try {
    const q=`query($p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){${GQL}}}}`;
    const d=await graphql(q,{p:page,pp});
    return d.Page.media.map(normAniList).filter(Boolean);
  } catch { return []; }
}
async function anilistByGenre(genre,page=1,pp=20) {
  try {
    const q=`query($g:String,$p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(genre:$g,sort:POPULARITY_DESC,type:ANIME,isAdult:false){${GQL}} pageInfo{hasNextPage}}}`;
    const d=await graphql(q,{g:genre,p:page,pp});
    return { animes:d.Page.media.map(normAniList).filter(Boolean), hasMore:d.Page.pageInfo.hasNextPage };
  } catch { return { animes:[], hasMore:false }; }
}
async function anilistDetail(id) {
  const q=`query($id:Int){Media(id:$id,type:ANIME){${GQL}
    relations{edges{relationType node{id title{english romaji} type coverImage{medium} format}}}
    characters(sort:ROLE,perPage:8){nodes{name{full} image{medium}}}}}`;
  const d=await graphql(q,{id:parseInt(id)});
  const a=d.Media;
  return { ...normAniList(a), relations:a.relations?.edges||[], characters:a.characters?.nodes||[] };
}
async function anilistMovies(page=1) {
  try {
    const q=`query($p:Int){Page(page:$p,perPage:20){media(sort:POPULARITY_DESC,type:ANIME,format:MOVIE,isAdult:false){${GQL}}}}`;
    const d=await graphql(q,{p:page});
    return d.Page.media.map(normAniList).filter(Boolean);
  } catch { return []; }
}

/* ══════════════════════════════════════════════════════════
   ANIMEFLV UNOFFICIAL API  (español Latino / Sub)
══════════════════════════════════════════════════════════ */

async function aflvRecent() {
  try {
    const d = await httpSafe(`${API.AFLV}/recent-episodes`);
    if (!d?.data) return [];
    return d.data.map(ep => ({
      id:`aflv__${ep.animeSlug||ep.id}`, source:'aflv', slug:ep.animeSlug||ep.id,
      title:ep.title||ep.name, cover:ep.poster||ep.cover||'https://placehold.co/300x420/0e1422/7c3aed?text=Sin+imagen',
      synopsis:'', rating:null, episodes:ep.episode, status:'En emisión',
      genres:[], type:'TV', isNew:true, isDub:false,
    })).filter(a=>a.title);
  } catch { return []; }
}

async function aflvSearchAPI(q) {
  try {
    const d = await httpSafe(`${API.AFLV}/search?q=${encodeURIComponent(q)}`);
    return (d?.data||[]).map(normAFLV).filter(Boolean);
  } catch { return []; }
}

async function aflvDetailAPI(slug) {
  try {
    const d = await httpSafe(`${API.AFLV}/anime/${slug}`);
    if (!d) return null;
    const a = d.data || d;
    return {
      slug, title:a.title||a.name, cover:a.poster||a.cover,
      synopsis:a.synopsis||a.description, rating:a.rating,
      status:a.status, genres:a.genres||[], type:a.type,
      episodes:Array.isArray(a.episodes)?a.episodes:[],
      episodeCount:Array.isArray(a.episodes)?a.episodes.length:(a.episodeCount||0),
    };
  } catch { return null; }
}

/** Obtiene los servidores de video de un episodio en AnimeFLV.
    Retorna array de { id, name, icon, color, embed, url, lang } */
async function aflvGetServers(slug, ep) {
  try {
    const d = await httpSafe(`${API.AFLV}/episode/${slug}/${ep}`);
    if (!d) return [];
    const raw = d.servers || d.episode?.servers || d.data?.servers || [];
    const parsed = raw.map(s => {
      const meta = SRV[s.server] || SRV[s.id] || {};
      const embed = s.code || s.embed || s.url || s.iframe || '';
      const url   = s.url  || s.embed || '';
      // Detecta idioma por campo lang o por título
      const langRaw = (s.lang||s.title||'').toLowerCase();
      const lang  = langRaw.includes('lat') || langRaw.includes('esp') ? 'latino' : 'sub';
      return {
        id   : s.server || s.id || 'srv',
        name : meta.name || s.title || s.server || 'Servidor',
        icon : meta.icon || '▶️',
        color: meta.color || '#7c3aed',
        embed, url, lang,
      };
    }).filter(s => s.embed || s.url);
    return parsed;
  } catch { return []; }
}

/** Busca y cachea el slug AnimeFLV para un anime dado su título */
async function matchAFLVSlug(title, cacheKey) {
  const k = String(cacheKey);
  if (STATE.slugCache[k]) return STATE.slugCache[k];
  try { const ss = sessionStorage.getItem('aflv_'+k); if (ss) { STATE.slugCache[k]=ss; return ss; } } catch {}
  try {
    const results = await aflvSearchAPI(title);
    if (!results.length) return null;
    const norm = title.toLowerCase().trim();
    let best = results[0];
    for (const r of results) {
      if ((r.title||'').toLowerCase().trim() === norm) { best = r; break; }
    }
    const slug = best.slug || best.id;
    if (!slug) return null;
    STATE.slugCache[k] = slug;
    try { sessionStorage.setItem('aflv_'+k, slug); } catch {}
    return slug;
  } catch { return null; }
}

function getSlug(key) {
  const k = String(key);
  if (STATE.slugCache[k]) return STATE.slugCache[k];
  try { return sessionStorage.getItem('aflv_'+k) || null; } catch { return null; }
}

/* ══════════════════════════════════════════════════════════
   CONSUMET API  — fallback con Gogoanime (sub inglés / español)
══════════════════════════════════════════════════════════ */

/** Busca el ID de un anime en Gogoanime via Consumet */
async function consumetSearch(title) {
  const k = title.toLowerCase().trim();
  if (STATE.consumetCache[k]) return STATE.consumetCache[k];
  try {
    const d = await consumetHTTP(`/anime/gogoanime/${encodeURIComponent(title)}`);
    const results = d?.results || [];
    if (!results.length) return null;
    // Mejor coincidencia: title exacto o el primer resultado
    let best = results[0];
    for (const r of results) {
      if ((r.title||'').toLowerCase() === k) { best = r; break; }
    }
    const id = best.id;
    if (id) {
      STATE.consumetCache[k] = id;
      try { sessionStorage.setItem('consumet_'+k, id); } catch {}
    }
    return id || null;
  } catch { return null; }
}

/** Obtiene la lista de episodios de Gogoanime via Consumet */
async function consumetEpisodes(animeId) {
  if (STATE.episodeCache[animeId]) return STATE.episodeCache[animeId];
  try {
    const d = await consumetHTTP(`/anime/gogoanime/info/${encodeURIComponent(animeId)}`);
    const eps = d?.episodes || [];
    if (eps.length) STATE.episodeCache[animeId] = eps;
    return eps;
  } catch { return []; }
}

/** Obtiene los streams de un episodio de Gogoanime */
async function consumetWatch(episodeId) {
  try {
    const d = await consumetHTTP(`/anime/gogoanime/watch?episodeId=${encodeURIComponent(episodeId)}`);
    return d?.sources || [];
  } catch { return []; }
}

/* ══════════════════════════════════════════════════════════
   RESOLUCIÓN DE STREAMS  (cadena de prioridad)
   1. AnimeFLV → embed iframes en español Latino / Sub esp
   2. Consumet / Gogoanime → streams m3u8 (sub inglés fallback)
══════════════════════════════════════════════════════════ */

/**
 * Obtiene los servidores disponibles para un episodio.
 * Retorna un objeto: { servers: [...], mode: 'iframe'|'hls'|'none' }
 */
async function resolveServers(anime, animeId, ep) {
  // ── 1. AnimeFLV (español Latino + Sub español) ──────────
  let aflvSlug = getSlug(animeId);
  if (!aflvSlug) {
    aflvSlug = await matchAFLVSlug(anime.title, animeId);
  }
  if (aflvSlug) {
    const aflvServers = await aflvGetServers(aflvSlug, ep);
    if (aflvServers.length) {
      return { servers: aflvServers, mode: 'iframe', aflvSlug };
    }
  }

  // ── 2. Consumet / Gogoanime (m3u8, sub fallback) ────────
  try {
    // Busca el anime en Gogoanime
    let gogoId = null;
    try { gogoId = sessionStorage.getItem('consumet_'+anime.title.toLowerCase().trim()); } catch {}
    if (!gogoId) gogoId = await consumetSearch(anime.title);

    if (gogoId) {
      // Obtiene la lista de episodios
      const episodes = await consumetEpisodes(gogoId);
      const epObj    = episodes.find(e => e.number === ep) || episodes[ep - 1];

      if (epObj) {
        const sources = await consumetWatch(epObj.id);
        if (sources.length) {
          // Filtra las fuentes, prefiere 1080p, fallback a la primera disponible
          const hd = sources.find(s => s.quality === '1080p')
                  || sources.find(s => s.quality === '720p')
                  || sources[0];
          const servers = sources.map((s, i) => ({
            id   : 'gogo_' + i,
            name : s.quality || ('Calidad '+(i+1)),
            icon : '📺',
            color: '#0ea5e9',
            url  : s.url,
            embed: s.url,
            lang : 'sub',
            isM3U8: s.isM3U8 ?? s.url?.includes('.m3u8'),
            headers: null,
          }));
          return { servers, mode: 'hls', aflvSlug };
        }
      }
    }
  } catch(e) { console.warn('Consumet fallback error:', e); }

  return { servers: [], mode: 'none', aflvSlug };
}

/* ══════════════════════════════════════════════════════════
   REPRODUCCIÓN  — iframe O HLS.js según el modo
══════════════════════════════════════════════════════════ */

function injectIframe(embedRaw, container) {
  if (!container || !embedRaw) return false;
  const trimmed = embedRaw.trim();
  // Si es HTML de iframe completo
  if (/^<iframe/i.test(trimmed)) {
    container.innerHTML = trimmed.replace(/(<iframe)/i,
      '<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" ');
    return true;
  }
  // Si es una URL directa
  if (trimmed.startsWith('http')) {
    container.innerHTML = `<iframe src="${trimmed}"
      style="position:absolute;top:0;left:0;width:100%;height:100%;border:none"
      allowfullscreen scrolling="no"
      allow="autoplay;fullscreen;encrypted-media;picture-in-picture"
      sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation">
    </iframe>`;
    return true;
  }
  return false;
}

function injectHLS(url, container) {
  if (!container || !url) return;
  container.innerHTML = `
    <video id="hls-video" controls playsinline
      style="position:absolute;top:0;left:0;width:100%;height:100%;background:#000"
      onerror="handleVideoError()">
      <source src="${url}" type="application/x-mpegURL">
    </video>`;
  const video = container.querySelector('#hls-video');
  if (!video) return;
  if (window.Hls && Hls.isSupported()) {
    if (window._hlsInstance) { window._hlsInstance.destroy(); }
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    window._hlsInstance = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(()=>{}));
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) { console.error('HLS fatal error:', data); handleVideoError(); }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari con HLS nativo
    video.src = url;
    video.play().catch(()=>{});
  } else {
    handleVideoError();
  }
}

window.handleVideoError = () => {
  const el = qs('player-embed');
  if (!el) return;
  el.innerHTML = `
    <div class="player-embed-placeholder">
      <div class="big-play">⚠️</div>
      <p style="color:var(--accent-light)">Error al reproducir</p>
      <p style="color:var(--text-muted);font-size:12px;text-align:center;max-width:320px">
        El stream no pudo cargarse. Prueba otro servidor o episodio.
      </p>
    </div>`;
};

/* ══════════════════════════════════════════════════════════
   HERO CAROUSEL
══════════════════════════════════════════════════════════ */
async function initHero() {
  if (!qs('hero-section')) return;
  try {
    const list = await anilistTrending(1, 8);
    STATE.heroAnimes = list.filter(a => a?.cover);
    if (!STATE.heroAnimes.length) return;
    renderHeroSlide(0); renderHeroDots(); startHeroTimer();
  } catch(e) { console.error('Hero:', e); }
}
function renderHeroSlide(idx) {
  const a = STATE.heroAnimes[idx]; if (!a) return;
  STATE.heroIndex = idx;
  const bg = qs('hero-bg'); if (bg) bg.style.backgroundImage = `url(${a.banner||a.cover})`;
  setText('hero-title', a.title||'Sin título');
  setText('hero-desc',  truncate(a.synopsis||'',220));
  const meta = qs('hero-meta');
  if (meta) meta.innerHTML = `
    <span class="rating">⭐ ${a.rating||'?'}</span>
    <div class="genres">${(a.genres||[]).slice(0,3).map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div>
    ${a.year?`<span style="color:var(--text-muted);font-size:13px">${a.year}</span>`:''}
    ${a.episodes?`<span style="color:var(--text-muted);font-size:13px">${a.episodes} eps</span>`:''}`;
  const wb=qs('hero-watch-btn'), ib=qs('hero-info-btn');
  if (wb) wb.onclick = () => goAnime(a.id, a.source);
  if (ib) ib.onclick = () => goAnime(a.id, a.source);
  document.querySelectorAll('.hero-dot').forEach((d,i) => d.classList.toggle('active', i===idx));
}
function renderHeroDots() {
  const c = qs('hero-dots'); if (!c) return;
  c.innerHTML = STATE.heroAnimes.map((_,i) =>
    `<button class="hero-dot ${i===0?'active':''}" onclick="changeHeroSlide(${i})"></button>`
  ).join('');
}
function startHeroTimer() {
  clearInterval(STATE.heroTimer);
  STATE.heroTimer = setInterval(() => renderHeroSlide((STATE.heroIndex+1)%STATE.heroAnimes.length), 6000);
}
window.changeHeroSlide = i => { renderHeroSlide(i); startHeroTimer(); };

/* ══════════════════════════════════════════════════════════
   SECCIONES / UI
══════════════════════════════════════════════════════════ */
async function loadRow(id, fn) {
  const row = qs(id); if (!row) return;
  row.innerHTML = skeletons(8);
  try { const list = await fn(); row.innerHTML = list.map(card).join('') || skeletons(8); }
  catch(e) { row.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error al cargar</h3></div>`; console.error(id, e); }
}

function renderGenres() {
  const grid = qs('genres-grid'); if (!grid) return;
  grid.innerHTML = GENRES.map(g => `
    <button class="genre-btn" data-genre="${g.al}"
            onclick="location.href='index.html?genre=${encodeURIComponent(g.al)}&gname=${encodeURIComponent(g.name)}'">
      <span class="genre-icon">${g.icon}</span>
      <span class="genre-name">${g.name}</span>
    </button>`).join('');
}

function initScrollArrows() {
  document.querySelectorAll('.scroll-row-wrapper').forEach(wrap => {
    const row=wrap.querySelector('.scroll-row'), l=wrap.querySelector('.scroll-arrow.left'), r=wrap.querySelector('.scroll-arrow.right');
    if (!row||!l||!r) return;
    l.addEventListener('click', () => row.scrollBy({left:-640,behavior:'smooth'}));
    r.addEventListener('click', () => row.scrollBy({left: 640,behavior:'smooth'}));
  });
}

function initNavbar() {
  const nav = document.querySelector('.navbar'); if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', scrollY > 40);
    qs('scroll-top-btn')?.classList.toggle('visible', scrollY > 400);
  });
  const hb=qs('hamburger'), mob=qs('mobile-nav');
  if (hb&&mob) hb.addEventListener('click', () => mob.classList.toggle('open'));
}

function initSearch() {
  const input=qs('search-input'), drop=qs('search-dropdown'); if (!input) return;
  const doSearch = debounce(async q => {
    if (!q.trim()) { drop.classList.remove('active'); return; }
    drop.innerHTML = '<div class="loading-spinner" style="padding:16px"><div class="spinner"></div></div>';
    drop.classList.add('active');
    try {
      const results = await jikanSearch(q, 8);
      if (!results.length) { drop.innerHTML = `<div class="empty-state" style="padding:14px"><p>Sin resultados</p></div>`; return; }
      drop.innerHTML = results.map(a => `
        <div class="search-result-item" onclick="goAnime('${a.id}','${a.source}')">
          <img src="${a.cover}" alt="${a.title}" loading="lazy">
          <div class="info">
            <div class="title">${a.title}</div>
            <div class="meta">⭐ ${a.rating||'?'} · ${a.year||'?'} · ${a.type||'TV'}</div>
          </div>
        </div>`).join('');
    } catch { drop.innerHTML = `<div class="empty-state" style="padding:12px"><p>Error al buscar</p></div>`; }
  }, 420);
  input.addEventListener('input', e => doSearch(e.target.value));
  document.addEventListener('click', e => { if (!input.closest('.nav-search').contains(e.target)) drop.classList.remove('active'); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') drop.classList.remove('active');
    if (e.key === 'Enter' && input.value.trim()) location.href = `index.html?search=${encodeURIComponent(input.value.trim())}`;
  });
}

async function loadTopTable() {
  const c = qs('top-rated-list'); if (!c) return;
  c.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  try {
    const list = await jikanTopRated(1);
    const rc = i => i===0?'gold':i===1?'silver':i===2?'bronze':'';
    c.innerHTML = list.slice(0,25).map((a,i) => `
      <div class="top-item" onclick="goAnime('${a.id}','${a.source}')">
        <span class="top-rank ${rc(i)}">${i+1}</span>
        <img src="${a.cover}" alt="${a.title}" loading="lazy">
        <div class="info">
          <div class="title">${a.title}</div>
          <div class="meta"><span>${a.type||'TV'}</span><span>${a.year||'?'}</span><span>${a.episodes?a.episodes+' eps':''}</span></div>
        </div>
        <div class="top-score"><span class="score">⭐ ${a.rating||'?'}</span><span class="votes">${a.members?(a.members/1000).toFixed(0)+'k':''}</span></div>
      </div>`).join('');
  } catch { c.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>'; }
}

function initInfiniteScroll() {
  const sentinel = qs('scroll-sentinel'); if (!sentinel) return;
  new IntersectionObserver(async entries => {
    if (!entries[0].isIntersecting || STATE.isLoading) return;
    STATE.isLoading = true; await loadMoreMainGrid(); STATE.isLoading = false;
  }, {rootMargin:'240px'}).observe(sentinel);
}
async function loadMoreMainGrid() {
  const grid = qs('main-grid'); if (!grid) return;
  const spin = Object.assign(document.createElement('div'), {className:'loading-spinner', innerHTML:'<div class="spinner"></div>'});
  qs('scroll-sentinel')?.before(spin);
  try {
    const list = await anilistPopular(STATE.infScrollPage++);
    spin.remove();
    list.forEach(a => { const el=document.createElement('div'); el.innerHTML=card(a); grid.appendChild(el.firstElementChild); });
  } catch { spin.remove(); }
}

/* ══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL  (index.html)
══════════════════════════════════════════════════════════ */
async function initHomePage() {
  initNavbar(); initSearch(); renderGenres();
  await Promise.allSettled([
    initHero(),
    loadRow('recent-row',   async () => { const a=await aflvRecent(); return a.length ? a : jikanSeason(); }),
    loadRow('trending-row', () => anilistTrending(1)),
    loadRow('popular-row',  () => anilistPopular(1)),
  ]);
  await sleep(350);
  await loadRow('toprated-row', () => jikanTopRated(1));
  await loadRow('main-grid',    () => anilistPopular(1));
  initScrollArrows(); initInfiniteScroll();

  const p = new URLSearchParams(location.search);
  if (p.get('genre'))  showGenreSection(p.get('genre'), p.get('gname')||p.get('genre'));
  if (p.get('search')) showSearchSection(p.get('search'));
}

async function showGenreSection(genre, displayName) {
  const sec=qs('genre-results-section'), t=qs('genre-title'), grid=qs('genre-grid');
  if (!sec||!grid) return;
  sec.style.display='block'; if (t) t.textContent=(displayName||genre).toUpperCase();
  STATE.genrePage=1; STATE.genreActive=genre; grid.innerHTML=skeletons(12);
  document.querySelectorAll('.genre-btn').forEach(b => b.classList.toggle('active', b.dataset.genre===genre));
  try { const{animes}=await anilistByGenre(genre,1); grid.innerHTML=animes.map(card).join(''); }
  catch { grid.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>`; }
  sec.scrollIntoView({behavior:'smooth'});
}
window.loadMoreGenre = async () => {
  if (!STATE.genreActive) return;
  STATE.genrePage++;
  const btn=qs('load-more-genre'), grid=qs('genre-grid'); if (!btn||!grid) return;
  btn.textContent='Cargando…'; btn.classList.add('loading');
  try {
    const{animes,hasMore}=await anilistByGenre(STATE.genreActive,STATE.genrePage);
    animes.forEach(a => { const el=document.createElement('div'); el.innerHTML=card(a); grid.appendChild(el.firstElementChild); });
    if (!hasMore) btn.style.display='none';
  } catch { showToast('Error al cargar más','error'); }
  finally { btn.textContent='Cargar más'; btn.classList.remove('loading'); }
};

async function showSearchSection(q) {
  const sec=qs('search-results-section'), hd=qs('search-results-title'), grid=qs('search-results-grid');
  if (!sec||!grid) return;
  sec.style.display='block'; if (hd) hd.textContent=`Resultados para: "${q}"`;
  grid.innerHTML=skeletons(12);
  try {
    const results = await jikanSearch(q, 24);
    grid.innerHTML = results.length ? results.map(card).join('') : `<div class="empty-state"><div class="icon">🔍</div><h3>Sin resultados</h3></div>`;
  } catch { grid.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>`; }
  sec.scrollIntoView({behavior:'smooth'});
}

window.switchTab = async (tabId, btn) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active'); const content=qs(tabId); if (content) content.classList.add('active');
  if (tabId==='tab-top') { loadTopTable(); return; }
  const map = {'tab-latino':'latino-row','tab-sub':'sub-row','tab-movies':'movies-row'};
  const rowId = map[tabId]; if (!rowId) return;
  const row = qs(rowId); if (!row||row.dataset.loaded) return;
  row.dataset.loaded='1';
  if (tabId==='tab-latino') await loadRow(rowId, async()=>{ const a=await aflvRecent(); return a.length?a:anilistTrending(2,20); });
  if (tabId==='tab-sub')    await loadRow(rowId, ()=>anilistTrending(3,20));
  if (tabId==='tab-movies') await loadRow(rowId, ()=>anilistMovies(1));
  initScrollArrows();
};

/* ══════════════════════════════════════════════════════════
   PÁGINA DE ANIME  (anime.html)
   FIX: no usar parseInt() — los IDs de AnimeFLV son strings
══════════════════════════════════════════════════════════ */
async function initAnimePage() {
  initNavbar(); initSearch();
  const p      = new URLSearchParams(location.search);
  const rawId  = p.get('id');    // puede ser "21" o "naruto" (slug AFLV)
  const source = p.get('source') || 'jikan';

  // ── FIX: no hacer parseInt de un slug string ────────────
  if (!rawId) { location.href='index.html'; return; }
  // Si es numérico lo convertimos, si no lo dejamos como string
  const id = /^\d+$/.test(rawId) ? parseInt(rawId) : rawId;

  const loadEl=qs('anime-loading'), detailEl=qs('anime-detail-content');
  if (loadEl) loadEl.style.display='flex'; if (detailEl) detailEl.style.display='none';

  try {
    let anime;
    if (source === 'anilist') {
      anime = await anilistDetail(id);
    } else if (source === 'aflv') {
      // ID es un slug de AnimeFLV → busca en Jikan por título
      const aflvData = await aflvDetailAPI(id);
      if (aflvData?.title) {
        // Busca en Jikan para obtener mejor metadata
        const jikanResults = await jikanSearch(aflvData.title, 3);
        anime = jikanResults[0] || { id, source:'aflv', title:aflvData.title,
          cover:aflvData.cover, synopsis:aflvData.synopsis, episodes:aflvData.episodeCount,
          genres:aflvData.genres||[], status:aflvData.status, type:'TV', rating:null, year:null, studios:[], titleJp:'' };
        // Guarda el slug en caché asociado al ID de Jikan
        if (jikanResults[0]) {
          STATE.slugCache[String(jikanResults[0].id)] = String(id);
          try { sessionStorage.setItem('aflv_'+jikanResults[0].id, String(id)); } catch {}
        }
      } else {
        throw new Error('No se pudo obtener información de AnimeFLV');
      }
    } else {
      anime = await jikanDetail(id);
    }
    if (!anime) throw new Error('Anime no encontrado');

    // Slug AnimeFLV en background
    let aflvSlug = getSlug(anime.id || id);
    const aflvPromise = (aflvSlug
      ? aflvDetailAPI(aflvSlug)
      : matchAFLVSlug(anime.title, anime.id || id).then(async slug => { aflvSlug=slug; return slug?aflvDetailAPI(slug):null; })
    );

    // Render inmediato con datos de Jikan/AniList
    renderAnimeDetail(anime, id, source, aflvSlug||'');
    renderEpisodes(anime, id, source, aflvSlug||'');
    renderSidebarStats(anime, id, source, aflvSlug||'');
    document.title = `${anime.title} — Kawaii Anime`;
    if (loadEl) loadEl.style.display='none'; if (detailEl) detailEl.style.display='block';

    // Actualiza cuando llega la info de AnimeFLV
    aflvPromise.then(aflvData => {
      if (!aflvData) return;
      const epCount = aflvData.episodeCount || aflvData.episodes?.length || anime.episodes;
      setText('anime-episodes-count', epCount||'?');
      setText('stat-episodes', epCount?epCount+' eps':'—');
      setText('stat-aflv', '✅ Disponible en español');
      if (aflvData.synopsis && aflvData.synopsis.length > (anime.synopsis||'').length) {
        const sy=qs('anime-synopsis'); if (sy) sy.textContent=aflvData.synopsis;
      }
      renderEpisodes({...anime, episodeCount:epCount}, id, source, aflvSlug||'');
      qs('anime-watch-btn')?.addEventListener('click', () => goPlayer(id,source,1,aflvSlug||''), {once:true});
      const wb=qs('anime-watch-btn'); if(wb)wb.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
      const ws=qs('watch-btn-sidebar'); if(ws)ws.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
    }).catch(()=>{});

    loadRelated(anime);
  } catch(err) {
    console.error('Anime page:', err);
    if (loadEl) loadEl.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error al cargar</h3><p>${err.message}</p><a href="index.html" style="color:var(--accent-light);margin-top:16px;display:inline-block">← Volver</a></div>`;
  }
}

function renderAnimeDetail(a, id, source, aflvSlug) {
  const bg=qs('anime-hero-bg'), img=qs('anime-poster-img');
  if (bg) bg.style.backgroundImage=`url(${a.banner||a.cover})`;
  if (img) { img.src=a.cover; img.alt=a.title; }
  setText('anime-title', a.title); setText('anime-jp-title', a.titleJp||'');
  setText('anime-score', a.rating||'?'); setText('anime-episodes-count', a.episodes||'?');
  setText('anime-year', a.year||'?'); setText('anime-type', a.type||'TV');
  setText('anime-studios', (a.studios||[]).join(', ')||'—');
  const sy=qs('anime-synopsis'); if (sy) sy.textContent=a.synopsis||'Sin sinopsis disponible.';
  const statusEl=qs('anime-status');
  if (statusEl) {
    const ongoing=a.status==='Currently Airing'||a.status==='RELEASING';
    statusEl.className=`status-badge ${ongoing?'status-ongoing':'status-finished'}`;
    statusEl.innerHTML=`${ongoing?'🟢':'⬜'} ${ongoing?'En emisión':'Finalizado'}`;
  }
  const genresEl=qs('anime-genres');
  if (genresEl) genresEl.innerHTML=(a.genres||[]).map(g=>`<span class="tag" onclick="location.href='index.html?genre=${encodeURIComponent(g)}&gname=${encodeURIComponent(g)}'">${g}</span>`).join('');
  const wb=qs('anime-watch-btn'); if(wb) wb.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
}

function renderEpisodes(a, id, source, aflvSlug) {
  const grid=qs('episodes-grid'); if (!grid) return;
  const count=a.episodeCount||a.episodes||12; const max=Math.min(count,500);
  grid.innerHTML = Array.from({length:max},(_,i) => {
    const ep=i+1;
    const safeSlug=(aflvSlug||'').replace(/'/g,"\\'");
    return `<button class="ep-btn" title="Episodio ${ep}" onclick="goPlayer('${id}','${source}',${ep},'${safeSlug}')">Ep ${ep}</button>`;
  }).join('');
}

function renderSidebarStats(a, id, source, aflvSlug) {
  const ongoing=a.status==='Currently Airing'||a.status==='RELEASING';
  setText('stat-status', ongoing?'🟢 En emisión':'⬜ Finalizado');
  setText('stat-type', a.type||'—'); setText('stat-episodes', a.episodes?a.episodes+' eps':'—');
  setText('stat-year', a.year||'—'); setText('stat-rating', a.rating?'⭐ '+a.rating:'—');
  setText('stat-popularity', a.members?Math.round(a.members/1000)+'k miembros':'—');
  setText('stat-studios', (a.studios||[]).join(', ')||'—');
  setText('stat-aflv', '⏳ Buscando…');
  const sg=qs('sidebar-genres');
  if (sg) sg.innerHTML=(a.genres||[]).map(g=>`<span class="tag" onclick="location.href='index.html?genre=${encodeURIComponent(g)}'">${g}</span>`).join('');
  const wb=qs('watch-btn-sidebar'); if(wb) wb.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
  if (a.characters?.length) {
    const cg=qs('characters-grid');
    if (cg) {
      cg.innerHTML=a.characters.map(c=>`
        <div class="char-card">
          <img src="${c.image?.medium||''}" alt="${c.name?.full}" loading="lazy" onerror="this.style.display='none'">
          <div class="char-name">${c.name?.full||''}</div>
        </div>`).join('');
    }
  }
}

window.filterEpisodes=q=>{
  document.querySelectorAll('#episodes-grid .ep-btn').forEach(b => b.style.display=b.title.includes(q)?'':'none');
};
window.toggleSynopsis=()=>{
  const el=qs('anime-synopsis'),btn=qs('read-more-btn'); if(!el||!btn) return;
  el.classList.toggle('collapsed'); btn.textContent=el.classList.contains('collapsed')?'Leer más ▼':'Leer menos ▲';
};

async function loadRelated(a) {
  const grid=qs('related-grid'); if (!grid) return;
  grid.innerHTML=skeletons(6);
  try {
    const genre=(a.genres||[])[0]||'Action';
    const{animes}=await anilistByGenre(genre,1,12);
    const filtered=animes.filter(x=>x.id!==a.id).slice(0,10);
    grid.innerHTML=filtered.map(card).join(''); initScrollArrows();
  } catch { grid.innerHTML=''; }
}

/* ══════════════════════════════════════════════════════════
   REPRODUCTOR  (player.html)
   FIX: no usar parseInt() para IDs de string
══════════════════════════════════════════════════════════ */
async function initPlayerPage() {
  initNavbar(); initSearch();
  const p      = new URLSearchParams(location.search);
  const rawId  = p.get('id');
  const source = p.get('source') || 'jikan';
  const ep     = parseInt(p.get('ep')) || 1;
  const slug   = decodeURIComponent(p.get('slug') || '');

  if (!rawId) { location.href='index.html'; return; }
  // FIX: no convertir a número si es un slug string
  const id = /^\d+$/.test(rawId) ? parseInt(rawId) : rawId;

  const loadEl=qs('player-loading'), contentEl=qs('player-content');

  try {
    // 1. Metadata del anime
    let anime;
    if (source==='anilist') {
      anime = await anilistDetail(id);
    } else if (source==='aflv') {
      const aflvData = await aflvDetailAPI(id);
      const jikanRes = aflvData?.title ? await jikanSearch(aflvData.title,1) : [];
      anime = jikanRes[0] || { id, source:'aflv', title:aflvData?.title||'Anime',
        cover:aflvData?.cover||'', synopsis:aflvData?.synopsis||'', episodes:aflvData?.episodeCount||12,
        genres:[], status:aflvData?.status||'', type:'TV', rating:null, year:null, studios:[] };
    } else {
      anime = await jikanDetail(id);
    }
    if (!anime) throw new Error('No se encontró el anime');

    // 2. Determina el slug AnimeFLV
    let aflvSlug = slug || getSlug(anime.id||id);

    // 3. Render del UI
    renderPlayerUI(anime, id, source, ep, aflvSlug||'');
    if (loadEl) loadEl.style.display='none'; if (contentEl) contentEl.style.display='flex';
    document.title = `${anime.title} · Ep ${ep} — Kawaii Anime`;

    // 4. Resuelve y carga los servidores
    await loadPlayerServers(anime, id, source, ep, aflvSlug);

  } catch(err) {
    console.error('Player:', err);
    if (loadEl) loadEl.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p><a href="index.html" style="color:var(--accent-light);margin-top:16px;display:inline-block">← Volver</a></div>`;
  }
}

function renderPlayerUI(anime, id, source, ep, aflvSlug) {
  setText('player-anime-title', anime.title);
  setText('player-ep-info', `Episodio ${ep}${anime.episodes?' / '+anime.episodes:''}`);
  const bcAnime=qs('bc-anime-link'), bcEp=qs('bc-ep');
  if (bcAnime) { bcAnime.textContent=anime.title; bcAnime.href=`anime.html?id=${id}&source=${source}`; }
  if (bcEp) bcEp.textContent=`Episodio ${ep}`;
  const poster=qs('player-poster'); if (poster) { poster.src=anime.cover; poster.alt=anime.title; }
  setText('player-info-title',    anime.title);
  setText('player-info-subtitle', `Episodio ${ep}`);

  const total=anime.episodes||999;
  const prev=qs('prev-ep-btn'), next=qs('next-ep-btn');
  if (prev) { prev.disabled=ep<=1;     prev.onclick=()=>goPlayer(id,source,ep-1,aflvSlug); }
  if (next) { next.disabled=ep>=total; next.onclick=()=>goPlayer(id,source,ep+1,aflvSlug); }
  const goBtn=qs('go-anime-btn'); if(goBtn) goBtn.onclick=()=>location.href=`anime.html?id=${id}&source=${source}`;

  // Sidebar de episodios
  const sl=qs('sidebar-ep-list');
  if (sl) {
    const count=Math.min(anime.episodes||12,500);
    sl.innerHTML = Array.from({length:count},(_,i) => {
      const n=i+1;
      const safeSlug=(aflvSlug||'').replace(/'/g,"\\'");
      return `<div class="sidebar-ep-item ${n===ep?'active':''}" onclick="goPlayer('${id}','${source}',${n},'${safeSlug}')">
        <div class="ep-thumb"><img src="${anime.cover}" alt="" loading="lazy"><span class="ep-num-overlay">${n}</span></div>
        <div class="ep-info"><div class="ep-title">${anime.title}</div><div class="ep-num">Episodio ${n}</div></div>
      </div>`;
    }).join('');
    sl.querySelector('.active')?.scrollIntoView({block:'center'});
  }
}

async function loadPlayerServers(anime, id, source, ep, prevSlug) {
  const serversRow=qs('servers-row'), embedDiv=qs('player-embed');
  if (serversRow) serversRow.innerHTML=`<div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:13px"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div>Buscando servidores…</div>`;
  if (embedDiv)  embedDiv.innerHTML=`<div class="player-embed-placeholder"><div class="big-play" style="animation:pulse 1.5s infinite">▶</div><p style="color:var(--accent-light)">Obteniendo episodio ${ep}…</p></div>`;

  const { servers, mode, aflvSlug } = await resolveServers(anime, anime.id||id, ep);

  if (!servers.length) {
    renderNoServers(anime.title, ep, anime.id||id);
    return;
  }

  // Separa por idioma
  const lat = servers.filter(s => s.lang==='latino');
  const sub = servers.filter(s => s.lang!=='latino');

  // Construye los botones de servidor
  if (serversRow) {
    let html = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">`;
    if (lat.length) {
      html += `<span class="lang-label-btn" style="font-size:11px;color:#f59e0b;font-weight:700;text-transform:uppercase;letter-spacing:1px">🎌 LATINO</span>`;
      html += lat.map((s,i) => buildSrvBtn(s, i===0 && !sub.length, mode)).join('');
    }
    if (sub.length) {
      if (lat.length) html += `<span style="width:1px;height:22px;background:var(--border-subtle);display:inline-block;margin:0 3px"></span>`;
      const label = mode==='hls' ? '📖 SUB ESP (Gogoanime)' : '📖 SUB ESP';
      html += `<span class="lang-label-btn" style="font-size:11px;color:#0ea5e9;font-weight:700;text-transform:uppercase;letter-spacing:1px">${label}</span>`;
      html += sub.map((s,i) => buildSrvBtn(s, i===0 && lat.length===0, mode)).join('');
    }
    html += '</div>';
    serversRow.innerHTML = html;
  }

  // Carga automático el primer servidor disponible
  const first = lat[0] || sub[0];
  if (first && embedDiv) {
    if (mode === 'hls') {
      injectHLS(first.url || first.embed, embedDiv);
    } else {
      const ok = injectIframe(first.embed || first.url, embedDiv);
      if (!ok) renderNoServers(anime.title, ep, anime.id||id);
    }
  }
}

function buildSrvBtn(s, isActive, mode) {
  const enc  = encodeURIComponent(s.embed || s.url || '');
  const modeStr = mode === 'hls' ? 'hls' : 'iframe';
  return `<button class="server-btn ${isActive?'active':''}"
    style="${isActive?`border-color:${s.color};color:${s.color}`:''}"
    onclick="selectSrv(this,'${enc}','${s.lang}','${s.name}','${modeStr}')">
    <span class="dot-status" style="background:${s.color}"></span>
    ${s.icon} ${s.name}
  </button>`;
}

window.selectSrv = (btn, encEmbed, lang, name, mode) => {
  document.querySelectorAll('.server-btn').forEach(b => { b.classList.remove('active'); b.style.borderColor=''; b.style.color=''; });
  btn.classList.add('active');
  const label = lang==='latino' ? '🎌 Latino' : '📖 Sub español';
  showToast(`${name} — ${label}`, 'success');
  const embedDiv = qs('player-embed');
  if (!embedDiv) return;
  embedDiv.innerHTML = `<div class="player-embed-placeholder"><div class="big-play" style="animation:pulse 1s infinite">▶</div><p style="color:var(--accent-light)">Cargando ${name}…</p></div>`;
  const url = decodeURIComponent(encEmbed);
  setTimeout(() => {
    if (mode === 'hls') {
      injectHLS(url, embedDiv);
    } else {
      const ok = injectIframe(url, embedDiv);
      if (!ok) handleVideoError();
    }
  }, 600);

  // Actualiza el badge de idioma
  const badge = qs('lang-badge');
  if (badge) {
    badge.className = lang==='latino' ? 'lang-indicator lang-latino' : 'lang-indicator lang-sub';
    badge.textContent = lang==='latino' ? '🎌 Latino' : '📖 Sub esp';
  }
};

function renderNoServers(animeTitle, ep, animeId) {
  const sr=qs('servers-row'), ed=qs('player-embed');
  const aflvUrl = animeId ? `https://www3.animeflv.net/anime/${getSlug(animeId)||''}` : 'https://www3.animeflv.net';
  if (sr) sr.innerHTML=`<div style="font-size:13px;color:var(--text-muted);padding:4px 0;line-height:1.7">
    ⚠️ No se encontraron servidores automáticamente.<br>
    <a href="${aflvUrl}" target="_blank" rel="noopener" style="color:var(--accent-light)">📺 Ver en AnimeFLV directamente →</a>
  </div>`;
  if (ed) ed.innerHTML=`<div class="player-embed-placeholder">
    <div class="big-play">⚠️</div>
    <h3 style="font-family:var(--font-head);font-size:1.2rem;text-align:center">${animeTitle||'Episodio'} ${ep?'— Ep '+ep:''}</h3>
    <p style="color:var(--text-muted);font-size:13px;text-align:center;max-width:380px;line-height:1.7">
      No se encontraron servidores para este episodio.<br>
      Prueba con el botón <strong style="color:var(--accent-light)">siguiente episodio</strong>,
      otro episodio de la lista, o visita AnimeFLV directamente.
    </p>
    <a href="${aflvUrl}" target="_blank" rel="noopener"
       style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--accent);color:white;border-radius:99px;font-size:14px;font-weight:700;margin-top:4px;text-decoration:none">
      📺 Ver en AnimeFLV
    </a>
  </div>`;
}

window.filterSidebarEps = q => {
  document.querySelectorAll('.sidebar-ep-item').forEach(item => {
    const num=item.querySelector('.ep-num')?.textContent||'';
    item.style.display=!q||num.includes(q)?'':'none';
  });
};
window.toggleTheater = () => {
  const layout=document.querySelector('.player-layout'), sidebar=document.querySelector('.player-sidebar');
  if (!layout) return;
  const t=layout.classList.toggle('theater');
  if (sidebar) sidebar.style.display=t?'none':'';
  showToast(t?'🎬 Modo cine activado':'Modo normal','info');
};
window.changeQuality = q => showToast(`Calidad: ${q}p`, 'success');
window.changeLang    = l => showToast(l==='dub'?'🎌 Español Latino':'📖 Subtitulado al español','success');

/* ── Arranque ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page==='home')   initHomePage();
  if (page==='anime')  initAnimePage();
  if (page==='player') initPlayerPage();
  qs('scroll-top-btn')?.addEventListener('click', () => scrollTo({top:0,behavior:'smooth'}));
});
