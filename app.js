const colors = [
  {name:"🟨 GEEL", key:"yellow", input:"cat-yellow"},
  {name:"🩷 ROZE", key:"pink", input:"cat-pink"},
  {name:"🟪 PAARS", key:"purple", input:"cat-purple"},
  {name:"🟦 BLAUW", key:"blue", input:"cat-blue"},
  {name:"🟩 GROEN", key:"green", input:"cat-green"}
];

const modes = ["🎉 Discobal", "🎡 Draairad"];
let currentTrack = null;
let usedTracks = new Set();

function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function spotifyIdFromUrl(line){
  const clean = line.trim();
  if(!clean) return null;
  const match = clean.match(/track\/([a-zA-Z0-9]+)/);
  if(match) return match[1];
  if(/^[a-zA-Z0-9]{15,}$/.test(clean)) return clean;
  return null;
}

function getTracks(){
  return document.getElementById("tracks").value
    .split("\n").map(spotifyIdFromUrl).filter(Boolean);
}

function startRound(){
  const bonusOn = document.getElementById("bonus").checked;
  const isBonus = bonusOn && Math.random() < 0.05;

  const round = document.getElementById("round");
  document.getElementById("spotifyBox").classList.add("hidden");
  document.getElementById("answer").disabled = true;

  if(isBonus){
    currentTrack = null;
    round.innerHTML = `
      <div>
        <div class="mode">${pick(modes)}</div>
        <div class="bonus">⭐ BONUSRONDE</div>
        <div class="category">${pick(["Vrije kleur kiezen","2 vakjes afstrepen","Extra beurt","Raad binnen 5 seconden"])}</div>
      </div>`;
    document.getElementById("play").disabled = true;
    return;
  }

  const color = pick(colors);
  const category = document.getElementById(color.input).value.trim() || "Geen categorie ingevuld";

  const tracks = getTracks();
  let available = tracks;
  if(document.getElementById("noRepeat").checked){
    available = tracks.filter(t => !usedTracks.has(t));
  }
  currentTrack = available.length ? pick(available) : null;
  if(currentTrack) usedTracks.add(currentTrack);

  round.innerHTML = `
    <div>
      <div class="mode">${pick(modes)}</div>
      <div class="color">${color.name}</div>
      <div class="category">Categorie: <strong>${category}</strong></div>
      <p class="small">Titel en artiest blijven verborgen tot je op Toon antwoord drukt.</p>
    </div>`;

  document.getElementById("play").disabled = !currentTrack;
  document.getElementById("answer").disabled = !currentTrack;
}

function playHidden(){
  if(!currentTrack) return;
  const duration = document.getElementById("duration").value;
  const box = document.getElementById("spotifyBox");
  box.classList.remove("hidden");
  box.innerHTML = `
    <p><strong>Verborgen Spotify-speler</strong> — fragment: ${duration} sec</p>
    <iframe src="https://open.spotify.com/embed/track/${currentTrack}?utm_source=generator"
      frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"></iframe>
    <p class="small">Tip: zet het scherm zo dat spelers de Spotify-info niet kunnen lezen. Voor volledig blind afspelen is Spotify API-login nodig.</p>
  `;
}

function showAnswer(){
  if(!currentTrack) return;
  const box = document.getElementById("spotifyBox");
  box.classList.remove("hidden");
  box.innerHTML += `
    <div class="answerCard">
      Antwoord tonen via Spotify-speler hierboven.<br>
      In de echte Spotify API-versie tonen we hier automatisch titel, artiest, album en jaar.
    </div>`;
}

document.getElementById("start").addEventListener("click", startRound);
document.getElementById("play").addEventListener("click", playHidden);
document.getElementById("answer").addEventListener("click", showAnswer);
