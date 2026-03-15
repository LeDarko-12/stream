'use strict';

/* ======================================
CONFIG
====================================== */

const CFG = {

  JIKAN: "https://api.jikan.moe/v4",

  CONSUMET: [
    "https://consumet-api.vercel.app",
    "https://api.consumet.org",
    "https://consumet.pages.dev"
  ]

};

/* ======================================
UTILS
====================================== */

async function http(url){

  const r = await fetch(url);

  if(!r.ok) throw new Error("HTTP "+r.status);

  return r.json();

}

async function consumet(path){

  for(const host of CFG.CONSUMET){

    try{

      const r = await fetch(host + path);

      if(r.ok){

        return await r.json();

      }

    }catch(e){}

  }

  return null;

}

function qs(id){
  return document.getElementById(id);
}

function goAnime(id,src){
  location.href=`anime.html?id=${id}&source=${src}`;
}

function goPlayer(id,src,ep){
  location.href=`player.html?id=${id}&source=${src}&ep=${ep}`;
}

/* ======================================
NORMALIZAR ANIME
====================================== */

function norm(a){

  return {

    id:a.mal_id,
    source:"jikan",
    title:a.title,
    cover:a.images?.jpg?.large_image_url || a.images?.jpg?.image_url,
    rating:a.score,
    episodes:a.episodes

  };

}

/* ======================================
CARGAR HOME
====================================== */

async function loadTrending(){

  const row = qs("trending-row");

  if(!row) return;

  const d = await http(`${CFG.JIKAN}/top/anime?limit=20`);

  row.innerHTML = d.data.map(a=>card(norm(a))).join("");

}

async function loadSeason(){

  const row = qs("recent-row");

  if(!row) return;

  const d = await http(`${CFG.JIKAN}/seasons/now`);

  row.innerHTML = d.data.map(a=>card(norm(a))).join("");

}

async function loadPopular(){

  const row = qs("popular-row");

  if(!row) return;

  const d = await http(`${CFG.JIKAN}/top/anime?filter=bypopularity`);

  row.innerHTML = d.data.map(a=>card(norm(a))).join("");

}

/* ======================================
CARD HTML
====================================== */

function card(a){

  return `
  
  <div class="anime-card" onclick="goAnime('${a.id}','${a.source}')">

    <div class="cover-wrap">

      <img src="${a.cover}" loading="lazy">

    </div>

    <div class="card-info">

      <div class="card-title">${a.title}</div>

      <div class="card-sub">
        ⭐ ${a.rating || "?"}
      </div>

    </div>

  </div>
  
  `;

}

/* ======================================
BUSCAR
====================================== */

async function searchAnime(q){

  const d = await http(`${CFG.JIKAN}/anime?q=${encodeURIComponent(q)}&limit=10`);

  return d.data.map(norm);

}

/* ======================================
STREAMS
SIN ANIMEFLV
====================================== */

async function resolveStreams(anime,ep){

  const title = anime.title || "";

  const results = [];

  const providers = [
    "zoro",
    "gogoanime",
    "animepahe"
  ];

  for(const provider of providers){

    try{

      const search = await consumet(
        `/anime/${provider}/${encodeURIComponent(title)}`
      );

      if(!search?.results?.length) continue;

      const animeId = search.results[0].id;

      const info = await consumet(
        `/anime/${provider}/info?id=${animeId}`
      );

      const episode = info?.episodes?.find(e => e.number == ep);

      if(!episode) continue;

      const watch = await consumet(
        `/anime/${provider}/watch?episodeId=${episode.id}`
      );

      for(const s of watch?.sources || []){

        results.push({

          server: s.server || provider,
          url: s.url,
          quality: s.quality || "auto",
          lang: s.url.includes("lat") ? "latino" : "sub"

        });

      }

    }catch(e){
      console.warn("Provider error:", provider);
    }

  }

  return results;

}

/* ======================================
AUTOPLAY PLAYER
====================================== */

async function playEpisode(anime,ep){

  const streams = await resolveStreams(anime,ep);

  if(!streams.length){

    alert("No se encontraron streams");

    return;

  }

  const video = qs("hls-video");

  const url = streams[0].url;

  if(Hls.isSupported()){

    const hls = new Hls();

    hls.loadSource(url);

    hls.attachMedia(video);

  }else{

    video.src = url;

  }

}

/* ======================================
INIT
====================================== */

document.addEventListener("DOMContentLoaded",()=>{

  loadSeason();

  loadTrending();

  loadPopular();

});
