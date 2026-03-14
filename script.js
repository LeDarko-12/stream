const api = "https://api.jikan.moe/v4/anime";

let page = 1;
let loading = false;

const grid = document.getElementById("animeGrid");

/* CATALOGO */

async function loadAnime(){

if(loading) return;

loading = true;

document.getElementById("loading").style.display="block";

const res = await fetch(`${api}?page=${page}`);
const data = await res.json();

data.data.forEach(anime=>{

const card = document.createElement("div");
card.className="card";

card.innerHTML=`

<img loading="lazy" src="${anime.images.jpg.large_image_url}">

<h3>${anime.title}</h3>

<div class="rating">⭐ ${anime.score || "N/A"}</div>

`;

card.onclick=()=>{

location.href=`anime.html?id=${anime.mal_id}`;

};

grid.appendChild(card);

});

page++;

loading=false;

document.getElementById("loading").style.display="none";

}

if(grid){

loadAnime();

window.addEventListener("scroll",()=>{

if(window.innerHeight+window.scrollY >= document.body.offsetHeight-200){

loadAnime();

}

});

}

/* SEARCH */

const searchInput = document.getElementById("searchInput");

if(searchInput){

searchInput.addEventListener("keyup", async ()=>{

grid.innerHTML="";

const q = searchInput.value;

const res = await fetch(`${api}?q=${q}`);
const data = await res.json();

data.data.forEach(anime=>{

const card = document.createElement("div");

card.className="card";

card.innerHTML=`

<img src="${anime.images.jpg.image_url}">

<h3>${anime.title}</h3>

<div class="rating">${anime.score}</div>

`;

card.onclick=()=>{

location.href=`anime.html?id=${anime.mal_id}`;

};

grid.appendChild(card);

});

});

}

/* ANIME PAGE */

const params = new URLSearchParams(location.search);

const id = params.get("id");

const container = document.getElementById("animeContainer");

if(container && id){

loadAnimePage();

}

async function loadAnimePage(){

const res = await fetch(`https://api.jikan.moe/v4/anime/${id}/full`);

const data = await res.json();

const anime = data.data;

container.innerHTML=`

<img src="${anime.images.jpg.large_image_url}">

<div>

<h1>${anime.title}</h1>

<p>${anime.synopsis}</p>

<p>⭐ ${anime.score}</p>

<p>${anime.status}</p>

<p>${anime.year || ""}</p>

</div>

`;

generateEpisodes(anime.title);

}

/* EPISODIOS */

async function generateEpisodes(title){

const list = document.getElementById("episodesList");

list.innerHTML="Cargando episodios...";

try{

const slug = title.toLowerCase()
.replace(/ /g,"-")
.replace(/[^a-z0-9\-]/g,"");

const res = await fetch(`https://api.consumet.org/anime/gogoanime/${slug}`);

const data = await res.json();

list.innerHTML="";

data.episodes.forEach(ep=>{

const btn=document.createElement("button");

btn.textContent=ep.number;

btn.onclick=()=>{

location.href=`player.html?epId=${ep.id}`;

};

list.appendChild(btn);

});

}catch{

list.innerHTML="No se pudieron cargar los episodios";

}

}

/* PLAYER */

const player=document.getElementById("videoPlayer");

if(player){

loadServers();

}

async function loadServers(){

const params = new URLSearchParams(location.search);

const epId = params.get("epId");

if(!epId) return;

try{

const res = await fetch(`https://api.consumet.org/anime/gogoanime/watch/${epId}`);

const data = await res.json();

const servers = data.sources;

player.src = servers[0].url;

const selector=document.querySelector(".server-selector");

selector.innerHTML="";

servers.forEach(server=>{

const btn=document.createElement("button");

btn.textContent = server.quality || "server";

btn.onclick=()=>{

player.src = server.url;

};

selector.appendChild(btn);

});

}catch{

player.src="";

}

}

/* BOTON SUBIR */

const topBtn=document.getElementById("topBtn");

if(topBtn){

topBtn.onclick=()=>{

window.scrollTo({top:0,behavior:"smooth"});

};

}
