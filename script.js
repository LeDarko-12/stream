'use strict';

/* =====================================
CONFIG
===================================== */

const CFG = {

  JIKAN: "https://api.jikan.moe/v4",

  ANILIST: "https://graphql.anilist.co",

  CONSUMET: [
    "https://consumet-api.vercel.app",
    "https://api.consumet.org",
    "https://consumet.pages.dev"
  ]

};

/* =====================================
HTTP
===================================== */

async function http(url,opts={}){

  const r = await fetch(url,opts);

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

/* =====================================
UTILS
===================================== */

function qs(id){
  return document.getElementById(id);
}

function goAnime(id,src){
  location.href=`anime.html?id=${id}&source=${src}`;
}

function goPlayer(id,src,ep){
  location.href=`player.html?id=${id}&source=${src}&ep=${ep}`;
}

function coverImg(a){

  return a?.images?.jpg?.large_image_url ||
         a?.images?.jpg?.image_url ||
         a?.coverImage?.large ||
         "https://placehold.co/300x420";

}

/* =====================================
NORMALIZADORES
===================================== */

function normJikan(a){

  return {

    id:a.mal_id,
    source:"jikan",
    title:a.title,
    cover:coverImg(a),
    rating:a.score,
    episodes:a.episodes

  };

}

function normAni(a){

  return {

    id:a.id,
    source:"anilist",
    title:a.title.english || a.title.romaji,
    cover:a.coverImage.large,
    rating:a.averageScore ? a.averageScore/10 : null,
    episodes:a.episodes

  };

}

/* =====================================
ANILIST
===================================== */

async function anilistTrending(){

  const query = `
  query{
    Page(page:1,perPage:20){
      media(sort:TRENDING_DESC,type:ANIME){
        id
        episodes
        averageScore
        title{romaji english}
        coverImage{large}
      }
    }
  }`;

  const d = await http(CFG.ANILIST,{
    method:"POST",
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query})
  });

  return d.data.Page.media.map(normAni);

}

async function anilistPopular(){

  const query = `
  query{
    Page(page:1,perPage:20){
      media(sort:POPULARITY_DESC,type:ANIME){
        id
        episodes
        averageScore
        title{romaji english}
        coverImage{large}
      }
    }
  }`;

  const d = await http(CFG.ANILIST,{
    method:"POST",
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query})
  });

  return d.data.Page.media.map(normAni);

}

/* =====================================
JIKAN
===================================== */

async function jikanSeason(){

  const d = await http(`${CFG.JIKAN}/seasons/now`);

  return d.data.map(normJikan);

}

async function jikanDetail(id){

  const d = await http(`${CFG.JIKAN}/anime/${id}/full`);

  return normJikan(d.data);

}

/* =====================================
CARD
===================================== */

function card(a){

  return `
  
  <div class="anime-card" onclick="goAnime('${a.id}','${a.source}')">

    <div class="cover-wrap">
      <img src="${a.cover}" loading="lazy">
    </div>

    <div class="card-info">
      <div class="card-title">${a.title}</div>
      <div class="card-sub">⭐ ${a.rating || "?"}</div>
    </div>

  </div>
  
  `;

}

/* =====================================
CARGAR HOME
===================================== */

async function loadHome(){

  try{

    const season = await jikanSeason();

    const trending = await anilistTrending();

    const popular = await anilistPopular();

    const r1 = qs("recent-row");
    const r2 = qs("trending-row");
    const r3 = qs("popular-row");

    if(r1) r1.innerHTML = season.map(card).join("");
    if(r2) r2.innerHTML = trending.map(card).join("");
    if(r3) r3.innerHTML = popular.map(card).join("");

  }catch(e){

    console.error("Home error",e);

  }

}

/* =====================================
BUSCAR STREAM
===================================== */

async function resolveStreams(anime,ep){

  const title = anime.title || "";

  const providers = [
    "zoro",
    "gogoanime",
    "animepahe"
  ];

  const streams = [];

  for(const p of providers){

    try{

      const search = await consumet(
        `/anime/${p}/${encodeURIComponent(title)}`
      );

      if(!search?.results?.length) continue;

      const id = search.results[0].id;

      const info = await consumet(
        `/anime/${p}/info?id=${id}`
      );

      const episode = info?.episodes?.find(e=>e.number==ep);

      if(!episode) continue;

      const watch = await consumet(
        `/anime/${p}/watch?episodeId=${episode.id}`
      );

      for(const s of watch?.sources || []){

        streams.push({

          server:s.server || p,
          url:s.url,
          quality:s.quality || "auto",
          lang:s.url.includes("lat") ? "latino":"sub"

        });

      }

    }catch(e){
      console.warn("stream error",p);
    }

  }

  return streams;

}

/* =====================================
PLAYER
===================================== */

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

/* =====================================
INIT
===================================== */

document.addEventListener("DOMContentLoaded",()=>{

  loadHome();

});
