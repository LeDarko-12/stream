'use strict';

/* =========================================
CONFIG
========================================= */

const CFG = {

  JIKAN: "https://api.jikan.moe/v4",

  CONSUMET: [
    "https://consumet-api.vercel.app",
    "https://api.consumet.org",
    "https://consumet.pages.dev",
    "https://consumet-clone.vercel.app"
  ]

};

/* =========================================
UTILIDADES
========================================= */

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

/* =========================================
METADATA (JIKAN)
========================================= */

async function jikanSearch(q){

  const d = await http(
    `${CFG.JIKAN}/anime?q=${encodeURIComponent(q)}&limit=10`
  );

  return d.data;

}

async function jikanDetail(id){

  const d = await http(`${CFG.JIKAN}/anime/${id}/full`);

  return d.data;

}

/* =========================================
SERVIDORES DISPONIBLES
15 SERVIDORES
========================================= */

const SERVERS = [

  "Zoro",
  "Gogoanime",
  "AnimePahe",

  "Streamwish",
  "VidHide",
  "VOE",

  "MixDrop",
  "DoodStream",
  "Mp4Upload",

  "StreamTape",
  "Mega",

  "Filemoon",
  "Upstream",
  "Okru",
  "YourUpload"

];

/* =========================================
BUSCAR ANIME EN FUENTES
========================================= */

async function findAnime(title){

  const sources = [];

  const zoro = await consumet(
    `/anime/zoro/${encodeURIComponent(title)}`
  );

  if(zoro?.results?.length){

    sources.push({
      provider:"zoro",
      id:zoro.results[0].id
    });

  }

  const gogo = await consumet(
    `/anime/gogoanime/${encodeURIComponent(title)}`
  );

  if(gogo?.results?.length){

    sources.push({
      provider:"gogoanime",
      id:gogo.results[0].id
    });

  }

  const pahe = await consumet(
    `/anime/animepahe/${encodeURIComponent(title)}`
  );

  if(pahe?.results?.length){

    sources.push({
      provider:"animepahe",
      id:pahe.results[0].id
    });

  }

  return sources;

}

/* =========================================
AUTOCARGA DE EPISODIOS
========================================= */

async function getEpisodes(provider,id){

  const d = await consumet(
    `/anime/${provider}/info?id=${id}`
  );

  return d?.episodes || [];

}

/* =========================================
OBTENER STREAMS
========================================= */

async function getStreams(provider,ep){

  const d = await consumet(
    `/anime/${provider}/watch?episodeId=${ep}`
  );

  return d?.sources || [];

}

/* =========================================
DETECTAR IDIOMA
========================================= */

function detectLanguage(url){

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

/* =========================================
RESOLVER STREAMS
========================================= */

async function resolveStreams(anime,ep){

  const title = anime.title || "";

  const streams = [];

  const sources = await findAnime(title);

  for(const src of sources){

    try{

      const eps = await getEpisodes(
        src.provider,
        src.id
      );

      const episode = eps.find(e=>e.number==ep);

      if(!episode) continue;

      const videos = await getStreams(
        src.provider,
        episode.id
      );

      for(const v of videos){

        streams.push({

          server: v.server || src.provider,
          url: v.url,
          quality: v.quality || "auto",
          lang: detectLanguage(v.url)

        });

      }

    }catch(e){}

  }

  return streams;

}

/* =========================================
AUTOCAMBIO DE SERVIDOR
========================================= */

async function autoPlay(streams){

  const video = document.getElementById("hls-video");

  for(const s of streams){

    try{

      if(Hls.isSupported()){

        const hls = new Hls();

        hls.loadSource(s.url);

        hls.attachMedia(video);

        return;

      }else{

        video.src = s.url;

        return;

      }

    }catch(e){}

  }

  alert("No se pudo reproducir el episodio");

}

/* =========================================
CARGAR EPISODIO
========================================= */

async function loadEpisode(anime,ep){

  const streams = await resolveStreams(anime,ep);

  if(!streams.length){

    alert("No se encontraron streams");

    return;

  }

  autoPlay(streams);

}
