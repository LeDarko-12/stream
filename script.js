/* ============================================================
   YOAKE — script.js  v7.0
   夜明け · El amanecer del anime
   ─────────────────────────────────────────────────────────
   Streams: AnimeFLV (primario) + AnimePahe (respaldo)
   Solo contenido en Español: SUB ESPAÑOL y LATINO

   SERVIDORES:
   ┌────────────────────────────────────────────────────────┐
   │ Desu · Magi · Mega · Streamwish · VOE                 │
   │ Vidhide · Mixdrop · Mp4upload · Streamtape · Doodstream│
   └────────────────────────────────────────────────────────┘
   Cada slot se mapea a una fuente real obtenida de Consumet.

   IDIOMAS:
   • SUB ESPAÑOL  → AnimeFLV Sub   (Consumet /anime/animeflv)
   • LATINO (dub) → AnimeFLV Latino(Consumet /anime/animeflv)
   • RESPALDO Sub → AnimePahe      (Consumet /anime/animepahe)

   REPRODUCCIÓN: HLS.js (m3u8) + fallback <video> mp4
   METADATA    : Jikan v4 (MAL) + AniList GraphQL
   ============================================================ */

'use strict';

/* ═══════════════════════════════════════════════════════════
   CONFIGURACIÓN
═══════════════════════════════════════════════════════════ */
const CFG = {
  JIKAN   : 'https://api.jikan.moe/v4',
  ANILIST : 'https://graphql.anilist.co',

  /* Consumet — se prueban en orden hasta que uno responda */
  CONSUMET: [
    'https://consumet-api.vercel.app',
    'https://api.consumet.org',
    'https://consumet.pages.dev',
    'https://consumet-clone.vercel.app',
  ],

  PROXY: 'https://api.allorigins.win/raw?url=',
};

/* ═══════════════════════════════════════════════════════════
   MAPEO SERVIDOR → NOMBRE DE LA IMAGEN
   ─────────────────────────────────────────────────────────
   Cada entrada de abajo = un "slot" de servidor que el usuario
   ve en la interfaz. La fuente real es Consumet.
   orden: los primeros son los que se cargan automáticamente.
═══════════════════════════════════════════════════════════ */
const SRV_SLOTS = [
  /* id único        nombre visible    icono  color        prioridad */
  { id:'desu',       name:'Desu',       icon:'D',  color:'#f59e0b', lang:'sub',    prio:1 },
  { id:'streamwish', name:'Streamwish', icon:'SW', color:'#f97316', lang:'sub',    prio:2 },
  { id:'magi',       name:'Magi',       icon:'M',  color:'#3b82f6', lang:'sub',    prio:3 },
  { id:'voe',        name:'VOE',        icon:'V',  color:'#eab308', lang:'sub',    prio:4 },
  { id:'mega',       name:'Mega',       icon:'Mg', color:'#8b5cf6', lang:'sub',    prio:5 },
  { id:'vidhide',    name:'Vidhide',    icon:'Vh', color:'#06b6d4', lang:'sub',    prio:6 },
  { id:'mixdrop',    name:'Mixdrop',    icon:'Mx', color:'#10b981', lang:'sub',    prio:7 },
  { id:'mp4upload',  name:'Mp4upload',  icon:'M4', color:'#64748b', lang:'sub',    prio:8 },
  { id:'streamtape', name:'Streamtape', icon:'St', color:'#ef4444', lang:'sub',    prio:9 },
  { id:'doodstream', name:'Doodstream', icon:'Dd', color:'#0ea5e9', lang:'sub',    prio:10},
  /* Versiones Latino (dub) de los mismos servidores */
  { id:'desu_lat',       name:'Desu',       icon:'D',  color:'#f59e0b', lang:'latino', prio:1 },
  { id:'streamwish_lat', name:'Streamwish', icon:'SW', color:'#f97316', lang:'latino', prio:2 },
  { id:'voe_lat',        name:'VOE',        icon:'V',  color:'#eab308', lang:'latino', prio:3 },
  { id:'magi_lat',       name:'Magi',       icon:'M',  color:'#3b82f6', lang:'latino', prio:4 },
  { id:'mega_lat',       name:'Mega',       icon:'Mg', color:'#8b5cf6', lang:'latino', prio:5 },
];

/* ═══════════════════════════════════════════════════════════
   GÉNEROS
═══════════════════════════════════════════════════════════ */
const GENRES = [
  { name:'Acción',        icon:'⚔️',  al:'Action'        },
  { name:'Aventura',      icon:'🗺️',  al:'Adventure'     },
  { name:'Comedia',       icon:'😂',  al:'Comedy'        },
  { name:'Romance',       icon:'💕',  al:'Romance'       },
  { name:'Fantasía',      icon:'🔮',  al:'Fantasy'       },
  { name:'Isekai',        icon:'🌀',  al:'Isekai'        },
  { name:'Terror',        icon:'👻',  al:'Horror'        },
  { name:'Sci-Fi',        icon:'🚀',  al:'Sci-Fi'        },
  { name:'Slice of Life', icon:'🌸',  al:'Slice of Life' },
  { name:'Deportes',      icon:'⚽',  al:'Sports'        },
  { name:'Misterio',      icon:'🕵️', al:'Mystery'       },
  { name:'Drama',         icon:'🎭',  al:'Drama'         },
  { name:'Mecha',         icon:'🤖',  al:'Mecha'         },
  { name:'Sobrenatural',  icon:'✨',  al:'Supernatural'  },
  { name:'Psicológico',   icon:'🧠',  al:'Psychological' },
  { name:'Shounen',       icon:'🔥',  al:'Action'        },
];

/* ═══════════════════════════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════════════════════════ */
const ST = {
  heroAnimes   : [],
  heroIndex    : 0,
  heroTimer    : null,
  genrePage    : 1,
  genreActive  : null,
  infScrollPage: 2,
  isLoading    : false,
  cache        : {},
};
const cacheSet = (k,v) => { ST.cache[k]=v; try{sessionStorage.setItem('yk_'+k,JSON.stringify(v));}catch{} };
const cacheGet = k      => { if(ST.cache[k]) return ST.cache[k]; try{const s=sessionStorage.getItem('yk_'+k);return s?JSON.parse(s):null;}catch{return null;} };

/* ═══════════════════════════════════════════════════════════
   HTTP
═══════════════════════════════════════════════════════════ */
async function http(url, opts={}, ms=12000) {
  const ctrl=new AbortController(), tid=setTimeout(()=>ctrl.abort(),ms);
  try {
    const r=await fetch(url,{...opts,signal:ctrl.signal});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(tid); }
}

/** Prueba mirrors de Consumet hasta que uno responda */
async function consumet(path, ms=9000) {
  for(const host of CFG.CONSUMET) {
    try {
      const d = await http(`${host}${path}`, {}, ms);
      if(d) return d;
    } catch { /* intenta siguiente mirror */ }
  }
  return null;
}

async function graphql(query, vars={}) {
  const d=await http(CFG.ANILIST,{
    method:'POST',
    headers:{'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({query,variables:vars}),
  });
  return d.data;
}

const sleep    = ms => new Promise(r=>setTimeout(r,ms));
const debounce = (fn,ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const truncate = (s,n)   => s&&s.length>n ? s.slice(0,n)+'…' : (s||'Sin sinopsis.');
const qs       = id      => document.getElementById(id);
const setText  = (id,v)  => { const el=qs(id); if(el) el.textContent=v??'—'; };

function coverImg(a) {
  return a?.images?.jpg?.large_image_url || a?.images?.jpg?.image_url
    || a?.coverImage?.extraLarge || a?.coverImage?.large || a?.coverImage?.medium
    || 'https://placehold.co/300x420/0a0e1a/e8932a?text=YOAKE';
}
function goAnime(id,src){ location.href=`anime.html?id=${encodeURIComponent(id)}&source=${encodeURIComponent(src)}`; }
function goPlayer(id,src,ep){ location.href=`player.html?id=${encodeURIComponent(id)}&source=${encodeURIComponent(src)}&ep=${ep}`; }

function showToast(msg,type='info'){
  let c=qs('toast-container');
  if(!c){c=Object.assign(document.createElement('div'),{id:'toast-container',className:'toast-container'});document.body.appendChild(c);}
  const t=document.createElement('div'); t.className=`toast ${type}`;
  t.innerHTML=`<span>${type==='success'?'✅':type==='error'?'❌':'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t); setTimeout(()=>t.remove(),3200);
}

/* ═══════════════════════════════════════════════════════════
   TARJETAS
═══════════════════════════════════════════════════════════ */
function card(a) {
  const score=a.rating?parseFloat(a.rating).toFixed(1):'?';
  const safeId=String(a.id).replace(/'/g,"\\'"), safeSrc=String(a.source).replace(/'/g,"\\'");
  return `
  <div class="anime-card" onclick="goAnime('${safeId}','${safeSrc}')" title="${a.title||''}">
    <div class="cover-wrap">
      <img src="${a.cover}" alt="${a.title||''}" loading="lazy"
           onerror="this.src='https://placehold.co/300x420/0a0e1a/e8932a?text=YOAKE'">
      <span class="badge badge-sub">Sub</span>
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

function skeletons(n=8){
  return Array.from({length:n},()=>`<div class="skel-card"><div class="skeleton skel-cover"></div><div class="skeleton skel-line"></div><div class="skeleton skel-line short"></div></div>`).join('');
}

function normJikan(a){
  if(!a) return null;
  return{id:a.mal_id,source:'jikan',title:a.title_english||a.title,titleJp:a.title_japanese,
    cover:coverImg(a),synopsis:a.synopsis,rating:a.score,episodes:a.episodes,status:a.status,
    genres:(a.genres||[]).map(g=>g.name),year:a.year,members:a.members,type:a.type,
    studios:(a.studios||[]).map(s=>s.name),rank:a.rank,season:a.season};
}
function normAniList(a){
  if(!a) return null;
  return{id:a.id,source:'anilist',title:a.title?.english||a.title?.romaji,titleJp:a.title?.native,
    cover:coverImg(a),synopsis:a.description?.replace(/<[^>]*>/g,''),
    rating:a.averageScore?(a.averageScore/10).toFixed(1):null,episodes:a.episodes,status:a.status,
    genres:a.genres||[],year:a.seasonYear,members:a.popularity,type:a.format,season:a.season,
    studios:a.studios?.nodes?.map(s=>s.name)||[],banner:a.bannerImage};
}

/* ═══════════════════════════════════════════════════════════
   JIKAN / ANILIST  (metadata)
═══════════════════════════════════════════════════════════ */
async function jikanSearch(q,limit=10){try{const d=await http(`${CFG.JIKAN}/anime?q=${encodeURIComponent(q)}&limit=${limit}&sfw=true`);return(d.data||[]).map(normJikan).filter(Boolean);}catch{return[];}}
async function jikanDetail(id){const d=await http(`${CFG.JIKAN}/anime/${id}/full`);return normJikan(d.data);}
async function jikanTopRated(p=1){try{const d=await http(`${CFG.JIKAN}/top/anime?page=${p}&limit=20`);return(d.data||[]).map(normJikan).filter(Boolean);}catch{return[];}}
async function jikanSeason(){try{const d=await http(`${CFG.JIKAN}/seasons/now?limit=20`);return(d.data||[]).slice(0,20).map(normJikan).filter(Boolean);}catch{return[];}}

const GQL=`id title{romaji english native} coverImage{extraLarge large medium} bannerImage averageScore episodes status genres seasonYear popularity format description studios{nodes{name}} season`;
async function anilistTrending(p=1,pp=20){try{const q=`query($p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(sort:TRENDING_DESC,type:ANIME,isAdult:false){${GQL}}}}`;const d=await graphql(q,{p,pp});return d.Page.media.map(normAniList).filter(Boolean);}catch{return[];}}
async function anilistPopular(p=1,pp=20){try{const q=`query($p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){${GQL}}}}`;const d=await graphql(q,{p,pp});return d.Page.media.map(normAniList).filter(Boolean);}catch{return[];}}
async function anilistByGenre(genre,p=1,pp=20){try{const q=`query($g:String,$p:Int,$pp:Int){Page(page:$p,perPage:$pp){media(genre:$g,sort:POPULARITY_DESC,type:ANIME,isAdult:false){${GQL}}pageInfo{hasNextPage}}}`;const d=await graphql(q,{g:genre,p,pp});return{animes:d.Page.media.map(normAniList).filter(Boolean),hasMore:d.Page.pageInfo.hasNextPage};}catch{return{animes:[],hasMore:false};}}
async function anilistDetail(id){const q=`query($id:Int){Media(id:$id,type:ANIME){${GQL} relations{edges{relationType node{id title{english romaji} type coverImage{medium} format}}} characters(sort:ROLE,perPage:8){nodes{name{full} image{medium}}}}}`;const d=await graphql(q,{id:parseInt(id)});const a=d.Media;return{...normAniList(a),relations:a.relations?.edges||[],characters:a.characters?.nodes||[]};}
async function anilistMovies(p=1){try{const q=`query($p:Int){Page(page:$p,perPage:20){media(sort:POPULARITY_DESC,type:ANIME,format:MOVIE,isAdult:false){${GQL}}}}`;const d=await graphql(q,{p});return d.Page.media.map(normAniList).filter(Boolean);}catch{return[];}}

/* ═══════════════════════════════════════════════════════════
   CONSUMET — BÚSQUEDA DE EPISODIO
   ─────────────────────────────────────────────────────────
   Fuentes disponibles (solo contenido en Español):
   • animeflv  → Sub Español + Latino (cobertura ~90% animes)
   • animepahe → Sub respaldo (cobertura adicional)
   ─────────────────────────────────────────────────────────
   Cada fuente + calidad = un "slot" de la UI con el
   nombre del servidor visible al usuario.
═══════════════════════════════════════════════════════════ */

/**
 * Busca el ID de un anime en AnimeFLV (sub o latino).
 * En AnimeFLV los animes latinos suelen tener "latino"
 * en el título o en una entrada separada.
 */
async function aflvFindID(title, isLat = false) {
  const query = isLat ? `${title} latino` : title;
  const cKey  = `aflv_${isLat?'lat':'sub'}_${title.toLowerCase().slice(0,40)}`;
  const cached = cacheGet(cKey); if(cached) return cached;

  const d = await consumet(`/anime/animeflv/${encodeURIComponent(query)}`);
  if(!d?.results?.length) return null;

  const norm = title.toLowerCase().trim();
  let best = null;
  for(const r of d.results) {
    const t = (r.title||'').toLowerCase().trim();
    if(isLat) {
      if(t.includes('latino') || t.includes(' lat)') || t.endsWith('(lat)')){best=r;break;}
    } else {
      if(!t.includes('latino') && (t===norm)){best=r;break;}
      if(!best && !t.includes('latino') && (t.includes(norm.slice(0,8))||norm.includes(t.slice(0,8)))) best=r;
    }
  }
  best = best || d.results[0];

  const id = best?.id || null;
  if(id) cacheSet(cKey, id);
  return id;
}

/** Obtiene lista de episodios de AnimeFLV por ID */
async function aflvGetEps(animeId) {
  const cKey = `aflv_eps_${animeId}`;
  const cached = cacheGet(cKey); if(cached) return cached;
  const d = await consumet(`/anime/animeflv/info?id=${encodeURIComponent(animeId)}`);
  const eps = d?.episodes || [];
  if(eps.length) cacheSet(cKey, eps);
  return eps;
}

/**
 * Obtiene streams de AnimeFLV para un episodio.
 * AnimeFLV Consumet retorna múltiples fuentes ordenadas por calidad.
 */
async function aflvWatch(episodeId) {
  try {
    const d = await consumet(`/anime/animeflv/watch?episodeId=${encodeURIComponent(episodeId)}`);
    return {
      sources: (d?.sources||[]).sort((a,b)=>{
        const q=s=>s.quality==='1080p'?5:s.quality==='720p'?4:s.quality==='480p'?3:s.quality==='360p'?2:1;
        return q(b)-q(a);
      }),
      headers: d?.headers||{},
    };
  } catch { return {sources:[],headers:{}}; }
}

/* ── AnimePahe (respaldo Sub) ──────────────────────────── */
async function paheFindID(title) {
  const cKey = `pahe_${title.toLowerCase().slice(0,40)}`;
  const cached = cacheGet(cKey); if(cached) return cached;
  const d = await consumet(`/anime/animepahe/${encodeURIComponent(title)}`);
  if(!d?.results?.length) return null;
  const norm = title.toLowerCase().trim();
  let best = d.results[0];
  for(const r of d.results){
    const t=(r.title||'').toLowerCase().trim();
    if(t===norm||t.includes(norm.slice(0,8))||norm.includes(t.slice(0,8))){best=r;break;}
  }
  const id = best?.id || null;
  if(id) cacheSet(cKey, id);
  return id;
}

async function paheGetEps(animeId) {
  const cKey = `pahe_eps_${animeId}`;
  const cached = cacheGet(cKey); if(cached) return cached;
  const d = await consumet(`/anime/animepahe/info?id=${encodeURIComponent(animeId)}`);
  const eps = d?.episodes || [];
  if(eps.length) cacheSet(cKey, eps);
  return eps;
}

async function paheWatch(episodeId) {
  try {
    const d = await consumet(`/anime/animepahe/watch?episodeId=${encodeURIComponent(episodeId)}`);
    return {
      sources: (d?.sources||[]).sort((a,b)=>{
        const q=s=>s.quality==='1080p'?5:s.quality==='720p'?4:s.quality==='480p'?3:2;
        return q(b)-q(a);
      }),
      headers: d?.headers||{},
    };
  } catch { return {sources:[],headers:{}}; }
}

/* ═══════════════════════════════════════════════════════════
   RESOLUCIÓN DE STREAMS — MULTI PROVIDER (SIN ANIMEFLV)
   Proveedores:
   Zoro / HiAnime
   Gogoanime
   AnimePahe
   AnimeSaturn
   AnimeKai
═══════════════════════════════════════════════════════════ */

async function resolveStreams(anime, ep){

  const title = anime.title || "";
  const results = [];

  const providers = [
    { id:"zoro",        name:"Zoro",        icon:"Z", color:"#22c55e" },
    { id:"gogoanime",   name:"Gogo",        icon:"G", color:"#f97316" },
    { id:"animepahe",   name:"Pahe",        icon:"P", color:"#3b82f6" },
    { id:"animesaturn", name:"Saturn",      icon:"S", color:"#a855f7" },
    { id:"animekai",    name:"Kai",         icon:"K", color:"#eab308" }
  ];

  for(const provider of providers){

    try{

      const search = await consumet(
        `/anime/${provider.id}/${encodeURIComponent(title)}`
      );

      if(!search?.results?.length) continue;

      const animeId = search.results[0].id;

      const info = await consumet(
        `/anime/${provider.id}/info?id=${animeId}`
      );

      const episode = info?.episodes?.find(
        e => parseInt(e.number) === ep
      );

      if(!episode) continue;

      const watch = await consumet(
        `/anime/${provider.id}/watch?episodeId=${episode.id}`
      );

      for(const s of watch?.sources || []){

        results.push({

          id: provider.id,
          name: provider.name,
          icon: provider.icon,
          color: provider.color,
          lang: detectLang(s.url),

          url: s.url,

          isM3U8:
            s.isM3U8 ??
            s.url?.includes(".m3u8"),

          headers: watch.headers || {},

          quality: s.quality || "Auto"

        });

      }

    }catch(e){

      console.warn("Provider error:",provider.id);

    }

  }

  /* eliminar duplicados */

  const seen = new Set();

  return results.filter(s=>{
    if(!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

}

/* detectar idioma */

function detectLang(url){

  if(!url) return "sub";

  const u = url.toLowerCase();

  if(
    u.includes("lat") ||
    u.includes("dub") ||
    u.includes("latino")
  ){
    return "latino";
  }

  return "sub";
}
/* ═══════════════════════════════════════════════════════════
   REPRODUCCIÓN — HLS.js + <video>
═══════════════════════════════════════════════════════════ */
function playStream(stream, container) {
  if(!container||!stream?.url){showVideoError(container);return;}
  if(window._hlsInst){window._hlsInst.destroy();window._hlsInst=null;}
  container.innerHTML='';

  const{url,isM3U8,headers}=stream;
  const video=document.createElement('video');
  video.id='hls-video'; video.controls=true; video.autoplay=true; video.playsInline=true;
  video.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;background:#000';
  video.onerror=()=>showVideoError(container);
  container.appendChild(video);

  if(isM3U8||url.includes('.m3u8')) {
    if(window.Hls&&Hls.isSupported()) {
      const ref=headers?.Referer||headers?.referer||'';
      const hls=new Hls({enableWorker:true,lowLatencyMode:false,
        xhrSetup(xhr){if(ref)try{xhr.setRequestHeader('Referer',ref);}catch{}}});
      window._hlsInst=hls;
      hls.loadSource(url); hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{}));
      hls.on(Hls.Events.ERROR,(_,d)=>{
        if(d.fatal){
          if(!url.startsWith(CFG.PROXY)){
            /* intenta vía proxy CORS */
            hls.loadSource(CFG.PROXY+encodeURIComponent(url));
          } else {
            showVideoError(container);
          }
        }
      });
    } else if(video.canPlayType('application/vnd.apple.mpegurl')){
      video.src=url; video.play().catch(()=>{});
    } else {
      showVideoError(container);
    }
  } else {
    /* MP4 o stream directo */
    video.src=url; video.play().catch(()=>{});
  }
}

function showVideoError(container){
  if(!container)return;
  if(window._hlsInst){window._hlsInst.destroy();window._hlsInst=null;}
  container.innerHTML=`<div class="embed-placeholder"><div class="ep-icon">⚠️</div><p style="color:var(--accent-light)">Servidor no disponible</p><p style="color:var(--text-muted);font-size:12px;text-align:center;max-width:300px;line-height:1.6">Este servidor bloqueó la reproducción.<br>Prueba otro servidor de la lista.</p></div>`;
}

/* ═══════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════ */
async function initHero(){
  if(!qs('hero-section'))return;
  try{const list=await anilistTrending(1,8);ST.heroAnimes=list.filter(a=>a?.cover);if(!ST.heroAnimes.length)return;renderHeroSlide(0);renderHeroDots();startHeroTimer();}
  catch(e){console.error('Hero:',e);}
}
function renderHeroSlide(idx){
  const a=ST.heroAnimes[idx];if(!a)return;ST.heroIndex=idx;
  const bg=qs('hero-bg');if(bg)bg.style.backgroundImage=`url(${a.banner||a.cover})`;
  setText('hero-title',a.title||'Sin título');setText('hero-desc',truncate(a.synopsis||'',220));
  const meta=qs('hero-meta');
  if(meta)meta.innerHTML=`<span class="rating">⭐ ${a.rating||'?'}</span><div class="genres">${(a.genres||[]).slice(0,3).map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div>${a.year?`<span style="color:var(--text-muted);font-size:13px">${a.year}</span>`:''}${a.episodes?`<span style="color:var(--text-muted);font-size:13px">${a.episodes} eps</span>`:''}`;
  const wb=qs('hero-watch-btn'),ib=qs('hero-info-btn');
  if(wb)wb.onclick=()=>goAnime(a.id,a.source);if(ib)ib.onclick=()=>goAnime(a.id,a.source);
  document.querySelectorAll('.hero-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
}
function renderHeroDots(){const c=qs('hero-dots');if(!c)return;c.innerHTML=ST.heroAnimes.map((_,i)=>`<button class="hero-dot ${i===0?'active':''}" onclick="changeHeroSlide(${i})"></button>`).join('');}
function startHeroTimer(){clearInterval(ST.heroTimer);ST.heroTimer=setInterval(()=>renderHeroSlide((ST.heroIndex+1)%ST.heroAnimes.length),6000);}
window.changeHeroSlide=i=>{renderHeroSlide(i);startHeroTimer();};

/* ═══════════════════════════════════════════════════════════
   UI — filas / géneros / nav / search / top
═══════════════════════════════════════════════════════════ */
async function loadRow(id,fn){
  const row=qs(id);if(!row)return;row.innerHTML=skeletons(8);
  try{const list=await fn();row.innerHTML=list.map(card).join('')||skeletons(4);}
  catch(e){row.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error al cargar</h3></div>`;console.error(id,e);}
}
function renderGenres(){
  const grid=qs('genres-grid');if(!grid)return;
  grid.innerHTML=GENRES.map(g=>`<button class="genre-btn" data-genre="${g.al}" onclick="location.href='index.html?genre=${encodeURIComponent(g.al)}&gname=${encodeURIComponent(g.name)}'"><span class="genre-icon">${g.icon}</span><span class="genre-name">${g.name}</span></button>`).join('');
}
function initScrollArrows(){
  document.querySelectorAll('.scroll-row-wrapper').forEach(w=>{
    const row=w.querySelector('.scroll-row'),l=w.querySelector('.scroll-arrow.left'),r=w.querySelector('.scroll-arrow.right');
    if(!row||!l||!r)return;
    l.addEventListener('click',()=>row.scrollBy({left:-640,behavior:'smooth'}));
    r.addEventListener('click',()=>row.scrollBy({left:640,behavior:'smooth'}));
  });
}
function initNavbar(){
  const nav=document.querySelector('.navbar');if(!nav)return;
  window.addEventListener('scroll',()=>{nav.classList.toggle('scrolled',scrollY>40);qs('scroll-top-btn')?.classList.toggle('visible',scrollY>400);});
  const hb=qs('hamburger'),mob=qs('mobile-nav');if(hb&&mob)hb.addEventListener('click',()=>mob.classList.toggle('open'));
}
function initSearch(){
  const input=qs('search-input'),drop=qs('search-dropdown');if(!input)return;
  const doSearch=debounce(async q=>{
    if(!q.trim()){drop.classList.remove('active');return;}
    drop.innerHTML='<div class="loading-spinner" style="padding:14px"><div class="spinner"></div></div>';
    drop.classList.add('active');
    try{
      const results=await jikanSearch(q,8);
      if(!results.length){drop.innerHTML=`<div class="empty-state" style="padding:12px"><p>Sin resultados para «${q}»</p></div>`;return;}
      drop.innerHTML=results.map(a=>`<div class="search-result-item" onclick="goAnime('${a.id}','${a.source}')"><img src="${a.cover}" alt="${a.title}" loading="lazy"><div class="info"><div class="title">${a.title}</div><div class="meta">⭐ ${a.rating||'?'} · ${a.year||'?'} · ${a.type||'TV'}</div></div></div>`).join('');
    }catch{drop.innerHTML=`<div class="empty-state" style="padding:12px"><p>Error al buscar</p></div>`;}
  },420);
  input.addEventListener('input',e=>doSearch(e.target.value));
  document.addEventListener('click',e=>{if(!input.closest('.nav-search').contains(e.target))drop.classList.remove('active');});
  input.addEventListener('keydown',e=>{if(e.key==='Escape')drop.classList.remove('active');if(e.key==='Enter'&&input.value.trim())location.href=`index.html?search=${encodeURIComponent(input.value.trim())}`;});
}
async function loadTopTable(){
  const c=qs('top-rated-list');if(!c)return;c.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
  try{
    const list=await jikanTopRated(1);const rc=i=>i===0?'gold':i===1?'silver':i===2?'bronze':'';
    c.innerHTML=list.slice(0,25).map((a,i)=>`<div class="top-item" onclick="goAnime('${a.id}','${a.source}')"><span class="top-rank ${rc(i)}">${i+1}</span><img src="${a.cover}" alt="${a.title}" loading="lazy"><div class="info"><div class="title">${a.title}</div><div class="meta"><span>${a.type||'TV'}</span><span>${a.year||'?'}</span><span>${a.episodes?a.episodes+' eps':''}</span></div></div><div class="top-score"><span class="score">⭐ ${a.rating||'?'}</span><span class="votes">${a.members?(a.members/1000).toFixed(0)+'k':''}</span></div></div>`).join('');
  }catch{c.innerHTML='<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>';}
}
function initInfiniteScroll(){
  const sentinel=qs('scroll-sentinel');if(!sentinel)return;
  new IntersectionObserver(async entries=>{if(!entries[0].isIntersecting||ST.isLoading)return;ST.isLoading=true;await loadMoreMainGrid();ST.isLoading=false;},{rootMargin:'240px'}).observe(sentinel);
}
async function loadMoreMainGrid(){
  const grid=qs('main-grid');if(!grid)return;
  const spin=Object.assign(document.createElement('div'),{className:'loading-spinner',innerHTML:'<div class="spinner"></div>'});
  qs('scroll-sentinel')?.before(spin);
  try{const list=await anilistPopular(ST.infScrollPage++);spin.remove();list.forEach(a=>{const el=document.createElement('div');el.innerHTML=card(a);grid.appendChild(el.firstElementChild);});}
  catch{spin.remove();}
}

/* ═══════════════════════════════════════════════════════════
   HOME
═══════════════════════════════════════════════════════════ */
async function initHomePage(){
  initNavbar();initSearch();renderGenres();
  await Promise.allSettled([initHero(),loadRow('recent-row',()=>jikanSeason()),loadRow('trending-row',()=>anilistTrending(1)),loadRow('popular-row',()=>anilistPopular(1))]);
  await sleep(300);
  await loadRow('toprated-row',()=>jikanTopRated(1));
  await loadRow('main-grid',()=>anilistPopular(1));
  initScrollArrows();initInfiniteScroll();
  const p=new URLSearchParams(location.search);
  if(p.get('genre'))showGenreSection(p.get('genre'),p.get('gname')||p.get('genre'));
  if(p.get('search'))showSearchSection(p.get('search'));
}

async function showGenreSection(genre,displayName){
  const sec=qs('genre-results-section'),t=qs('genre-title'),grid=qs('genre-grid');if(!sec||!grid)return;
  sec.style.display='block';if(t)t.textContent=(displayName||genre).toUpperCase();
  ST.genrePage=1;ST.genreActive=genre;grid.innerHTML=skeletons(12);
  document.querySelectorAll('.genre-btn').forEach(b=>b.classList.toggle('active',b.dataset.genre===genre));
  try{const{animes}=await anilistByGenre(genre,1);grid.innerHTML=animes.map(card).join('');}
  catch{grid.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>`;}
  sec.scrollIntoView({behavior:'smooth'});
}
window.loadMoreGenre=async()=>{
  if(!ST.genreActive)return;ST.genrePage++;
  const btn=qs('load-more-genre'),grid=qs('genre-grid');if(!btn||!grid)return;
  btn.textContent='Cargando…';btn.classList.add('loading');
  try{const{animes,hasMore}=await anilistByGenre(ST.genreActive,ST.genrePage);animes.forEach(a=>{const el=document.createElement('div');el.innerHTML=card(a);grid.appendChild(el.firstElementChild);});if(!hasMore)btn.style.display='none';}
  catch{showToast('Error','error');}finally{btn.textContent='Cargar más';btn.classList.remove('loading');}
};
async function showSearchSection(q){
  const sec=qs('search-results-section'),hd=qs('search-results-title'),grid=qs('search-results-grid');if(!sec||!grid)return;
  sec.style.display='block';if(hd)hd.textContent=`Resultados para: "${q}"`;grid.innerHTML=skeletons(12);
  try{const results=await jikanSearch(q,24);grid.innerHTML=results.length?results.map(card).join(''):`<div class="empty-state"><div class="icon">🔍</div><h3>Sin resultados</h3></div>`;}
  catch{grid.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3></div>`;}
  sec.scrollIntoView({behavior:'smooth'});
}
window.switchTab=async(tabId,btn)=>{
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');const content=qs(tabId);if(content)content.classList.add('active');
  if(tabId==='tab-top'){loadTopTable();return;}
  const map={'tab-sub':'sub-row','tab-movies':'movies-row','tab-season':'season-row'};
  const rowId=map[tabId];if(!rowId)return;const row=qs(rowId);if(!row||row.dataset.loaded)return;
  row.dataset.loaded='1';
  if(tabId==='tab-sub')   await loadRow(rowId,()=>anilistTrending(3,20));
  if(tabId==='tab-movies')await loadRow(rowId,()=>anilistMovies(1));
  if(tabId==='tab-season')await loadRow(rowId,()=>jikanSeason());
  initScrollArrows();
};

/* ═══════════════════════════════════════════════════════════
   ANIME DETAIL
═══════════════════════════════════════════════════════════ */
async function initAnimePage(){
  initNavbar();initSearch();
  const p=new URLSearchParams(location.search);const rawId=p.get('id');const source=p.get('source')||'jikan';
  if(!rawId){location.href='index.html';return;}
  const id=/^\d+$/.test(rawId)?parseInt(rawId):rawId;
  const loadEl=qs('anime-loading'),detailEl=qs('anime-detail-content');
  if(loadEl)loadEl.style.display='flex';if(detailEl)detailEl.style.display='none';
  try{
    const anime=source==='anilist'?await anilistDetail(id):await jikanDetail(id);
    if(!anime)throw new Error('Anime no encontrado');
    renderAnimeDetail(anime,id,source);renderEpisodes(anime,id,source);renderSidebarStats(anime,id,source);
    document.title=`${anime.title} — YOAKE`;
    if(loadEl)loadEl.style.display='none';if(detailEl)detailEl.style.display='block';
    loadRelated(anime);
  }catch(err){console.error(err);if(loadEl)loadEl.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p><a href="index.html" style="color:var(--accent-light);margin-top:16px;display:inline-block">← Volver</a></div>`;}
}
function renderAnimeDetail(a,id,source){
  const bg=qs('anime-hero-bg'),img=qs('anime-poster-img');
  if(bg)bg.style.backgroundImage=`url(${a.banner||a.cover})`;if(img){img.src=a.cover;img.alt=a.title;}
  setText('anime-title',a.title);setText('anime-jp-title',a.titleJp||'');setText('anime-score',a.rating||'?');
  setText('anime-episodes-count',a.episodes||'?');setText('anime-year',a.year||'?');setText('anime-type',a.type||'TV');
  setText('anime-studios',(a.studios||[]).join(', ')||'—');
  const sy=qs('anime-synopsis');if(sy)sy.textContent=a.synopsis||'Sin sinopsis disponible.';
  const statusEl=qs('anime-status');
  if(statusEl){const on=a.status==='Currently Airing'||a.status==='RELEASING';statusEl.className=`status-badge ${on?'status-ongoing':'status-finished'}`;statusEl.innerHTML=`${on?'🟢':'⬜'} ${on?'En emisión':'Finalizado'}`;}
  const ge=qs('anime-genres');if(ge)ge.innerHTML=(a.genres||[]).map(g=>`<span class="tag" onclick="location.href='index.html?genre=${encodeURIComponent(g)}&gname=${encodeURIComponent(g)}'">${g}</span>`).join('');
  const wb=qs('anime-watch-btn');if(wb)wb.onclick=()=>goPlayer(id,source,1);
}
function renderEpisodes(a,id,source){
  const grid=qs('episodes-grid');if(!grid)return;const max=Math.min(a.episodes||12,500);
  grid.innerHTML=Array.from({length:max},(_,i)=>{const ep=i+1;return `<button class="ep-btn" title="Episodio ${ep}" onclick="goPlayer('${id}','${source}',${ep})">Ep ${ep}</button>`;}).join('');
}
function renderSidebarStats(a,id,source){
  const on=a.status==='Currently Airing'||a.status==='RELEASING';
  setText('stat-status',on?'🟢 En emisión':'⬜ Finalizado');setText('stat-type',a.type||'—');
  setText('stat-episodes',a.episodes?a.episodes+' eps':'—');setText('stat-year',a.year||'—');
  setText('stat-rating',a.rating?'⭐ '+a.rating:'—');setText('stat-popularity',a.members?Math.round(a.members/1000)+'k miembros':'—');
  setText('stat-studios',(a.studios||[]).join(', ')||'—');
  const sg=qs('sidebar-genres');if(sg)sg.innerHTML=(a.genres||[]).map(g=>`<span class="tag" onclick="location.href='index.html?genre=${encodeURIComponent(g)}'">${g}</span>`).join('');
  const wb=qs('watch-btn-sidebar');if(wb)wb.onclick=()=>goPlayer(id,source,1);
  if(a.characters?.length){const cg=qs('characters-grid');if(cg){cg.innerHTML=a.characters.map(c=>`<div class="char-card"><img src="${c.image?.medium||''}" alt="${c.name?.full}" loading="lazy" onerror="this.style.display='none'"><div class="char-name">${c.name?.full||''}</div></div>`).join('');const sec=qs('characters-section');if(sec)sec.style.display='block';}}
}
window.filterEpisodes=q=>{document.querySelectorAll('#episodes-grid .ep-btn').forEach(b=>b.style.display=b.title.includes(q)?'':'none');};
window.toggleSynopsis=()=>{const el=qs('anime-synopsis'),btn=qs('read-more-btn');if(!el||!btn)return;el.classList.toggle('collapsed');btn.textContent=el.classList.contains('collapsed')?'Leer más ▼':'Leer menos ▲';};
async function loadRelated(a){const grid=qs('related-grid');if(!grid)return;grid.innerHTML=skeletons(6);try{const genre=(a.genres||[])[0]||'Action';const{animes}=await anilistByGenre(genre,1,12);const f=animes.filter(x=>x.id!==a.id).slice(0,10);grid.innerHTML=f.map(card).join('');initScrollArrows();}catch{grid.innerHTML='';}}

/* ═══════════════════════════════════════════════════════════
   REPRODUCTOR
═══════════════════════════════════════════════════════════ */
async function initPlayerPage(){
  initNavbar();initSearch();
  const p=new URLSearchParams(location.search);
  const rawId=p.get('id'),source=p.get('source')||'jikan',ep=parseInt(p.get('ep'))||1;
  if(!rawId){location.href='index.html';return;}
  const id=/^\d+$/.test(rawId)?parseInt(rawId):rawId;
  const loadEl=qs('player-loading'),contentEl=qs('player-content');
  try{
    const anime=source==='anilist'?await anilistDetail(id):await jikanDetail(id);
    if(!anime)throw new Error('No se encontró el anime');
    renderPlayerUI(anime,id,source,ep);
    if(loadEl)loadEl.style.display='none';if(contentEl)contentEl.style.display='flex';
    document.title=`${anime.title} · Ep ${ep} — YOAKE`;
    await loadPlayerStreams(anime,ep);
  }catch(err){console.error(err);if(loadEl)loadEl.innerHTML=`<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${err.message}</p><a href="index.html" style="color:var(--accent-light);margin-top:16px;display:inline-block">← Volver</a></div>`;}
}

function renderPlayerUI(anime,id,source,ep){
  setText('player-anime-title',anime.title);
  setText('player-ep-info',`Episodio ${ep}${anime.episodes?' / '+anime.episodes:''}`);
  const bc=qs('bc-anime-link'),bce=qs('bc-ep');
  if(bc){bc.textContent=anime.title;bc.href=`anime.html?id=${id}&source=${source}`;}if(bce)bce.textContent=`Episodio ${ep}`;
  const poster=qs('player-poster');if(poster){poster.src=anime.cover;poster.alt=anime.title;}
  setText('player-info-title',anime.title);setText('player-info-subtitle',`Episodio ${ep}`);
  const total=anime.episodes||999;
  const prev=qs('prev-ep-btn'),next=qs('next-ep-btn');
  if(prev){prev.disabled=ep<=1;prev.onclick=()=>goPlayer(id,source,ep-1);}
  if(next){next.disabled=ep>=total;next.onclick=()=>goPlayer(id,source,ep+1);}
  const goBtn=qs('go-anime-btn');if(goBtn)goBtn.onclick=()=>location.href=`anime.html?id=${id}&source=${source}`;
  // Sidebar
  const sl=qs('sidebar-ep-list');
  if(sl){
    const count=Math.min(anime.episodes||12,500);
    sl.innerHTML=Array.from({length:count},(_,i)=>{const n=i+1;return `<div class="sidebar-ep-item ${n===ep?'active':''}" onclick="goPlayer('${id}','${source}',${n})"><div class="ep-thumb"><img src="${anime.cover}" alt="" loading="lazy"><span class="ep-num-overlay">${n}</span></div><div class="ep-info"><div class="ep-title">${anime.title}</div><div class="ep-num">Episodio ${n}</div></div></div>`;}).join('');
    sl.querySelector('.active')?.scrollIntoView({block:'center'});
  }
}

async function loadPlayerStreams(anime, ep) {
  const serversRow=qs('servers-row'), embedDiv=qs('player-embed');

  /* Estado: buscando */
  if(serversRow) serversRow.innerHTML=`<div class="srv-searching"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div><span>Buscando streams en AnimeFLV…</span></div>`;
  if(embedDiv) embedDiv.innerHTML=`<div class="embed-placeholder"><div class="ep-icon" style="animation:pulse 1.5s infinite">▶</div><p style="color:var(--accent-light)">Obteniendo episodio ${ep}…</p><p style="color:var(--text-muted);font-size:12px">Conectando con AnimeFLV · Sub Español · Latino</p></div>`;

  const streams = await resolveStreams(anime, ep);

  if(!streams.length){
    renderNoStreams(serversRow, embedDiv, anime.title, ep);
    return;
  }

  /* Separa por idioma y ordena por prioridad del slot */
  const lat = streams.filter(s=>s.lang==='latino')
    .sort((a,b)=>(SRV_SLOTS.find(x=>x.id===a.id)?.prio||99)-(SRV_SLOTS.find(x=>x.id===b.id)?.prio||99));
  const sub = streams.filter(s=>s.lang==='sub')
    .sort((a,b)=>(SRV_SLOTS.find(x=>x.id===a.id)?.prio||99)-(SRV_SLOTS.find(x=>x.id===b.id)?.prio||99));

  /* Construye la UI de servidores */
  if(serversRow){
    let html=`<div class="srv-grid">`;
    if(lat.length){
      html+=`<div class="srv-lang-row"><span class="srv-lang-pill latino">🎌 LATINO</span>`;
      html+=lat.map((s,i)=>buildSrvBtn(s,i===0&&sub.length===0)).join('');
      html+=`</div>`;
    }
    if(sub.length){
      html+=`<div class="srv-lang-row"><span class="srv-lang-pill sub">📖 SUB ESPAÑOL</span>`;
      html+=sub.map((s,i)=>buildSrvBtn(s,i===0&&lat.length===0)).join('');
      html+=`</div>`;
    }
    html+=`</div>`;
    serversRow.innerHTML=html;
  }

  /* Reproduce automáticamente el primer servidor disponible */
  const first=lat[0]||sub[0];
  if(first){updateLangBadge(first.lang);playStream(first,embedDiv);}
}

function buildSrvBtn(s, isActive=false){
  /* Guarda el stream en dataset como JSON — sin eval */
  const enc=encodeURIComponent(JSON.stringify({url:s.url,isM3U8:s.isM3U8,headers:s.headers,lang:s.lang,quality:s.quality}));
  return `
  <button class="srv-btn ${isActive?'active':''}" style="--srv-c:${s.color}" data-stream="${enc}" onclick="selectStream(this)">
    <span class="srv-dot" style="background:${s.color}"></span>
    <span class="srv-icon" style="background:${s.color}20;color:${s.color}">${s.icon}</span>
    <span class="srv-name">${s.name}</span>
    <span class="srv-quality">${s.quality||''}</span>
  </button>`;
}

window.selectStream=btn=>{
  document.querySelectorAll('.srv-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const stream=JSON.parse(decodeURIComponent(btn.dataset.stream||'{}'));
  if(!stream.url)return;
  const name=btn.querySelector('.srv-name')?.textContent||'Servidor';
  const embedDiv=qs('player-embed');
  if(embedDiv)embedDiv.innerHTML=`<div class="embed-placeholder"><div class="ep-icon" style="animation:pulse 1s infinite">▶</div><p style="color:var(--accent-light)">Cargando ${name}…</p></div>`;
  updateLangBadge(stream.lang);
  showToast(`${name} — ${stream.lang==='latino'?'🎌 Latino':'📖 Sub Español'}`,'success');
  setTimeout(()=>playStream(stream,embedDiv),500);
};

function updateLangBadge(lang){
  const b=qs('lang-badge');if(!b)return;
  b.className=lang==='latino'?'lang-indicator lang-latino':'lang-indicator lang-sub';
  b.textContent=lang==='latino'?'🎌 Latino':'📖 Sub Esp';
}

function renderNoStreams(sr,ed,title,ep){
  if(sr)sr.innerHTML=`<div style="font-size:13px;color:var(--text-muted);line-height:1.9;padding:2px 0">⚠️ No se encontraron streams en AnimeFLV para este episodio.<br>Prueba <strong style="color:var(--accent-light)">otro episodio</strong> o un <strong style="color:var(--accent-light)">anime más popular</strong> (mejor cobertura en AnimeFLV).</div>`;
  if(ed)ed.innerHTML=`<div class="embed-placeholder"><div class="ep-icon">⚠️</div><h3 style="font-family:var(--font-head);font-size:1.2rem;text-align:center">${title||'Episodio'} — Ep ${ep}</h3><p style="color:var(--text-muted);font-size:13px;text-align:center;max-width:360px;line-height:1.7">Sin streams disponibles en AnimeFLV.<br>Los animes muy nuevos o de nicho pueden tener menos cobertura.<br>Intenta otro episodio o vuelve más tarde.</p></div>`;
}

window.filterSidebarEps=q=>{document.querySelectorAll('.sidebar-ep-item').forEach(item=>{const n=item.querySelector('.ep-num')?.textContent||'';item.style.display=!q||n.includes(q)?'':'none';});};
window.toggleTheater=()=>{const l=document.querySelector('.player-layout'),s=document.querySelector('.player-sidebar');if(!l)return;const t=l.classList.toggle('theater');if(s)s.style.display=t?'none':'';showToast(t?'🎬 Modo cine':'Modo normal','info');};

/* ═══════════════════════════════════════════════════════════
   ARRANQUE
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  if(page==='home')  initHomePage();
  if(page==='anime') initAnimePage();
  if(page==='player')initPlayerPage();
  qs('scroll-top-btn')?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
});
