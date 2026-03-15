'use strict';

/* CONFIG */

const CFG = {
  JIKAN: "https://api.jikan.moe/v4",
  ANILIST: "https://graphql.anilist.co",

  CONSUMET: [
    "https://consumet-api.vercel.app",
    "https://api.consumet.org",
    "https://consumet.pages.dev"
  ]
};

/* ============================
HTTP
============================ */

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

/* ============================
UTILS
============================ */

function qs(id){
  return document.getElementById(id);
}

function coverImg(a){
  return a?.images?.jpg?.large_image_url ||
         a?.images?.jpg?.image_url ||
         "https://placehold.co/300x420?text=Anime";
}

function goAnime(id,src){
  location.href=`anime.html?id=${id}&source=${src}`;
}

function goPlayer(id,src,ep){
  location.href=`player.html?id=${id}&source=${src}&ep=${ep}`;
}

/* ============================
JIKAN (metadata)
============================ */

async function jikanSearch(q){

  const d = await http(
    `${CFG.JIKAN}/anime?q=${encodeURIComponent(q)}&limit=10`
  );

  return d.data.map(a=>({

    id:a.mal_id,
    source:"jikan",
    title:a.title,
    cover:coverImg(a),
    episodes:a.episodes,
    rating:a.score

  }));

}

async function jikanDetail(id){

  const d = await http(`${CFG.JIKAN}/anime/${id}/full`);

  const a = d.data;

  return {

    id:a.mal_id,
    source:"jikan",
    title:a.title,
    cover:coverImg(a),
    synopsis:a.synopsis,
    episodes:a.episodes,
    rating:a.score,
    genres:a.genres?.map(g=>g.name) || []

  };

}

/* ============================
STREAM SOURCES
SIN ANIMEFLV
============================ */

/* ZORO */

async function zoroFindID(title){

  const d = await consumet(
    `/anime/zoro/${encodeURIComponent(title)}`
  );

  if(!d?.results?.length) return null;

  return d.results[0].id;

}

async function zoroGetEps(id){

  const d = await consumet(`/anime/zoro/info?id=${id}`);

  return d?.episodes || [];

}

async function zoroWatch(ep){

  const d = await consumet(`/anime/zoro/watch?episodeId=${ep}`);

  return {

    sources: d?.sources || [],
    headers: d?.headers || {}

  };

}

/* GOGOANIME */

async function gogoFindID(title){

  const d = await consumet(
    `/anime/gogoanime/${encodeURIComponent(title)}`
  );

  if(!d?.results?.length) return null;

  return d.results[0].id;

}

async function gogoGetEps(id){

  const d = await consumet(`/anime/gogoanime/info?id=${id}`);

  return d?.episodes || [];

}

async function gogoWatch(ep){

  const d = await consumet(`/anime/gogoanime/watch?episodeId=${ep}`);

  return {

    sources: d?.sources || [],
    headers: d?.headers || {}

  };

}

/* ANIMEPAHE (backup) */

async function paheFindID(title){

  const d = await consumet(
    `/anime/animepahe/${encodeURIComponent(title)}`
  );

  if(!d?.results?.length) return null;

  return d.results[0].id;

}

async function paheGetEps(id){

  const d = await consumet(`/anime/animepahe/info?id=${id}`);

  return d?.episodes || [];

}

async function paheWatch(ep){

  const d = await consumet(`/anime/animepahe/watch?episodeId=${ep}`);

  return {

    sources: d?.sources || [],
    headers: d?.headers || {}

  };

}

/* ============================
RESOLVE STREAMS
============================ */

async function resolveStreams(anime,ep){

  const title = anime.title || "";

  const streams = [];

  /* ZORO */

  const zoroID = await zoroFindID(title);

  if(zoroID){

    const eps = await zoroGetEps(zoroID);

    const episode = eps.find(e=>e.number==ep);

    if(episode){

      const stream = await zoroWatch(episode.id);

      for(const s of stream.sources){

        streams.push({

          server:"Zoro",
          url:s.url,
          quality:s.quality || "auto",
          lang:"sub"

        });

      }

    }

  }

  /* GOGO */

  const gogoID = await gogoFindID(title);

  if(gogoID){

    const eps = await gogoGetEps(gogoID);

    const episode = eps.find(e=>e.number==ep);

    if(episode){

      const stream = await gogoWatch(episode.id);

      for(const s of stream.sources){

        streams.push({

          server:"Gogo",
          url:s.url,
          quality:s.quality || "auto",
          lang:"sub"

        });

      }

    }

  }

  /* PAHE BACKUP */

  const paheID = await paheFindID(title);

  if(paheID){

    const eps = await paheGetEps(paheID);

    const episode = eps.find(e=>e.number==ep);

    if(episode){

      const stream = await paheWatch(episode.id);

      for(const s of stream.sources){

        streams.push({

          server:"Pahe",
          url:s.url,
          quality:s.quality || "auto",
          lang:"sub"

        });

      }

    }

  }

  return streams;

}
