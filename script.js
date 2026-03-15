/* ============================================================
   KAWAII ANIME — script.js  v2.0
   ─────────────────────────────────────────────────────────
   APIs integradas:
     • AnimeFLV (animeflv.ahmedrangel.com) → series en español,
       episodios, servidores de video Latino / Sub
     • Jikan v4 (api.jikan.moe)           → metadata MAL
     • AniList GraphQL                    → trending, populares
   ============================================================ */

'use strict';

/* ── Endpoints ─────────────────────────────────────────── */
const API = {
  JIKAN  : 'https://api.jikan.moe/v4',
  ANILIST: 'https://graphql.anilist.co',
  AFLV   : 'https://animeflv.ahmedrangel.com/api',
  PROXY  : 'https://api.allorigins.win/raw?url=',
};

/* ── Metadatos de servidores de video ──────────────────── */
const SERVERS_META = {
  sw   : { name:'StreamWish',  icon:'🎬', color:'#7c3aed' },
  yu   : { name:'YourUpload',  icon:'📺', color:'#0ea5e9' },
  mp4  : { name:'Mp4Upload',   icon:'💾', color:'#10b981' },
  voe  : { name:'Voe',         icon:'⚡', color:'#f59e0b' },
  bu   : { name:'Burstcloud',  icon:'☁️', color:'#64748b' },
  dood : { name:'DoodStream',  icon:'🌊', color:'#06b6d4' },
  sb   : { name:'StreamSB',    icon:'📡', color:'#8b5cf6' },
  netu : { name:'Netu.tv',     icon:'🌐', color:'#ec4899' },
  fds  : { name:'Filemoon',    icon:'🌙', color:'#f97316' },
  ok   : { name:'Ok.ru',       icon:'🆗', color:'#22c55e' },
  mega : { name:'Mega',        icon:'💜', color:'#8b5cf6' },
  zt   : { name:'Zoro',        icon:'⚔️', color:'#ef4444' },
};

/* ── Géneros ───────────────────────────────────────────── */
const GENRES = [
  { name:'Acción',        icon:'⚔️',  anilist:'Action'       },
  { name:'Aventura',      icon:'🗺️',  anilist:'Adventure'    },
  { name:'Comedia',       icon:'😂',  anilist:'Comedy'       },
  { name:'Romance',       icon:'💕',  anilist:'Romance'      },
  { name:'Fantasía',      icon:'🔮',  anilist:'Fantasy'      },
  { name:'Isekai',        icon:'🌀',  anilist:'Isekai'       },
  { name:'Terror',        icon:'👻',  anilist:'Horror'       },
  { name:'Sci-Fi',        icon:'🚀',  anilist:'Sci-Fi'       },
  { name:'Slice of Life', icon:'🌸',  anilist:'Slice of Life'},
  { name:'Deportes',      icon:'⚽',  anilist:'Sports'       },
  { name:'Misterio',      icon:'🕵️', anilist:'Mystery'      },
  { name:'Drama',         icon:'🎭',  anilist:'Drama'        },
  { name:'Shounen',       icon:'🔥',  anilist:'Action'       },
  { name:'Mecha',         icon:'🤖',  anilist:'Mecha'        },
  { name:'Sobrenatural',  icon:'✨',  anilist:'Supernatural' },
  { name:'Psicológico',   icon:'🧠',  anilist:'Psychological'},
];

/* ── Estado ────────────────────────────────────────────── */
const STATE = {
  heroAnimes   : [],
  heroIndex    : 0,
  heroTimer    : null,
  aflvSlugCache: {},
  genrePage    : 1,
  genreActive  : null,
  infScrollPage: 2,
  isLoading    : false,
};

/* ══════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════ */

async function http(url, opts = {}) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(tid); }
}

async function httpAFLV(path) {
  const url = `${API.AFLV}${path}`;
  try { return await http(url); }
  catch {
    try { return await http(`${API.PROXY}${encodeURIComponent(url)}`); }
    catch(e) { console.warn('AnimeFLV no disponible:', e.message); return null; }
  }
}

async function graphql(query, variables = {}) {
  const data = await http(API.ANILIST, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body   : JSON.stringify({ query, variables }),
  });
  return data.data;
}

const sleep    = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const truncate = (s, n)   => s && s.length > n ? s.slice(0,n)+'…' : (s||'Sin sinopsis disponible.');
const qs       = id       => document.getElementById(id);
const setText  = (id, v)  => { const el = qs(id); if (el) el.textContent = v ?? '—'; };

function coverImg(a) {
  return a?.images?.jpg?.large_image_url || a?.images?.jpg?.image_url
    || a?.coverImage?.extraLarge || a?.coverImage?.large || a?.coverImage?.medium
    || a?.poster || a?.cover
    || 'https://placehold.co/300x420/0e1422/7c3aed?text=Sin+imagen';
}

function goAnime(id, src) { location.href = `anime.html?id=${id}&source=${src}`; }
function goPlayer(id, src, ep, slug) {
  location.href = `player.html?id=${id}&source=${src}&ep=${ep}${slug?'&slug='+encodeURIComponent(slug):''}`;
}

/* ── Toast ─────────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  let c = qs('toast-container');
  if (!c) { c = document.createElement('div'); c.id='toast-container'; c.className='toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ── Tarjetas ──────────────────────────────────────────── */
function card(a) {
  const score = a.rating ? parseFloat(a.rating).toFixed(1) : '?';
  const isDub = a.isDub ?? false;
  return `
  <div class="anime-card" onclick="goAnime(${JSON.stringify(a.id)},${JSON.stringify(a.source)})" title="${a.title}">
    <div class="cover-wrap">
      <img src="${a.cover}" alt="${a.title}" loading="lazy"
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
      <div class="card-title">${a.title}</div>
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

/* ── Normalización ─────────────────────────────────────── */
function normJikan(a) {
  return { id:a.mal_id, source:'jikan', title:a.title_english||a.title, titleJp:a.title_japanese,
    cover:coverImg(a), synopsis:a.synopsis, rating:a.score, episodes:a.episodes, status:a.status,
    genres:(a.genres||[]).map(g=>g.name), year:a.year, members:a.members, type:a.type,
    studios:(a.studios||[]).map(s=>s.name), rank:a.rank, season:a.season };
}

function normAniList(a) {
  return { id:a.id, source:'anilist', title:a.title?.english||a.title?.romaji, titleJp:a.title?.native,
    cover:coverImg(a), synopsis:a.description?.replace(/<[^>]*>/g,''),
    rating:a.averageScore?(a.averageScore/10).toFixed(1):null, episodes:a.episodes, status:a.status,
    genres:a.genres||[], year:a.seasonYear, members:a.popularity, type:a.format, season:a.season,
    studios:a.studios?.nodes?.map(s=>s.name)||[], banner:a.bannerImage };
}

function normAFLV(a) {
  return { id:a.id||a.slug, source:'aflv', slug:a.id||a.slug, title:a.title,
    cover:a.poster||a.cover, synopsis:a.synopsis||a.description,
    rating:a.rating, episodes:a.episodes?.length||a.episodeCount||null,
    status:a.status, genres:a.genres||[], type:a.type, isDub:false };
}

/* ══════════════════════════════════════════════════════════
   API: JIKAN
══════════════════════════════════════════════════════════ */
async function jikanSearch(q, limit=10) {
  const d = await http(`${API.JIKAN}/anime?q=${encodeURIComponent(q)}&limit=${limit}&sfw=true`);
  return (d.data||[]).map(normJikan);
}
async function jikanDetail(id) {
  const d = await http(`${API.JIKAN}/anime/${id}/full`);
  return normJikan(d.data);
}
async function jikanTopRated(page=1) {
  const d = await http(`${API.JIKAN}/top/anime?page=${page}&limit=20`);
  return (d.data||[]).map(normJikan);
}
async function jikanSeason() {
  const d = await http(`${API.JIKAN}/seasons/now?limit=20`);
  return (d.data||[]).slice(0,20).map(normJikan);
}

/* ══════════════════════════════════════════════════════════
   API: ANILIST
══════════════════════════════════════════════════════════ */
const GQL = `id title{romaji english native} coverImage{extraLarge large medium}
  bannerImage averageScore episodes status genres seasonYear popularity format
  description studios{nodes{name}} season`;

async function anilistTrending(page=1,pp=20) {
  const q=`query($p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(sort:TRENDING_DESC,type:ANIME,isAdult:false){${GQL}}}}`;
  const d=await graphql(q,{p:page,pp});
  return d.Page.media.map(normAniList);
}
async function anilistPopular(page=1,pp=20) {
  const q=`query($p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){${GQL}}}}`;
  const d=await graphql(q,{p:page,pp});
  return d.Page.media.map(normAniList);
}
async function anilistByGenre(genre,page=1,pp=20) {
  const q=`query($g:String,$p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(genre:$g,sort:POPULARITY_DESC,type:ANIME,isAdult:false){${GQL}} pageInfo{hasNextPage}}}`;
  const d=await graphql(q,{g:genre,p:page,pp});
  return { animes:d.Page.media.map(normAniList), hasMore:d.Page.pageInfo.hasNextPage };
}
async function anilistDetail(id) {
  const q=`query($id:Int){Media(id:$id,type:ANIME){${GQL}
    relations{edges{relationType node{id title{english romaji} type coverImage{medium} format}}}
    characters(sort:ROLE,perPage:8){nodes{name{full} image{medium}}}
    rankings{rank type context}}}`;
  const d=await graphql(q,{id});
  const a=d.Media;
  return { ...normAniList(a), relations:a.relations?.edges||[], characters:a.characters?.nodes||[], rankings:a.rankings||[] };
}
async function anilistMovies(page=1) {
  const q=`query($p:Int){Page(page:$p,perPage:20){media(sort:POPULARITY_DESC,type:ANIME,format:MOVIE,isAdult:false){${GQL}}}}`;
  const d=await graphql(q,{p:page});
  return d.Page.media.map(normAniList);
}

/* ══════════════════════════════════════════════════════════
   API: ANIMEFLV (español)
══════════════════════════════════════════════════════════ */

/** Episodios recientes en español */
async function aflvRecent() {
  const d = await httpAFLV('/recent-episodes');
  if (!d?.data) return [];
  return d.data.map(ep => ({
    id:'aflv_'+ep.animeSlug, source:'aflv', slug:ep.animeSlug, title:ep.title,
    cover:ep.poster||ep.cover||'https://placehold.co/300x420/0e1422/7c3aed?text=Sin+imagen',
    synopsis:'', rating:null, episodes:ep.episode, status:'En emisión',
    genres:[], type:'TV', isNew:true, lastEp:ep.episode, isDub:false,
  }));
}

/** Busca en AnimeFLV */
async function aflvSearch(q) {
  const d = await httpAFLV(`/search?q=${encodeURIComponent(q)}`);
  if (!d?.data) return [];
  return d.data.map(normAFLV);
}

/** Detalle de anime en AnimeFLV */
async function aflvDetail(slug) {
  const d = await httpAFLV(`/anime/${slug}`);
  if (!d) return null;
  const a = d.data || d;
  return {
    slug, title:a.title, cover:a.poster||a.cover, synopsis:a.synopsis||a.description,
    rating:a.rating, status:a.status, genres:a.genres||[], type:a.type,
    episodes:Array.isArray(a.episodes) ? a.episodes : [],
    episodeCount:Array.isArray(a.episodes) ? a.episodes.length : (a.episodeCount||0),
  };
}

/** Obtiene servidores de video para un episodio */
async function aflvEpisodeServers(animeSlug, epNumber) {
  const d = await httpAFLV(`/episode/${animeSlug}/${epNumber}`);
  if (!d) return [];
  const raw = d.servers || d.episode?.servers || d.data?.servers || [];
  return raw.map(s => {
    const meta  = SERVERS_META[s.server] || SERVERS_META[s.id] || {};
    const embed = s.code || s.embed || s.url || s.iframe || '';
    const url   = s.url || s.embed || '';
    const lang  = (s.lang||'').toLowerCase().includes('lat') ? 'latino' : 'sub';
    return {
      id   : s.server || s.id || 'srv',
      name : meta.name  || s.title || s.server || 'Servidor',
      icon : meta.icon  || '▶️',
      color: meta.color || '#7c3aed',
      embed, url, lang,
      allowMobile: s.allow_mobile ?? true,
    };
  }).filter(s => s.embed || s.url);
}

/** Busca y cachea el slug de AnimeFLV para un anime dado su título */
async function matchAFLVSlug(animeTitle, cacheKey) {
  if (STATE.aflvSlugCache[cacheKey]) return STATE.aflvSlugCache[cacheKey];
  try {
    const ss = sessionStorage.getItem('aflv_slug_'+cacheKey);
    if (ss) { STATE.aflvSlugCache[cacheKey]=ss; return ss; }
  } catch{}
  try {
    const results = await aflvSearch(animeTitle);
    if (!results.length) return null;
    const norm = animeTitle.toLowerCase().trim();
    let best = results[0];
    for (const r of results) {
      if (r.title?.toLowerCase().trim()===norm) { best=r; break; }
    }
    const slug = best.slug||best.id;
    STATE.aflvSlugCache[cacheKey] = slug;
    try { sessionStorage.setItem('aflv_slug_'+cacheKey, slug); } catch{}
    return slug;
  } catch { return null; }
}

function getSlug(key) {
  if (STATE.aflvSlugCache[key]) return STATE.aflvSlugCache[key];
  try { return sessionStorage.getItem('aflv_slug_'+key)||null; } catch { return null; }
}

/* ══════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════ */
async function initHero() {
  if (!qs('hero-section')) return;
  try {
    const list = await anilistTrending(1,8);
    STATE.heroAnimes = list.filter(a=>a.cover);
    renderHeroSlide(0); renderHeroDots(); startHeroTimer();
  } catch(e){ console.error('Hero:',e); }
}

function renderHeroSlide(idx) {
  const a = STATE.heroAnimes[idx]; if (!a) return;
  STATE.heroIndex = idx;
  const bg = qs('hero-bg'); if(bg) bg.style.backgroundImage=`url(${a.banner||a.cover})`;
  setText('hero-title', a.title); setText('hero-desc', truncate(a.synopsis||'',220));
  const meta = qs('hero-meta');
  if(meta) meta.innerHTML=`
    <span class="rating">⭐ ${a.rating||'?'}</span>
    <div class="genres">${(a.genres||[]).slice(0,3).map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div>
    ${a.year?`<span style="color:var(--text-muted);font-size:13px">${a.year}</span>`:''}
    ${a.episodes?`<span style="color:var(--text-muted);font-size:13px">${a.episodes} eps</span>`:''}`;
  const wb=qs('hero-watch-btn'), ib=qs('hero-info-btn');
  if(wb) wb.onclick=()=>goAnime(a.id,a.source);
  if(ib) ib.onclick=()=>goAnime(a.id,a.source);
  document.querySelectorAll('.hero-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
}
function renderHeroDots() {
  const c=qs('hero-dots'); if(!c) return;
  c.innerHTML=STATE.heroAnimes.map((_,i)=>`<button class="hero-dot ${i===0?'active':''}" onclick="changeHeroSlide(${i})"></button>`).join('');
}
function startHeroTimer() {
  clearInterval(STATE.heroTimer);
  STATE.heroTimer=setInterval(()=>renderHeroSlide((STATE.heroIndex+1)%STATE.heroAnimes.length),6000);
}
window.changeHeroSlide = i => { renderHeroSlide(i); startHeroTimer(); };

/* ══════════════════════════════════════════════════════════
   CARGA DE FILAS / GRILLA
══════════════════════════════════════════════════════════ */
async function loadRow(rowId, fetchFn) {
  const row = qs(rowId); if(!row) return;
  row.innerHTML = skeletons(8);
  try { const list=await fetchFn(); row.innerHTML=list.map(card).join(''); }
  catch(e){ row.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>`; console.error(rowId,e); }
}

function renderGenres() {
  const grid=qs('genres-grid'); if(!grid) return;
  grid.innerHTML=GENRES.map(g=>`
    <button class="genre-btn" data-genre="${g.anilist}"
            onclick="location.href='index.html?genre=${encodeURIComponent(g.anilist)}&gname=${encodeURIComponent(g.name)}'">
      <span class="genre-icon">${g.icon}</span>
      <span class="genre-name">${g.name}</span>
    </button>`).join('');
}

function initScrollArrows() {
  document.querySelectorAll('.scroll-row-wrapper').forEach(wrap=>{
    const row=wrap.querySelector('.scroll-row'),l=wrap.querySelector('.scroll-arrow.left'),r=wrap.querySelector('.scroll-arrow.right');
    if(!row||!l||!r) return;
    l.addEventListener('click',()=>row.scrollBy({left:-640,behavior:'smooth'}));
    r.addEventListener('click',()=>row.scrollBy({left:640,behavior:'smooth'}));
  });
}

function initNavbar() {
  const nav=document.querySelector('.navbar'); if(!nav) return;
  window.addEventListener('scroll',()=>{
    nav.classList.toggle('scrolled',scrollY>40);
    qs('scroll-top-btn')?.classList.toggle('visible',scrollY>400);
  });
  const hb=qs('hamburger'),mob=qs('mobile-nav');
  if(hb&&mob) hb.addEventListener('click',()=>mob.classList.toggle('open'));
}

function initSearch() {
  const input=qs('search-input'),drop=qs('search-dropdown'); if(!input) return;
  const doSearch=debounce(async q=>{
    if(!q.trim()){drop.classList.remove('active');return;}
    drop.innerHTML='<div class="loading-spinner" style="padding:20px"><div class="spinner"></div></div>';
    drop.classList.add('active');
    try {
      const results=await jikanSearch(q,8);
      if(!results.length){drop.innerHTML=`<div class="empty-state" style="padding:16px"><p>Sin resultados para «${q}»</p></div>`;return;}
      drop.innerHTML=results.map(a=>`
        <div class="search-result-item" onclick="goAnime(${a.id},'jikan')">
          <img src="${a.cover}" alt="${a.title}" loading="lazy">
          <div class="info">
            <div class="title">${a.title}</div>
            <div class="meta">⭐ ${a.rating||'?'} · ${a.year||'?'} · ${a.type||'TV'}</div>
          </div>
        </div>`).join('');
    } catch{ drop.innerHTML=`<div class="empty-state" style="padding:14px"><p>Error al buscar.</p></div>`; }
  },420);
  input.addEventListener('input',e=>doSearch(e.target.value));
  document.addEventListener('click',e=>{if(!input.closest('.nav-search').contains(e.target))drop.classList.remove('active');});
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape')drop.classList.remove('active');
    if(e.key==='Enter'&&input.value.trim())location.href=`index.html?search=${encodeURIComponent(input.value.trim())}`;
  });
}

/* Top 50 table */
async function loadTopTable() {
  const c=qs('top-rated-list'); if(!c) return;
  c.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
  try {
    const list=await jikanTopRated(1);
    const rc=i=>i===0?'gold':i===1?'silver':i===2?'bronze':'';
    c.innerHTML=list.slice(0,25).map((a,i)=>`
      <div class="top-item" onclick="goAnime(${a.id},'jikan')">
        <span class="top-rank ${rc(i)}">${i+1}</span>
        <img src="${a.cover}" alt="${a.title}" loading="lazy">
        <div class="info">
          <div class="title">${a.title}</div>
          <div class="meta"><span>${a.type||'TV'}</span><span>${a.year||'?'}</span><span>${a.episodes?a.episodes+' eps':''}</span></div>
        </div>
        <div class="top-score">
          <span class="score">⭐ ${a.rating||'?'}</span>
          <span class="votes">${a.members?(a.members/1000).toFixed(0)+'k':''}</span>
        </div>
      </div>`).join('');
  } catch{ c.innerHTML='<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>'; }
}

/* Infinite scroll */
function initInfiniteScroll() {
  const sentinel=qs('scroll-sentinel'); if(!sentinel) return;
  new IntersectionObserver(async entries=>{
    if(!entries[0].isIntersecting||STATE.isLoading) return;
    STATE.isLoading=true; await loadMoreMainGrid(); STATE.isLoading=false;
  },{rootMargin:'240px'}).observe(sentinel);
}
async function loadMoreMainGrid() {
  const grid=qs('main-grid'); if(!grid) return;
  const spin=document.createElement('div'); spin.className='loading-spinner'; spin.innerHTML='<div class="spinner"></div>';
  qs('scroll-sentinel')?.before(spin);
  try {
    const list=await anilistPopular(STATE.infScrollPage++);
    spin.remove(); list.forEach(a=>{const el=document.createElement('div');el.innerHTML=card(a);grid.appendChild(el.firstElementChild);});
  } catch{ spin.remove(); }
}

/* ══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════ */
async function initHomePage() {
  initNavbar(); initSearch(); renderGenres();
  await Promise.allSettled([
    initHero(),
    loadRow('recent-row', async()=>{ const a=await aflvRecent(); return a.length?a:jikanSeason(); }),
    loadRow('trending-row', ()=>anilistTrending(1)),
    loadRow('popular-row',  ()=>anilistPopular(1)),
  ]);
  await sleep(300);
  await loadRow('toprated-row',()=>jikanTopRated(1));
  await loadRow('main-grid',   ()=>anilistPopular(1));
  initScrollArrows(); initInfiniteScroll();

  const p=new URLSearchParams(location.search);
  if(p.get('genre')) showGenreSection(p.get('genre'),p.get('gname')||p.get('genre'));
  if(p.get('search')) showSearchSection(p.get('search'));
}

async function showGenreSection(genre,displayName) {
  const sec=qs('genre-results-section'),t=qs('genre-title'),grid=qs('genre-grid');
  if(!sec||!grid) return;
  sec.style.display='block'; if(t)t.textContent=(displayName||genre).toUpperCase();
  STATE.genrePage=1; STATE.genreActive=genre; grid.innerHTML=skeletons(12);
  document.querySelectorAll('.genre-btn').forEach(b=>b.classList.toggle('active',b.dataset.genre===genre));
  try { const{animes}=await anilistByGenre(genre,1); grid.innerHTML=animes.map(card).join(''); }
  catch{ grid.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>`; }
  sec.scrollIntoView({behavior:'smooth'});
}

window.loadMoreGenre=async()=>{
  if(!STATE.genreActive) return;
  STATE.genrePage++;
  const btn=qs('load-more-genre'),grid=qs('genre-grid'); if(!btn||!grid) return;
  btn.textContent='Cargando…'; btn.classList.add('loading');
  try {
    const{animes,hasMore}=await anilistByGenre(STATE.genreActive,STATE.genrePage);
    animes.forEach(a=>{const el=document.createElement('div');el.innerHTML=card(a);grid.appendChild(el.firstElementChild);});
    if(!hasMore)btn.style.display='none';
  } catch{ showToast('Error','error'); }
  finally{ btn.textContent='Cargar más'; btn.classList.remove('loading'); }
};

async function showSearchSection(q) {
  const sec=qs('search-results-section'),hd=qs('search-results-title'),grid=qs('search-results-grid');
  if(!sec||!grid) return;
  sec.style.display='block'; if(hd)hd.textContent=`Resultados para: "${q}"`;
  grid.innerHTML=skeletons(12);
  try {
    const results=await jikanSearch(q,24);
    grid.innerHTML=results.length?results.map(card).join(''):`<div class="empty-state"><div class="icon">🔍</div><h3>Sin resultados</h3></div>`;
  } catch{ grid.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>`; }
  sec.scrollIntoView({behavior:'smooth'});
}

window.switchTab=async(tabId,btn)=>{
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active'); const content=qs(tabId); if(content)content.classList.add('active');
  if(tabId==='tab-top'){loadTopTable();return;}
  const map={'tab-latino':'latino-row','tab-sub':'sub-row','tab-movies':'movies-row'};
  const rowId=map[tabId]; if(!rowId) return;
  const row=qs(rowId); if(!row||row.dataset.loaded) return;
  row.dataset.loaded='1';
  if(tabId==='tab-latino') await loadRow(rowId,async()=>{const a=await aflvRecent();return a.length?a:anilistTrending(2,20);});
  if(tabId==='tab-sub')    await loadRow(rowId,()=>anilistTrending(3,20));
  if(tabId==='tab-movies') await loadRow(rowId,()=>anilistMovies(1));
  initScrollArrows();
};

/* ══════════════════════════════════════════════════════════
   PÁGINA ANIME (anime.html)
══════════════════════════════════════════════════════════ */
async function initAnimePage() {
  initNavbar(); initSearch();
  const p=new URLSearchParams(location.search);
  const id=parseInt(p.get('id')); const source=p.get('source')||'jikan';
  if(!id){location.href='index.html';return;}

  const loadEl=qs('anime-loading'),detailEl=qs('anime-detail-content');
  if(loadEl)loadEl.style.display='flex'; if(detailEl)detailEl.style.display='none';

  try {
    // 1. Metadata
    let anime = source==='anilist' ? await anilistDetail(id) : await jikanDetail(id);

    // 2. AnimeFLV slug (en paralelo para no bloquear el render)
    let aflvSlug = getSlug(id);
    const aflvPromise = aflvSlug ? aflvDetail(aflvSlug) : matchAFLVSlug(anime.title,id).then(async slug=>{
      aflvSlug=slug; return slug ? aflvDetail(slug) : null;
    });

    // 3. Render inmediato con datos de Jikan/AniList
    renderAnimeDetail(anime, id, source, aflvSlug||'');
    renderEpisodes(anime, id, source, aflvSlug||'');
    renderSidebarStats(anime, id, source, aflvSlug||'');
    document.title=`${anime.title} — Kawaii Anime`;
    if(loadEl)loadEl.style.display='none'; if(detailEl)detailEl.style.display='block';

    // 4. Cuando lleguen datos de AnimeFLV, actualiza episodios y estadísticas
    aflvPromise.then(aflvData=>{
      if(!aflvData) return;
      // Actualiza conteo de episodios con dato más preciso de AnimeFLV
      const epCount = aflvData.episodeCount || aflvData.episodes?.length || anime.episodes;
      setText('anime-episodes-count', epCount||'?');
      setText('stat-episodes', epCount?epCount+' eps':'—');
      setText('stat-aflv','✅ Disponible en español');
      // Si la sinopsis de AnimeFLV es mejor (en español), úsala
      if(aflvData.synopsis && aflvData.synopsis.length>(anime.synopsis||'').length){
        const syEl=qs('anime-synopsis'); if(syEl)syEl.textContent=aflvData.synopsis;
      }
      // Re-renderiza episodios con el slug correcto
      renderEpisodes({...anime, episodeCount:epCount}, id, source, aflvSlug||'');
      // Actualiza botones
      const wb=qs('anime-watch-btn'); if(wb)wb.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
      const ws=qs('watch-btn-sidebar'); if(ws)ws.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
    }).catch(()=>{});

    // 5. Relacionados
    loadRelated(anime);

  } catch(err){
    console.error('Anime page:',err);
    if(loadEl)loadEl.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error al cargar</h3><p>${err.message}</p><a href="index.html" style="color:var(--accent-light);margin-top:16px;display:inline-block">← Volver</a></div>`;
  }
}

function renderAnimeDetail(a, id, source, aflvSlug) {
  const bg=qs('anime-hero-bg'),img=qs('anime-poster-img');
  if(bg)bg.style.backgroundImage=`url(${a.banner||a.cover})`;
  if(img){img.src=a.cover;img.alt=a.title;}
  setText('anime-title',a.title); setText('anime-jp-title',a.titleJp||'');
  setText('anime-score',a.rating||'?'); setText('anime-episodes-count',a.episodes||'?');
  setText('anime-year',a.year||'?'); setText('anime-type',a.type||'TV');
  setText('anime-studios',(a.studios||[]).join(', ')||'—');
  const synopsis=qs('anime-synopsis'); if(synopsis)synopsis.textContent=a.synopsis||'Sin sinopsis disponible.';
  const statusEl=qs('anime-status');
  if(statusEl){
    const ongoing=a.status==='Currently Airing'||a.status==='RELEASING'||a.status?.includes('misión');
    statusEl.className=`status-badge ${ongoing?'status-ongoing':'status-finished'}`;
    statusEl.innerHTML=`${ongoing?'🟢':'⬜'} ${ongoing?'En emisión':'Finalizado'}`;
  }
  const genresEl=qs('anime-genres');
  if(genresEl)genresEl.innerHTML=(a.genres||[]).map(g=>`<span class="tag" onclick="location.href='index.html?genre=${encodeURIComponent(g)}&gname=${encodeURIComponent(g)}'">${g}</span>`).join('');
  const wb=qs('anime-watch-btn'); if(wb)wb.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
}

function renderEpisodes(a, id, source, aflvSlug) {
  const grid=qs('episodes-grid'); if(!grid) return;
  const count=a.episodeCount||a.episodes||12; const max=Math.min(count,500);
  grid.innerHTML=Array.from({length:max},(_,i)=>{
    const ep=i+1;
    return `<button class="ep-btn" title="Episodio ${ep}" onclick="goPlayer(${id},'${source}',${ep},'${aflvSlug||''}')">Ep ${ep}</button>`;
  }).join('');
}

function renderSidebarStats(a, id, source, aflvSlug) {
  const ongoing=a.status==='Currently Airing'||a.status==='RELEASING';
  setText('stat-status',ongoing?'🟢 En emisión':'⬜ Finalizado');
  setText('stat-type',a.type||'—'); setText('stat-episodes',a.episodes?a.episodes+' eps':'—');
  setText('stat-year',a.year||'—'); setText('stat-rating',a.rating?'⭐ '+a.rating:'—');
  setText('stat-popularity',a.members?Math.round(a.members/1000)+'k miembros':'—');
  setText('stat-studios',(a.studios||[]).join(', ')||'—');
  setText('stat-aflv','⏳ Buscando en español…');
  const sg=qs('sidebar-genres');
  if(sg)sg.innerHTML=(a.genres||[]).map(g=>`<span class="tag" onclick="location.href='index.html?genre=${encodeURIComponent(g)}'">${g}</span>`).join('');
  const wb=qs('watch-btn-sidebar'); if(wb)wb.onclick=()=>goPlayer(id,source,1,aflvSlug||'');
  if(a.characters?.length){
    const cg=qs('characters-grid');
    if(cg)cg.innerHTML=a.characters.map(c=>`
      <div class="char-card">
        <img src="${c.image?.medium||''}" alt="${c.name?.full}" loading="lazy" onerror="this.src='https://placehold.co/80x80/131928/7c3aed?text=?'">
        <div class="char-name">${c.name?.full||''}</div>
      </div>`).join('');
  }
}

window.filterEpisodes=q=>{
  document.querySelectorAll('#episodes-grid .ep-btn').forEach(b=>b.style.display=b.title.includes(q)?'':'none');
};
window.toggleSynopsis=()=>{
  const el=qs('anime-synopsis'),btn=qs('read-more-btn'); if(!el||!btn) return;
  el.classList.toggle('collapsed'); btn.textContent=el.classList.contains('collapsed')?'Leer más ▼':'Leer menos ▲';
};

async function loadRelated(a) {
  const grid=qs('related-grid'); if(!grid) return;
  grid.innerHTML=skeletons(6);
  try {
    const genre=(a.genres||[])[0]||'Action';
    const{animes}=await anilistByGenre(genre,1,12);
    const filtered=animes.filter(x=>x.id!==a.id).slice(0,10);
    grid.innerHTML=filtered.map(card).join(''); initScrollArrows();
  } catch{ grid.innerHTML=''; }
}

/* ══════════════════════════════════════════════════════════
   REPRODUCTOR (player.html)
══════════════════════════════════════════════════════════ */
async function initPlayerPage() {
  initNavbar(); initSearch();
  const p=new URLSearchParams(location.search);
  const id=parseInt(p.get('id')); const source=p.get('source')||'jikan';
  const ep=parseInt(p.get('ep'))||1; const slug=decodeURIComponent(p.get('slug')||'');
  if(!id){location.href='index.html';return;}

  const loadEl=qs('player-loading'),contentEl=qs('player-content');

  try {
    // Metadata del anime
    let anime = source==='anilist' ? await anilistDetail(id) : await jikanDetail(id);

    // Slug AnimeFLV
    let aflvSlug = slug || getSlug(id);
    if(!aflvSlug){
      showToast('🔍 Buscando en AnimeFLV…','info');
      aflvSlug = await matchAFLVSlug(anime.title, id);
    }

    // Render del player
    renderPlayerUI(anime, id, source, ep, aflvSlug||'');
    if(loadEl)loadEl.style.display='none'; if(contentEl)contentEl.style.display='flex';
    document.title=`${anime.title} Ep ${ep} — Kawaii Anime`;

    // Carga servidores
    if(aflvSlug) {
      await loadEpisodeServers(aflvSlug, ep, anime, id, source);
    } else {
      renderNoServers(anime.title, ep);
    }
  } catch(err){
    console.error('Player:',err);
    if(loadEl)loadEl.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p><a href="index.html" style="color:var(--accent-light);margin-top:16px;display:inline-block">← Volver</a></div>`;
  }
}

function renderPlayerUI(anime, id, source, ep, aflvSlug) {
  setText('player-anime-title',anime.title);
  setText('player-ep-info',`Episodio ${ep}${anime.episodes?' / '+anime.episodes:''}`);
  const bc=qs('bc-anime-link'),bce=qs('bc-ep');
  if(bc){bc.textContent=anime.title;bc.href=`anime.html?id=${id}&source=${source}`;}
  if(bce)bce.textContent=`Episodio ${ep}`;
  const poster=qs('player-poster'); if(poster){poster.src=anime.cover;poster.alt=anime.title;}
  setText('player-info-title',anime.title);
  setText('player-info-subtitle',`Episodio ${ep}`);
  const total=anime.episodes||999;
  const prev=qs('prev-ep-btn'),next=qs('next-ep-btn');
  if(prev){prev.disabled=ep<=1;prev.onclick=()=>goPlayer(id,source,ep-1,aflvSlug);}
  if(next){next.disabled=ep>=total;next.onclick=()=>goPlayer(id,source,ep+1,aflvSlug);}
  const goBtn=qs('go-anime-btn'); if(goBtn)goBtn.onclick=()=>location.href=`anime.html?id=${id}&source=${source}`;

  // Sidebar episodios
  const sl=qs('sidebar-ep-list');
  if(sl){
    const count=Math.min(anime.episodes||12,500);
    sl.innerHTML=Array.from({length:count},(_,i)=>{
      const n=i+1;
      return `<div class="sidebar-ep-item ${n===ep?'active':''}" onclick="goPlayer(${id},'${source}',${n},'${aflvSlug||''}')">
        <div class="ep-thumb"><img src="${anime.cover}" alt="" loading="lazy"><span class="ep-num-overlay">${n}</span></div>
        <div class="ep-info"><div class="ep-title">${anime.title}</div><div class="ep-num">Episodio ${n}</div></div>
      </div>`;
    }).join('');
    sl.querySelector('.active')?.scrollIntoView({block:'center'});
  }
}

async function loadEpisodeServers(aflvSlug, ep, anime, animeId, source) {
  const serversRow=qs('servers-row'),embedDiv=qs('player-embed');
  if(serversRow)serversRow.innerHTML=`<div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:13px"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div>Buscando servidores en AnimeFLV…</div>`;
  if(embedDiv)embedDiv.innerHTML=`<div class="player-embed-placeholder"><div class="big-play" style="animation:pulse 1.5s infinite">▶</div><p style="color:var(--accent-light);font-size:15px">Obteniendo episodio ${ep}…</p><p style="color:var(--text-muted);font-size:12px;margin-top:6px">Conectando con AnimeFLV</p></div>`;

  try {
    const servers = await aflvEpisodeServers(aflvSlug, ep);
    if(!servers.length){renderNoServers(anime.title,ep);return;}

    // Separar por idioma
    const lat = servers.filter(s=>s.lang==='latino');
    const sub = servers.filter(s=>s.lang!=='latino');

    if(serversRow){
      let html=`<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">`;
      if(lat.length){
        html+=`<span style="font-size:11px;color:#f59e0b;font-weight:700;text-transform:uppercase;letter-spacing:1px">🎌 LATINO</span>`;
        html+=lat.map((s,i)=>buildServerBtn(s,i===0&&!sub.length,animeId,source,ep,aflvSlug)).join('');
      }
      if(sub.length){
        if(lat.length) html+=`<span style="width:1px;height:22px;background:var(--border-subtle);display:inline-block;margin:0 2px"></span>`;
        html+=`<span style="font-size:11px;color:#0ea5e9;font-weight:700;text-transform:uppercase;letter-spacing:1px">📖 SUB ESP</span>`;
        html+=sub.map((s,i)=>buildServerBtn(s,i===0&&lat.length===0,animeId,source,ep,aflvSlug)).join('');
      }
      html+='</div>';
      serversRow.innerHTML=html;
    }

    // Carga automático el primer servidor
    const first=lat[0]||sub[0];
    if(first) injectEmbed(first.embed||first.url, embedDiv);

  } catch(err){
    console.error('Servers:',err); renderNoServers(anime.title,ep);
  }
}

function buildServerBtn(s, isActive, animeId, source, ep, aflvSlug) {
  const esc = encodeURIComponent(s.embed||s.url||'');
  const langLabel = s.lang==='latino'?'Latino':'Sub';
  return `<button class="server-btn ${isActive?'active':''}"
    style="${isActive?`border-color:${s.color};color:${s.color}`:''}"
    onclick="selectServer(this,'${esc}','${s.lang}','${s.name}')">
    <span class="dot-status" style="background:${s.color}"></span>
    ${s.icon} ${s.name}
  </button>`;
}

function injectEmbed(rawEmbed, container) {
  if(!container||!rawEmbed) return;
  // Si ya es un iframe HTML completo
  if(rawEmbed.trim().startsWith('<iframe')||rawEmbed.trim().startsWith('<IFRAME')){
    container.innerHTML = rawEmbed.replace(/(<iframe)/i,
      '<iframe style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" ');
    return;
  }
  // Si es URL directa
  if(rawEmbed.startsWith('http')){
    container.innerHTML=`
      <iframe src="${rawEmbed}"
        style="position:absolute;top:0;left:0;width:100%;height:100%;border:none"
        allowfullscreen scrolling="no"
        allow="autoplay;fullscreen;encrypted-media;picture-in-picture"
        sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation">
      </iframe>`;
    return;
  }
  renderNoServers('', 0);
}

window.selectServer=(btn,encodedEmbed,lang,name)=>{
  document.querySelectorAll('.server-btn').forEach(b=>{b.classList.remove('active');b.style.borderColor='';b.style.color='';});
  btn.classList.add('active');
  const label=lang==='latino'?'🎌 Latino':'📖 Sub español';
  showToast(`${name} — ${label}`,'success');
  const embedDiv=qs('player-embed');
  if(!embedDiv) return;
  embedDiv.innerHTML=`<div class="player-embed-placeholder"><div class="big-play" style="animation:pulse 1s infinite">▶</div><p style="color:var(--accent-light)">Cargando ${name}…</p></div>`;
  setTimeout(()=>injectEmbed(decodeURIComponent(encodedEmbed),embedDiv),700);
};

function renderNoServers(animeTitle, ep) {
  const sr=qs('servers-row'),ed=qs('player-embed');
  if(sr)sr.innerHTML=`<div style="font-size:13px;color:var(--text-muted);padding:4px 0">⚠️ Sin servidores disponibles en AnimeFLV para este episodio. Puede que el anime aún no esté disponible o tenga otro nombre.</div>`;
  if(ed)ed.innerHTML=`<div class="player-embed-placeholder"><div class="big-play">⚠️</div><h3 style="font-family:var(--font-head);font-size:1.2rem;text-align:center">${animeTitle||'Episodio'} ${ep?'— Ep '+ep:''}</h3><p style="color:var(--text-muted);font-size:13px;text-align:center;max-width:380px;line-height:1.6">No se encontraron servidores en AnimeFLV.<br>Prueba con otro episodio o vuelve más tarde.</p></div>`;
}

window.filterSidebarEps=q=>{
  document.querySelectorAll('.sidebar-ep-item').forEach(item=>{
    const num=item.querySelector('.ep-num')?.textContent||'';
    item.style.display=!q||num.includes(q)?'':'none';
  });
};
window.toggleTheater=()=>{
  const layout=document.querySelector('.player-layout'),sidebar=document.querySelector('.player-sidebar');
  if(!layout) return;
  const t=layout.classList.toggle('theater');
  if(sidebar)sidebar.style.display=t?'none':'';
  showToast(t?'🎬 Modo cine':'Modo normal','info');
};
window.changeQuality=q=>showToast(`Calidad: ${q}p`,'success');
window.changeLang=l=>showToast(l==='dub'?'🎌 Español Latino':'📖 Subtitulado al español','success');

/* ── Arranque ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  if(page==='home')   initHomePage();
  if(page==='anime')  initAnimePage();
  if(page==='player') initPlayerPage();
  qs('scroll-top-btn')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
});
