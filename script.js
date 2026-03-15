const JIKAN = "https://api.jikan.moe/v4/anime";
const GOGO = "https://api.consumet.org/anime/gogoanime";

let page = 1;

const grid = document.getElementById("animeGrid");
const loader = document.getElementById("loader");

/* =========================
   CARGAR ANIMES (JIKAN)
========================= */

async function loadAnime(){

loader.style.display = "block";

const res = await fetch(`${JIKAN}?page=${page}`);
const data = await res.json();

displayAnime(data.data);

loader.style.display = "none";

}

function displayAnime(animes){

animes.forEach(anime => {

const card = document.createElement("div");
card.className = "card";

card.innerHTML = `
<img loading="lazy" src="${anime.images.jpg.image_url}">
<div class="card-title">${anime.title}</div>
`;

card.onclick = () => {
location.href = `anime.html?id=${anime.mal_id}&title=${encodeURIComponent(anime.title)}`;
};

grid.appendChild(card);

});

}

window.addEventListener("scroll",()=>{

if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 100){

page++;
loadAnime();

}

});

if(grid) loadAnime();


/* =========================
   PAGINA DEL ANIME
========================= */

const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const title = params.get("title");

if(id){
loadAnimePage(id,title);
}

async function loadAnimePage(id,title){

const res = await fetch(`${JIKAN}/${id}`);
const data = await res.json();
const anime = data.data;

document.getElementById("animeTitle").innerText = anime.title;
document.getElementById("animeImage").src = anime.images.jpg.image_url;
document.getElementById("animeSynopsis").innerText = anime.synopsis;
document.getElementById("animeRating").innerText = anime.score;

const genresDiv = document.getElementById("animeGenres");

anime.genres.forEach(g=>{
const span = document.createElement("span");
span.innerText = g.name + " ";
genresDiv.appendChild(span);
});

/* buscar anime en GOGO */

searchEpisodes(title);

}

/* =========================
   BUSCAR EPISODIOS
========================= */

async function searchEpisodes(name){

const query = name.toLowerCase().replace(/\s/g,"-");

try{

const res = await fetch(`${GOGO}/${query}`);
const data = await res.json();

generateEpisodes(data.episodes);

}catch(e){

console.log("No se encontraron episodios");

}

}

function generateEpisodes(episodes){

const epDiv = document.getElementById("episodes");

episodes.forEach(ep=>{

const btn = document.createElement("button");

btn.innerText = "Episodio " + ep.number;

btn.onclick = ()=>{
location.href = `player.html?id=${ep.id}&ep=${ep.number}`;
};

epDiv.appendChild(btn);

});

}

/* =========================
   REPRODUCTOR
========================= */

const video = document.getElementById("videoPlayer");

const epID = new URLSearchParams(location.search).get("id");

if(video && epID){

loadEpisode(epID);

}

let servers = [];

async function loadEpisode(id){

const res = await fetch(`${GOGO}/watch/${id}`);
const data = await res.json();

servers = data.sources;

if(servers.length > 0){

video.src = servers[0].url;

}

}

function changeServer(index){

video.src = servers[index].url;

}


/* =========================
   BUSCADOR
========================= */

const searchInput = document.getElementById("search");

if(searchInput){

searchInput.addEventListener("input", async e=>{

const q = e.target.value;

if(q.length < 3) return;

const res = await fetch(`${JIKAN}?q=${q}`);
const data = await res.json();

grid.innerHTML="";
displayAnime(data.data);

});

}
