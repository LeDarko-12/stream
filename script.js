const API = "https://api.jikan.moe/v4/anime";

let page = 1;

const grid = document.getElementById("animeGrid");

const loader = document.getElementById("loader");

async function loadAnime(){

loader.style.display = "block";

const res = await fetch(`${API}?page=${page}`);

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

location.href = `anime.html?id=${anime.mal_id}`;

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

if(grid){

loadAnime();

}

const params = new URLSearchParams(window.location.search);

const id = params.get("id");

if(id){

loadAnimePage(id);

}

async function loadAnimePage(id){

const res = await fetch(`${API}/${id}`);

const data = await res.json();

const anime = data.data;

document.getElementById("animeTitle").innerText = anime.title;

document.getElementById("animeImage").src = anime.images.jpg.image_url;

document.getElementById("animeSynopsis").innerText = anime.synopsis;

document.getElementById("animeRating").innerText = anime.score;

const genresDiv = document.getElementById("animeGenres");

anime.genres.forEach(g=>{

const span = document.createElement("span");

span.innerText = g.name;

genresDiv.appendChild(span);

});

generateEpisodes(anime.episodes);

}

function generateEpisodes(num){

const epDiv = document.getElementById("episodes");

for(let i=1;i<=num;i++){

const btn = document.createElement("button");

btn.innerText = "Episodio "+i;

btn.onclick = ()=>{

location.href = `player.html?ep=${i}`;

};

epDiv.appendChild(btn);

}

}

const video = document.getElementById("videoPlayer");

let episode = new URLSearchParams(location.search).get("ep");

function changeServer(server){

if(server==1){

video.src = "https://filemoon.sx/e/"+episode;

}

if(server==2){

video.src = "https://voe.sx/e/"+episode;

}

if(server==3){

video.src = "https://streamsb.net/e/"+episode;

}

}

if(video){

changeServer(1);

}

const searchInput = document.getElementById("search");

if(searchInput){

searchInput.addEventListener("input", async e=>{

const q = e.target.value;

if(q.length<3) return;

const res = await fetch(`https://api.jikan.moe/v4/anime?q=${q}`);

const data = await res.json();

grid.innerHTML="";

displayAnime(data.data);

});

}
