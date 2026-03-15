const JIKAN = "https://api.jikan.moe/v4/anime";

let page = 1;

const grid = document.getElementById("animeGrid");
const loader = document.getElementById("loader");

/* =====================
CARGAR CATALOGO
===================== */

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

card.onclick = ()=>{

location.href =
`anime.html?id=${anime.mal_id}`;

};

grid.appendChild(card);

});

}

if(grid) loadAnime();

/* infinite scroll */

window.addEventListener("scroll",()=>{

if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 200){

page++;
loadAnime();

}

});


/* =====================
PAGINA ANIME
===================== */

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

if(id){
loadAnimePage(id);
}

async function loadAnimePage(id){

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

/* generar episodios */

generateEpisodes(anime.episodes);

}

/* =====================
GENERAR EPISODIOS
===================== */

function generateEpisodes(total){

const epDiv = document.getElementById("episodes");

if(!total || total === 0){

epDiv.innerHTML = "Episodios no disponibles.";
return;

}

for(let i=1;i<=total;i++){

const btn = document.createElement("button");

btn.innerText = "Episodio "+i;

btn.onclick = ()=>{

location.href = `player.html?ep=${i}`;

};

epDiv.appendChild(btn);

}

}


/* =====================
REPRODUCTOR
===================== */

const video = document.getElementById("videoPlayer");

const ep = new URLSearchParams(location.search).get("ep");

if(video){

/* demo embeds reales */

const servers = [

`https://vidsrc.to/embed/tv/1399/${ep}`,
`https://multiembed.mov/?video_id=1399&episode=${ep}`,
`https://vidsrc.xyz/embed/tv?tmdb=1399&season=1&episode=${ep}`

];

video.src = servers[0];

window.changeServer = function(n){

video.src = servers[n-1];

}

}


/* =====================
BUSCADOR
===================== */

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
