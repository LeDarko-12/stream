const JIKAN = "https://api.jikan.moe/v4/anime";
const GOGO = "https://api.consumet.org/anime/gogoanime";

/* ======================
CATALOGO PRINCIPAL
====================== */

let page = 1;
const grid = document.getElementById("animeGrid");
const loader = document.getElementById("loader");

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

location.href =
`anime.html?id=${anime.mal_id}&title=${encodeURIComponent(anime.title)}`;

};

grid.appendChild(card);

});

}

if(grid){
loadAnime();
}

/* infinite scroll */

window.addEventListener("scroll",()=>{

if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 100){

page++;
loadAnime();

}

});


/* ======================
PAGINA DEL ANIME
====================== */

const params = new URLSearchParams(window.location.search);
const malID = params.get("id");
const title = params.get("title");

if(malID){
loadAnimePage(malID,title);
}

async function loadAnimePage(id,title){

const res = await fetch(`${JIKAN}/${id}`);
const data = await res.json();

const anime = data.data;

document.getElementById("animeTitle").innerText = anime.title;
document.getElementById("animeImage").src = anime.images.jpg.image_url;
document.getElementById("animeSynopsis").innerText = anime.synopsis;
document.getElementById("animeRating").innerText = anime.score;

/* generos */

const genresDiv = document.getElementById("animeGenres");

anime.genres.forEach(g=>{

const span = document.createElement("span");
span.innerText = g.name + " ";
genresDiv.appendChild(span);

});

/* buscar anime real en gogo */

searchGogoAnime(title);

}


/* ======================
BUSCAR ANIME EN GOGO
====================== */

async function searchGogoAnime(name){

try{

const res = await fetch(`${GOGO}/${encodeURIComponent(name)}`);
const data = await res.json();

if(!data.results || data.results.length == 0){

document.getElementById("episodes").innerHTML =
"No se encontraron episodios.";

return;

}

const animeID = data.results[0].id;

loadEpisodes(animeID);

}catch(err){

console.log(err);

}

}


/* ======================
CARGAR EPISODIOS
====================== */

async function loadEpisodes(animeID){

const res = await fetch(`${GOGO}/info/${animeID}`);
const data = await res.json();

generateEpisodes(data.episodes);

}

function generateEpisodes(episodes){

const epDiv = document.getElementById("episodes");

episodes.forEach(ep=>{

const btn = document.createElement("button");

btn.innerText = "Episodio " + ep.number;

btn.onclick = ()=>{

location.href =
`player.html?episodeId=${ep.id}&number=${ep.number}`;

};

epDiv.appendChild(btn);

});

}


/* ======================
REPRODUCTOR
====================== */

const video = document.getElementById("videoPlayer");

const epID = new URLSearchParams(location.search).get("episodeId");

let servers = [];

if(video && epID){

loadEpisode(epID);

}

async function loadEpisode(id){

const res = await fetch(`${GOGO}/watch/${id}`);
const data = await res.json();

servers = data.sources;

if(servers.length > 0){

video.src = servers[0].url;

}

}

function changeServer(index){

if(!servers[index]) return;

video.src = servers[index].url;

}


/* ======================
BUSCADOR
====================== */

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
