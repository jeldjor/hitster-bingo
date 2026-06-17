const CLIENT_ID = "4765b89201b44558a7d5141f9b93c178";
const REDIRECT_URI = "https://jeldjor.github.io/hitster-bingo/";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-playback-state",
  "user-modify-playback-state"
].join(" ");

const colors = [
  {name:"GEEL", emoji:"🟨", input:"cat-yellow", hex:"#ffd21f"},
  {name:"ROZE", emoji:"🩷", input:"cat-pink", hex:"#ff4f93"},
  {name:"PAARS", emoji:"🟪", input:"cat-purple", hex:"#8d35ff"},
  {name:"BLAUW", emoji:"🟦", input:"cat-blue", hex:"#19a8ff"},
  {name:"GROEN", emoji:"🟩", input:"cat-green", hex:"#62d321"}
];

let accessToken = localStorage.getItem("spotify_access_token") || "";
let refreshToken = localStorage.getItem("spotify_refresh_token") || "";
let expiresAt = Number(localStorage.getItem("spotify_expires_at") || "0");
let player = null;
let deviceId = "";
let tracks = JSON.parse(localStorage.getItem("hb_tracks") || "[]");
let currentTrack = null;
let stopTimer = null;

function $(id){ return document.getElementById(id); }
function pick(list){ return list[Math.floor(Math.random() * list.length)]; }
function randomString(length){
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let out = "";
  crypto.getRandomValues(new Uint8Array(length)).forEach(x => out += chars[x % chars.length]);
  return out;
}
async function sha256(plain){
  const data = new TextEncoder().encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}
function base64url(buffer){
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
async function login(){
  const verifier = randomString(96);
  localStorage.setItem("spotify_code_verifier", verifier);
  const challenge = base64url(await sha256(verifier));
  const params = new URLSearchParams({
    response_type:"code",
    client_id:CLIENT_ID,
    scope:SCOPES,
    code_challenge_method:"S256",
    code_challenge:challenge,
    redirect_uri:REDIRECT_URI
  });
  window.location = "https://accounts.spotify.com/authorize?" + params.toString();
}
async function handleRedirect(){
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if(!code) return;
  const verifier = localStorage.getItem("spotify_code_verifier");
  const body = new URLSearchParams({
    client_id:CLIENT_ID,
    grant_type:"authorization_code",
    code,
    redirect_uri:REDIRECT_URI,
    code_verifier:verifier
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body
  });
  const data = await res.json();
  if(data.access_token){
    saveTokens(data);
    history.replaceState({}, document.title, REDIRECT_URI);
  } else {
    alert("Spotify login mislukt: " + JSON.stringify(data));
  }
}
function saveTokens(data){
  accessToken = data.access_token;
  if(data.refresh_token) refreshToken = data.refresh_token;
  expiresAt = Date.now() + (data.expires_in * 1000) - 60000;
  localStorage.setItem("spotify_access_token", accessToken);
  if(refreshToken) localStorage.setItem("spotify_refresh_token", refreshToken);
  localStorage.setItem("spotify_expires_at", String(expiresAt));
}
async function getToken(){
  if(accessToken && Date.now() < expiresAt) return accessToken;
  if(!refreshToken) return "";
  const body = new URLSearchParams({
    grant_type:"refresh_token",
    refresh_token:refreshToken,
    client_id:CLIENT_ID
  });
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body
  });
  const data = await res.json();
  if(data.access_token){ saveTokens(data); return accessToken; }
  return "";
}
async function api(url, options={}){
  const token = await getToken();
  if(!token) throw new Error("Niet ingelogd met Spotify.");
  const res = await fetch(url, {
    ...options,
    headers:{...(options.headers||{}), Authorization:"Bearer " + token, "Content-Type":"application/json"}
  });
  if(res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}
function logout(){
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_refresh_token");
  localStorage.removeItem("spotify_expires_at");
  accessToken = ""; refreshToken = ""; expiresAt = 0;
  updateStatus();
}
async function updateStatus(){
  if(await getToken()){
    try{
      const me = await api("https://api.spotify.com/v1/me");
      $("loginStatus").textContent = "Ingelogd als: " + (me.display_name || me.email || "Spotify gebruiker");
      $("activateBtn").disabled = false;
    }catch(e){ $("loginStatus").textContent = "Ingelogd, maar profiel laden lukt niet."; }
  } else {
    $("loginStatus").textContent = "Nog niet ingelogd.";
    $("activateBtn").disabled = true;
  }
  $("playlistStatus").textContent = tracks.length ? `${tracks.length} nummers geladen.` : "Nog geen playlist geladen.";
}
function playlistIdFromInput(value){
  const clean = value.trim();
  const m = clean.match(/playlist\/([a-zA-Z0-9]+)/);
  if(m) return m[1];
  if(/^[a-zA-Z0-9]{15,}$/.test(clean)) return clean;
  return "";
}
async function loadPlaylist(){
  const id = playlistIdFromInput($("playlistInput").value);
  if(!id){ alert("Plak een geldige Spotify playlist-link."); return; }
  $("playlistStatus").textContent = "Playlist laden...";
  let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100&fields=items(track(id,uri,name,duration_ms,artists(name),album(name,images,release_date))),next`;
  const loaded = [];
  try{
    while(url){
      const data = await api(url);
      for(const item of data.items || []){
        const t = item.track;
        if(t && t.id && t.uri){
          loaded.push({
            id:t.id, uri:t.uri, name:t.name, duration_ms:t.duration_ms,
            artists:(t.artists||[]).map(a=>a.name).join(", "),
            album:t.album?.name || "",
            image:t.album?.images?.[0]?.url || "",
            release_date:t.album?.release_date || ""
          });
        }
      }
      url = data.next;
      $("playlistStatus").textContent = `${loaded.length} nummers geladen...`;
    }
    tracks = loaded;
    localStorage.setItem("hb_tracks", JSON.stringify(tracks));
    $("playlistStatus").textContent = `${tracks.length} nummers geladen.`;
  }catch(e){
    alert("Playlist laden mislukt: " + e.message);
    $("playlistStatus").textContent = "Laden mislukt.";
  }
}
window.onSpotifyWebPlaybackSDKReady = () => {};
async function activatePlayer(){
  const token = await getToken();
  if(!token){ alert("Login eerst met Spotify."); return; }
  if(!window.Spotify){ alert("Spotify speler is nog niet geladen. Vernieuw de pagina."); return; }

  if(player){ try{ await player.connect(); }catch(e){} return; }

  player = new Spotify.Player({
    name: "Hitster Bingo Verborgen Speler",
    getOAuthToken: async cb => cb(await getToken()),
    volume: 0.8
  });

  player.addListener("ready", ({ device_id }) => {
    deviceId = device_id;
    $("loginStatus").textContent += " — speler actief.";
  });
  player.addListener("not_ready", () => { deviceId = ""; });
  player.addListener("initialization_error", ({ message }) => alert("Spotify speler fout: " + message));
  player.addListener("authentication_error", ({ message }) => alert("Spotify login fout: " + message));
  player.addListener("account_error", ({ message }) => alert("Spotify Premium nodig of accountfout: " + message));
  player.addListener("playback_error", ({ message }) => console.log("Playback error", message));

  const ok = await player.connect();
  if(!ok) alert("Spotify speler kon niet verbinden. Probeer Safari/Chrome opnieuw of open Spotify op een ander apparaat.");
}
function usedSet(){
  return new Set(JSON.parse(localStorage.getItem("hb_used") || "[]"));
}
function saveUsed(set){
  localStorage.setItem("hb_used", JSON.stringify([...set]));
}
function chooseTrack(){
  if(!tracks.length) return null;
  const noRepeat = $("noRepeat").checked;
  const used = usedSet();
  let available = noRepeat ? tracks.filter(t => !used.has(t.id)) : tracks;
  if(!available.length){
    used.clear(); saveUsed(used);
    available = tracks;
  }
  const t = pick(available);
  used.add(t.id); saveUsed(used);
  return t;
}
function showFlash(){
  const flash = document.createElement("div");
  flash.className = "flash";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 750);
}
function startRound(){
  $("answerArea").innerHTML = "";
  currentTrack = chooseTrack();
  if(!currentTrack){
    alert("Laad eerst een playlist.");
    return;
  }

  const bonus = $("bonusOn").checked && Math.random() < 0.05;
  const pickerArea = $("pickerArea");
  const mode = Math.random() < 0.5 ? "discobal" : "rad";

  if(mode === "discobal"){
    pickerArea.innerHTML = `<div class="discoWrap"><div class="pickerTitle">🎉 Discobal kiest...</div><div class="disco"></div></div>`;
  } else {
    pickerArea.innerHTML = `<div><div class="pickerTitle">🎡 Draairad draait...</div><div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div></div>`;
  }

  setTimeout(() => {
    showFlash();
    if(bonus){
      pickerArea.innerHTML = `<div class="reveal"><div class="colorName">⭐ BONUSRONDE</div><div class="category">${pick(["Vrije kleur kiezen","2 vakjes afstrepen","Extra beurt","Raad binnen 5 seconden"])}</div></div>`;
    } else {
      const selected = pick(colors);
      const category = $(selected.input).value.trim() || "Geen categorie ingevuld";
      pickerArea.innerHTML = `<div class="reveal"><div class="colorDot" style="background:${selected.hex};color:${selected.hex}"></div><div class="colorName">${selected.emoji} ${selected.name}</div><div class="category">Categorie:<br><strong>${category}</strong></div></div>`;
    }
    $("playBtn").disabled = false;
    $("answerBtn").disabled = false;
  }, 2500);
}
async function playHidden(){
  if(!currentTrack) return;
  if(!deviceId){
    await activatePlayer();
    await new Promise(r => setTimeout(r, 1200));
  }
  if(!deviceId){
    alert("Geen Spotify-speler actief. Tik op 'Activeer Spotify-speler' en probeer opnieuw.");
    return;
  }
  const duration = Number($("duration").value) * 1000;
  let position = 0;
  if($("randomStart").checked && currentTrack.duration_ms > duration + 40000){
    const max = Math.max(0, currentTrack.duration_ms - duration - 5000);
    position = Math.floor(20000 + Math.random() * Math.max(1, max - 20000));
  }
  try{
    await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method:"PUT",
      body:JSON.stringify({uris:[currentTrack.uri], position_ms:position})
    });
    $("stopBtn").disabled = false;
    clearTimeout(stopTimer);
    stopTimer = setTimeout(stopPlayback, duration);
  }catch(e){
    alert("Afspelen mislukt: " + e.message + "\n\nControleer of je Spotify Premium hebt en of de Spotify-speler actief is.");
  }
}
async function stopPlayback(){
  clearTimeout(stopTimer);
  try{ await api("https://api.spotify.com/v1/me/player/pause", {method:"PUT", body:"{}"}); }catch(e){}
  $("stopBtn").disabled = true;
}
function showAnswer(){
  if(!currentTrack) return;
  $("answerArea").innerHTML = `
    <div class="answerCard">
      ${currentTrack.image ? `<img src="${currentTrack.image}" alt="">` : `<div></div>`}
      <div>
        <h3>${currentTrack.name}</h3>
        <p><strong>Artiest:</strong> ${currentTrack.artists}</p>
        <p><strong>Album:</strong> ${currentTrack.album || "-"}</p>
        <p><strong>Jaar:</strong> ${(currentTrack.release_date || "-").slice(0,4)}</p>
      </div>
    </div>`;
}
$("loginBtn").addEventListener("click", login);
$("logoutBtn").addEventListener("click", logout);
$("loadPlaylistBtn").addEventListener("click", loadPlaylist);
$("activateBtn").addEventListener("click", activatePlayer);
$("startBtn").addEventListener("click", startRound);
$("playBtn").addEventListener("click", playHidden);
$("stopBtn").addEventListener("click", stopPlayback);
$("answerBtn").addEventListener("click", showAnswer);

handleRedirect().then(updateStatus);
