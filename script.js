
const api = "https://api.jikan.moe/v4/anime";

let page = 1;
let loading = false;

const grid = document.getElementById("animeGrid");

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

generateEpisodes(anime.episodes || 12);

}

/* EPISODES */

function generateEpisodes(total){

const list = document.getElementById("episodesList");

for(let i=1;i<=total;i++){

const btn=document.createElement("button");

btn.textContent=i;

btn.onclick=()=>{

location.href=`player.html?id=${id}&ep=${i}`;

};

list.appendChild(btn);

}

}

/* PLAYER */

const player=document.getElementById("videoPlayer");

if(player){

const ep=params.get("ep");

const servers={

filemoon:`https://filemoon.sx/e/${id}-${ep}`,
streamtape:`https://streamtape.com/e/${id}${ep}`,
dood:`https://dood.wf/e/${id}${ep}`,
vidguard:`https://vidguard.to/e/${id}${ep}`

};

player.src=servers.filemoon;

document.querySelectorAll(".server-selector button").forEach(btn=>{

btn.onclick=()=>{

const server=btn.dataset.server;

player.src=servers[server];

};

});

}

/* TOP BUTTON */

const topBtn=document.getElementById("topBtn");

if(topBtn){

topBtn.onclick=()=>{

window.scrollTo({top:0,behavior:"smooth"});

};

}

