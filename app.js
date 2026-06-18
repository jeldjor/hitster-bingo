const CLIENT_ID="4765b89201b44558a7d5141f9b93c178";
const REDIRECT_URI=window.location.origin+window.location.pathname;
const SCOPES=["streaming","user-read-email","user-read-private","user-read-playback-state","user-modify-playback-state"].join(" ");
const firebaseConfig={apiKey:"AIzaSyCcquz1mpz3FsmFFBKgJLgpbkHCajTUpzY",authDomain:"hitster-bingo-cb792.firebaseapp.com",databaseURL:"https://hitster-bingo-cb792-default-rtdb.europe-west1.firebasedatabase.app",projectId:"hitster-bingo-cb792",storageBucket:"hitster-bingo-cb792.firebasestorage.app",messagingSenderId:"98696776977",appId:"1:98696776977:web:e797e555e2d9b38bcc99b0"};
const colors=[{name:"GEEL",emoji:"🟨",input:"cat-yellow",hex:"#ffd21f",key:"yellow"},{name:"ROZE",emoji:"🩷",input:"cat-pink",hex:"#ff4f93",key:"pink"},{name:"PAARS",emoji:"🟪",input:"cat-purple",hex:"#8d35ff",key:"purple"},{name:"BLAUW",emoji:"🟦",input:"cat-blue",hex:"#19a8ff",key:"blue"},{name:"GROEN",emoji:"🟩",input:"cat-green",hex:"#62d321",key:"green"}];
let accessToken=localStorage.getItem("spotify_access_token")||"",refreshToken=localStorage.getItem("spotify_refresh_token")||"",expiresAt=Number(localStorage.getItem("spotify_expires_at")||"0"),player=null,deviceId="",tracks=JSON.parse(localStorage.getItem("hb_csv_tracks")||"[]"),currentTrack=null,stopTimer=null,db=null,currentRoomCode="",currentPlayerId=localStorage.getItem("hb_player_id")||"",currentPlayerName=localStorage.getItem("hb_player_name")||"";
function $(id){return document.getElementById(id)} function pick(a){return a[Math.floor(Math.random()*a.length)]} function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function showError(msg){console.error(msg);let b=$("debugError");if(!b){b=document.createElement("div");b.id="debugError";b.style.cssText="background:#ffdddd;color:#200;padding:14px;border-radius:14px;margin:12px 0;font-weight:bold;white-space:pre-wrap;text-align:left";document.querySelector(".app").prepend(b)}b.textContent="Foutmelding:\\n"+msg}
function parseCSV(t){const rows=[];let r=[],c="",q=false;for(let i=0;i<t.length;i++){const ch=t[i],n=t[i+1];if(ch=='"'&&q&&n=='"'){c+='"';i++}else if(ch=='"')q=!q;else if(ch==","&&!q){r.push(c);c=""}else if((ch=="\n"||ch=="\r")&&!q){if(ch=="\r"&&n=="\n")i++;r.push(c);c="";if(r.some(v=>v.trim()))rows.push(r);r=[]}else c+=ch}r.push(c);if(r.some(v=>v.trim()))rows.push(r);return rows}
function norm(h){return h.toLowerCase().replace(/[^a-z0-9]/g,"")} function findI(h,names){const ns=h.map(norm);for(const n of names){const i=ns.indexOf(norm(n));if(i>=0)return i}return -1}
function tid(u){if(!u)return"";let m=u.match(/spotify:track:([a-zA-Z0-9]+)/)||u.match(/track\/([a-zA-Z0-9]+)/);if(m)return m[1];return /^[a-zA-Z0-9]{15,}$/.test(u.trim())?u.trim():""}
function loadCsvText(text){const rows=parseCSV(text),h=rows[0]||[],ui=findI(h,["Track URI","Spotify URI","URI"]),ti=findI(h,["Track Name","Name","Title"]),ai=findI(h,["Artist Name(s)","Artist Names","Artists","Artist"]),al=findI(h,["Album Name","Album"]),ri=findI(h,["Release Date","Release"]),di=findI(h,["Duration (ms)","Duration"]);if(ui<0||ti<0||ai<0)throw Error("CSV mist Track URI, Track Name of Artist Name(s).");const out=[],seen=new Set();for(let r=1;r<rows.length;r++){const row=rows[r],id=tid(row[ui]||"");if(!id||seen.has(id))continue;seen.add(id);let dur=di>=0?Number(row[di]):180000;out.push({id,uri:"spotify:track:"+id,name:row[ti]||"Onbekend",artists:row[ai]||"Onbekend",album:al>=0?row[al]||"":"",release_date:ri>=0?row[ri]||"":"",duration_ms:Number.isFinite(dur)&&dur>0?dur:180000})}tracks=out;localStorage.setItem("hb_csv_tracks",JSON.stringify(tracks));$("csvStatus").textContent=`${tracks.length} nummers geladen en opgeslagen.`}
function handleCsvFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{loadCsvText(r.result)}catch(err){alert("CSV laden mislukt: "+err.message)}};r.readAsText(f)}
function randomString(l){const ch="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";let o="";crypto.getRandomValues(new Uint8Array(l)).forEach(x=>o+=ch[x%ch.length]);return o} async function sha256(p){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(p))} function b64(b){return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
async function login(){const v=randomString(96);localStorage.setItem("spotify_code_verifier",v);const c=b64(await sha256(v));window.location="https://accounts.spotify.com/authorize?"+new URLSearchParams({response_type:"code",client_id:CLIENT_ID,scope:SCOPES,code_challenge_method:"S256",code_challenge:c,redirect_uri:REDIRECT_URI})}
async function handleRedirect(){const p=new URLSearchParams(location.search),code=p.get("code");if(!code)return;const v=localStorage.getItem("spotify_code_verifier");if(!v){showError("Geen code_verifier. Login opnieuw.");return}const res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI,code_verifier:v})});const data=await res.json().catch(()=>({}));if(data.access_token){saveTokens(data);localStorage.removeItem("spotify_code_verifier");history.replaceState({},document.title,REDIRECT_URI);await updateStatus()}else showError("Spotify token fout: "+JSON.stringify(data))}
function saveTokens(d){accessToken=d.access_token;if(d.refresh_token)refreshToken=d.refresh_token;expiresAt=Date.now()+d.expires_in*1000-60000;localStorage.setItem("spotify_access_token",accessToken);if(refreshToken)localStorage.setItem("spotify_refresh_token",refreshToken);localStorage.setItem("spotify_expires_at",String(expiresAt))}
async function getToken(){if(accessToken&&Date.now()<expiresAt)return accessToken;if(!refreshToken)return"";const res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken,client_id:CLIENT_ID})});const d=await res.json();if(d.access_token){saveTokens(d);return accessToken}return""}
async function api(url,opt={}){const t=await getToken();if(!t)throw Error("Niet ingelogd met Spotify.");const res=await fetch(url,{...opt,headers:{...(opt.headers||{}),Authorization:"Bearer "+t,"Content-Type":"application/json"}});if(res.status===204)return{};const d=await res.json().catch(()=>({}));if(!res.ok)throw Error(d.error?.message||JSON.stringify(d));return d}
function logout(){["spotify_access_token","spotify_refresh_token","spotify_expires_at"].forEach(k=>localStorage.removeItem(k));accessToken=refreshToken="";expiresAt=0;updateStatus()}
async function updateStatus(){if(await getToken()){try{const me=await api("https://api.spotify.com/v1/me");$("loginStatus").textContent="Ingelogd als: "+(me.display_name||me.email||"Spotify gebruiker");$("activateBtn").disabled=false}catch(e){$("loginStatus").textContent="Ingelogd, maar profiel laden lukt niet."}}else{$("loginStatus").textContent="Nog niet ingelogd.";$("activateBtn").disabled=true}$("csvStatus").textContent=tracks.length?`${tracks.length} nummers geladen.`:"Nog geen CSV geladen."}
window.onSpotifyWebPlaybackSDKReady=()=>{};async function activatePlayer(){const t=await getToken();if(!t){alert("Login eerst.");return}if(!window.Spotify){alert("Spotify speler nog niet geladen.");return}if(player){await player.connect();return}player=new Spotify.Player({name:"Hitster Bingo Verborgen Speler",getOAuthToken:async cb=>cb(await getToken()),volume:.8});player.addListener("ready",({device_id})=>{deviceId=device_id;$("loginStatus").textContent+=" — speler actief."});player.addListener("account_error",({message})=>alert("Spotify Premium nodig of accountfout: "+message));player.addListener("authentication_error",({message})=>alert("Spotify login fout: "+message));await player.connect()}
function usedSet(){return new Set(JSON.parse(localStorage.getItem("hb_used")||"[]"))}function saveUsed(s){localStorage.setItem("hb_used",JSON.stringify([...s]))}
function chooseTrack(){if(!tracks.length)return null;const u=usedSet();let a=$("noRepeat").checked?tracks.filter(t=>!u.has(t.id)):tracks;if(!a.length){u.clear();a=tracks}const t=pick(a);u.add(t.id);saveUsed(u);$("csvStatus").textContent=`${tracks.length} nummers geladen. Gespeeld: ${u.size}.`;return t}
function flash(){const f=document.createElement("div");f.className="flash";document.body.appendChild(f);setTimeout(()=>f.remove(),750)}
function startRound(){
  currentTrack=chooseTrack();
  $("answerArea").innerHTML="";
  $("playBtn").disabled=true;
  $("answerBtn").disabled=true;
  if(!currentTrack){alert("Upload eerst je CSV.");return}

  const area=$("pickerArea");
  const mode=Math.random()<.5?"discobal":"rad";
  const isBonus=$("bonusOn").checked&&Math.random()<.05;
  const roundId="r_"+Date.now();
  const seconds=Number($("duration").value)||20;
  const deadline=Date.now()+seconds*1000;

  let selectedColor=null;
  let roundCategory="";
  let bonusText="";

  area.innerHTML=mode==="discobal"
    ? `<div class="discoWrap"><div class="pickerTitle">🎉 Discobal kiest...</div><div class="disco"></div></div>`
    : `<div><div class="pickerTitle">🎡 Draairad draait...</div><div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div></div>`;

  setTimeout(()=>{
    flash();

    if(isBonus){
      bonusText=pick(["Vrije kleur kiezen","2 vakjes afstrepen","Extra beurt","Raad binnen 5 seconden"]);
      area.innerHTML=`<div class="reveal"><div class="colorName">⭐ BONUSRONDE</div><div class="category">${bonusText}</div></div>`;
    }else{
      selectedColor=pick(colors);
      roundCategory=$(selectedColor.input).value.trim()||"Geen categorie ingevuld";
      area.innerHTML=`<div class="reveal"><div class="colorDot" style="background:${selectedColor.hex};color:${selectedColor.hex}"></div><div class="colorName">${selectedColor.emoji} ${selectedColor.name}</div><div class="category">Categorie:<br><strong>${roundCategory}</strong></div></div>`;
    }

    $("playBtn").disabled=false;
    $("answerBtn").disabled=false;
    $("playBtn").textContent="🎵 Speel verborgen nummer";

    // Synchroniseer ronde naar spelers als er een actieve kamer is
    if(db && currentRoomCode){
      const roundData={
        id:roundId,
        status:"answering",
        startedAt:firebase.database.ServerValue.TIMESTAMP,
        deadlineMs:deadline,
        seconds:seconds,
        isBonus:isBonus,
        colorKey:selectedColor?selectedColor.key:"",
        colorName:selectedColor?selectedColor.name:"BONUS",
        colorEmoji:selectedColor?selectedColor.emoji:"⭐",
        category:isBonus?bonusText:roundCategory
      };
      db.ref("rooms/"+currentRoomCode+"/currentRound").set(roundData).then(()=>{ if($("hostRoundInfo")) $("hostRoundInfo").textContent="Ronde verzonden naar spelers."; });
      db.ref("rooms/"+currentRoomCode+"/rounds/"+roundId).set(roundData);
      $("hostAnswersBox").classList.remove("hidden");
      listenAnswersForHost(currentRoomCode, roundId);
      setTimeout(()=>lockRound(roundId), seconds*1000);
    }
  },2500)
}

async function playHidden(){if(!currentTrack)return;$("playBtn").disabled=true;$("playBtn").textContent="🎵 Nummer speelt...";if(!deviceId){await activatePlayer();await new Promise(r=>setTimeout(r,1200))}if(!deviceId){alert("Geen Spotify-speler actief.");$("playBtn").disabled=false;return}const dur=Number($("duration").value)*1000;let pos=0;if($("randomStart").checked&&currentTrack.duration_ms>dur+40000){const max=Math.max(0,currentTrack.duration_ms-dur-5000);pos=Math.floor(20000+Math.random()*Math.max(1,max-20000))}try{await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{method:"PUT",body:JSON.stringify({uris:[currentTrack.uri],position_ms:pos})});$("stopBtn").disabled=false;clearTimeout(stopTimer);stopTimer=setTimeout(stopPlayback,dur)}catch(e){alert("Afspelen mislukt: "+e.message);$("playBtn").disabled=false;$("playBtn").textContent="🎵 Speel verborgen nummer"}}
async function stopPlayback(){clearTimeout(stopTimer);try{await api("https://api.spotify.com/v1/me/player/pause",{method:"PUT",body:"{}"})}catch(e){}$("stopBtn").disabled=true;$("playBtn").disabled=true;$("playBtn").textContent="🎲 Druk op START RONDE voor nieuw nummer"}
function showAnswer(){if(!currentTrack)return;$("answerArea").innerHTML=`<div class="answerCard"><h3>${esc(currentTrack.name)}</h3><p><strong>Artiest:</strong> ${esc(currentTrack.artists)}</p><p><strong>Album:</strong> ${esc(currentTrack.album||"-")}</p><p><strong>Jaar:</strong> ${esc((currentTrack.release_date||"-").slice(0,4))}</p><p><strong>Volgende:</strong> druk op START RONDE voor een nieuw willekeurig nummer.</p></div>`}
function clearCsv(){localStorage.removeItem("hb_csv_tracks");tracks=[];$("csvStatus").textContent="CSV gewist."}function resetUsed(){localStorage.removeItem("hb_used");$("csvStatus").textContent=tracks.length?`${tracks.length} nummers geladen. Gespeelde nummers gereset.`:"Gespeelde nummers gereset."}

// Firebase rooms
function initFirebase(){try{if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);db=firebase.database()}catch(e){showError("Firebase starten mislukt: "+e.message)}}
function roomCode(){const ch="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let c="";for(let i=0;i<4;i++)c+=ch[Math.floor(Math.random()*ch.length)];return c}
function playerId(){return"p_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)}
function getCats(){return{yellow:$("cat-yellow").value.trim(),pink:$("cat-pink").value.trim(),purple:$("cat-purple").value.trim(),blue:$("cat-blue").value.trim(),green:$("cat-green").value.trim()}}
function genCard(){const p=[],cs=["yellow","pink","purple","blue","green"];for(let i=0;i<24;i++)p.push(cs[i%5]);for(let i=p.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[p[i],p[j]]=[p[j],p[i]]}const card=[];let k=0;for(let i=0;i<25;i++)card.push(i===12?"free":p[k++]);return card}
function emoji(k){return{yellow:"🟨",pink:"🩷",purple:"🟪",blue:"🟦",green:"🟩",free:"⭐"}[k]||"⬜"}
function createRoom(){if(!db){alert("Firebase niet actief.");return}currentRoomCode=roomCode();db.ref("rooms/"+currentRoomCode).set({createdAt:firebase.database.ServerValue.TIMESTAMP,status:"lobby",hostOnline:true,categories:getCats(),playerModuleOn:$("playerModuleOn").checked}).then(()=>{localStorage.setItem("hb_host_room",currentRoomCode);showHostRoom(currentRoomCode);listenPlayers(currentRoomCode)}).catch(e=>showError("Kamer maken mislukt: "+e.message))}
function showHostRoom(code){
  $("roomInfo").classList.remove("hidden");
  $("roomCodeText").textContent=code;
  const url=location.origin+location.pathname+"?room="+encodeURIComponent(code);
  $("joinLink").value=url;

  const qrUrl1 = "https://quickchart.io/qr?size=260&text=" + encodeURIComponent(url);
  const qrUrl2 = "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + encodeURIComponent(url);

  const qr=$("qrImage");
  const open=$("openQrLink");

  if(open){
    open.href = qrUrl1;
    open.textContent = "Open QR-code";
  }

  if(qr){
    qr.style.display = "inline-block";
    qr.onerror = function(){
      if(qr.src !== qrUrl2){
        qr.src = qrUrl2;
        if(open) open.href = qrUrl2;
      } else {
        qr.style.display = "none";
        let msg=document.getElementById("qrFallbackMsg");
        if(!msg){
          msg=document.createElement("div");
          msg.id="qrFallbackMsg";
          msg.className="qrError";
          msg.innerHTML="QR-code kon niet geladen worden. Gebruik de link hieronder of tik op <strong>Open QR-code</strong>.";
          $("roomInfo").appendChild(msg);
        }
      }
    };
    qr.src = qrUrl1;
  }
}
function listenPlayers(code){db.ref("rooms/"+code+"/players").on("value",s=>{const ps=Object.values(s.val()||{});$("playersList").innerHTML=ps.length?ps.map(p=>`<div class="playerItem"><strong>${esc(p.name||"Speler")}</strong><span>${p.online?"🟢 online":"⚪ weg"}</span></div>`).join(""):"Nog geen spelers."})}
function setupJoin(){
  const room=new URLSearchParams(location.search).get("room");
  if(!room)return;

  document.body.classList.add("playerMode");
  currentRoomCode=room.toUpperCase();

  document.querySelectorAll(".hostOnly").forEach(el=>{
    el.classList.add("hidden");
    el.style.display="none";
  });

  $("playerJoinPanel").classList.remove("hidden");
  $("playerRoomCode").textContent=currentRoomCode;

  if(currentPlayerName) $("playerNameInput").value=currentPlayerName;

  const savedRoom=localStorage.getItem("hb_player_room");
  if(savedRoom===currentRoomCode&&currentPlayerId&&currentPlayerName){
    joinRoom(true);
  }
}
function joinRoom(re=false){
  if(!currentRoomCode){
    alert("Geen spelcode gevonden. Open de link van de host opnieuw.");
    return;
  }
  if(!db){alert("Firebase niet actief.");return}
  const name=($("playerNameInput").value||currentPlayerName||"").trim();
  if(!name){alert("Vul eerst je naam in.");return}
  $("joinStatus").textContent="Bezig met verbinden...";if(!currentPlayerId)currentPlayerId=playerId();currentPlayerName=name;localStorage.setItem("hb_player_id",currentPlayerId);localStorage.setItem("hb_player_name",name);localStorage.setItem("hb_player_room",currentRoomCode);const ref=db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId);ref.once("value").then(s=>{const ex=s.val()||{};return ref.update({name,online:true,joinedAt:ex.joinedAt||firebase.database.ServerValue.TIMESTAMP,lastSeen:firebase.database.ServerValue.TIMESTAMP,card:ex.card||genCard(),marked:ex.marked||{}})}).then(()=>{ref.child("online").onDisconnect().set(false);ref.child("lastSeen").onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);$("joinStatus").textContent=re?"Welkom terug, "+name+"!":"Je doet mee, "+name+"!";showPlayerCard();listenPlayer()}).catch(e=>showError("Meedoen mislukt: "+e.message))}
function showPlayerCard(){$("playerCardPanel").classList.remove("hidden");$("playerNameView").textContent="Speler: "+currentPlayerName;db.ref("rooms/"+currentRoomCode).once("value").then(s=>{const r=s.val()||{},p=(r.players&&r.players[currentPlayerId])?r.players[currentPlayerId]:{};renderCard(p.card||[],p.marked||{});renderCats(r.categories||{})})}
function renderCard(card,marked){$("bingoCard").innerHTML=card.map((c,i)=>`<div class="bingoCell ${c==="free"?"free":""}" data-index="${i}">${marked&&marked[i]?"✅":emoji(c)}</div>`).join("")}
function renderCats(c){$("playerCategories").innerHTML=`<div>🟨 Geel = ${esc(c.yellow||"-")}</div><div>🩷 Roze = ${esc(c.pink||"-")}</div><div>🟪 Paars = ${esc(c.purple||"-")}</div><div>🟦 Blauw = ${esc(c.blue||"-")}</div><div>🟩 Groen = ${esc(c.green||"-")}</div>`}
function listenPlayer(){db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).on("value",s=>{const p=s.val();if(p)renderCard(p.card||[],p.marked||{})});db.ref("rooms/"+currentRoomCode+"/categories").on("value",s=>renderCats(s.val()||{}))}

$("loginBtn")?.addEventListener("click",login);$("logoutBtn")?.addEventListener("click",logout);$("activateBtn")?.addEventListener("click",activatePlayer);$("csvFile")?.addEventListener("change",handleCsvFile);$("clearCsvBtn")?.addEventListener("click",clearCsv);$("resetUsedBtn")?.addEventListener("click",resetUsed);$("startBtn")?.addEventListener("click",startRound);$("playBtn")?.addEventListener("click",playHidden);$("stopBtn")?.addEventListener("click",stopPlayback);$("answerBtn")?.addEventListener("click",showAnswer);$("newRoomBtn")?.addEventListener("click",createRoom);$("joinRoomBtn")?.addEventListener("click",()=>joinRoom(false));
initFirebase();handleRedirect().then(updateStatus).catch(e=>showError(e.message));setupJoin();const saved=localStorage.getItem("hb_host_room");if(saved&&!new URLSearchParams(location.search).get("room")){currentRoomCode=saved;showHostRoom(saved);listenPlayers(saved)}


setTimeout(() => {
  const room = new URLSearchParams(location.search).get("room");
  if(room && $("playerJoinPanel")){
    document.body.classList.add("playerMode");
    document.querySelectorAll(".hostOnly").forEach(el => {
      el.classList.add("hidden");
      el.style.display = "none";
    });
    $("playerJoinPanel").classList.remove("hidden");
    $("playerRoomCode").textContent = room.toUpperCase();
  }
}, 500);


/* =========================
   SPELERSMODULE V2: ANTWOORDEN + TIMER
   ========================= */

let playerTimerInterval=null;
let activePlayerRound=null;
let hostAnswerRoundId="";

function listenAnswersForHost(roomCode, roundId){
  hostAnswerRoundId=roundId;
  if(!$("hostAnswersBox")) return;
  $("hostAnswersBox").classList.remove("hidden");

  db.ref("rooms/"+roomCode).on("value", snap=>{
    const room=snap.val()||{};
    const round=room.currentRound||{};
    if(!round.id) return;
    hostAnswerRoundId=round.id;

    $("hostRoundInfo").textContent =
      (round.colorEmoji||"") + " " + (round.colorName||"") + 
      " — " + (round.category||"") + 
      " — status: " + (round.status||"");

    const players=room.players||{};
    const answers=room.answers&&room.answers[round.id] ? room.answers[round.id] : {};
    const correct=room.correct&&room.correct[round.id] ? room.correct[round.id] : {};

    const rows=Object.entries(players).map(([pid,p])=>{
      const ans=answers[pid] ? answers[pid].answer : "";
      const status=correct[pid];
      return `<div class="answerRow">
        <div>
          <strong>${esc(p.name||"Speler")}</strong><br>
          <span class="answerText">${esc(ans||"Geen antwoord")}</span>
        </div>
        <button class="goodBtn ${status===true?"goodSelected":""}" onclick="markAnswer('${pid}', true)">✅ Goed</button>
        <button class="badBtn ${status===false?"badSelected":""}" onclick="markAnswer('${pid}', false)">❌ Fout</button>
      </div>`;
    }).join("");

    $("hostAnswersList").innerHTML=rows||"Nog geen spelers.";
  });
}

function lockRound(roundId){
  if(!db||!currentRoomCode||!roundId) return;
  db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{
    const r=s.val()||{};
    if(r.id===roundId && r.status==="answering"){
      db.ref("rooms/"+currentRoomCode+"/currentRound/status").set("locked");
      db.ref("rooms/"+currentRoomCode+"/rounds/"+roundId+"/status").set("locked");
    }
  });
}

function markAnswer(playerId, isGood){
  if(!db||!currentRoomCode||!hostAnswerRoundId) return;
  db.ref("rooms/"+currentRoomCode+"/correct/"+hostAnswerRoundId+"/"+playerId).set(isGood);
}

function submitPlayerAnswer(){
  if(!db||!currentRoomCode||!currentPlayerId||!activePlayerRound) return;
  if(activePlayerRound.status!=="answering"){
    $("answerStatus").textContent="🔒 Antwoorden zijn al vergrendeld.";
    return;
  }
  const answer=($("playerAnswerInput").value||"").trim();
  db.ref("rooms/"+currentRoomCode+"/answers/"+activePlayerRound.id+"/"+currentPlayerId).set({
    answer:answer,
    submittedAt:firebase.database.ServerValue.TIMESTAMP
  }).then(()=>{
    $("playerAnswerInput").disabled=true;
    $("submitAnswerBtn").disabled=true;
    $("playerAnswerInput").classList.add("lockedInput");
    $("answerStatus").textContent="🔒 Antwoord ingeleverd.";
  });
}

function renderPlayerRound(round){
  activePlayerRound=round;
  if(!$("playerAnswerPanel")) return;

  $("playerAnswerPanel").classList.remove("hidden");

  if(!round||!round.id){
    $("playerRoundInfo").textContent="Wachten op ronde...";
    $("timerBox").textContent="⏱️ --";
    $("playerAnswerInput").disabled=true;
    $("submitAnswerBtn").disabled=true;
    return;
  }

  $("playerRoundInfo").textContent=(round.colorEmoji||"")+" "+(round.colorName||"")+" — "+(round.category||"");

  db.ref("rooms/"+currentRoomCode+"/answers/"+round.id+"/"+currentPlayerId).once("value").then(s=>{
    const existing=s.val();
    if(existing){
      $("playerAnswerInput").value=existing.answer||"";
      $("playerAnswerInput").disabled=true;
      $("submitAnswerBtn").disabled=true;
      $("answerStatus").textContent="🔒 Antwoord ingeleverd.";
    }else if(round.status==="answering"){
      $("playerAnswerInput").value="";
      $("playerAnswerInput").disabled=false;
      $("submitAnswerBtn").disabled=false;
      $("answerStatus").textContent="Typ je antwoord en druk op Verstuur.";
    }else{
      $("playerAnswerInput").disabled=true;
      $("submitAnswerBtn").disabled=true;
      $("answerStatus").textContent="🔒 Antwoorden zijn vergrendeld.";
    }
  });

  clearInterval(playerTimerInterval);
  playerTimerInterval=setInterval(()=>{
    const left=Math.max(0, Math.ceil(((round.deadlineMs||0)-Date.now())/1000));
    $("timerBox").textContent="⏱️ "+left+" sec";
    if(left<=0 || round.status!=="answering"){
      clearInterval(playerTimerInterval);
      $("playerAnswerInput").disabled=true;
      $("submitAnswerBtn").disabled=true;
      $("answerStatus").textContent="🔒 Tijd voorbij. Antwoord vergrendeld.";
    }
  },300);
}

function listenRoundForPlayer(){
  if(!db||!currentRoomCode) return;
  db.ref("rooms/"+currentRoomCode+"/currentRound").on("value", snap=>{
    renderPlayerRound(snap.val()||null);
  });
}

// Patch bestaande listenPlayer zodat ook rondes worden beluisterd
const oldListenPlayerV2 = listenPlayer;
listenPlayer = function(){
  oldListenPlayerV2();
  listenRoundForPlayer();
};

if($("submitAnswerBtn")){
  $("submitAnswerBtn").addEventListener("click", submitPlayerAnswer);
}
if($("lockRoundBtn")){
  $("lockRoundBtn").addEventListener("click", ()=>lockRound(hostAnswerRoundId));
}





/* =========================
   SPELERSMODULE V3: TIMER PAS BIJ SPEEL NUMMER + VAKJE KIEZEN
   ========================= */

let v3RoundId = "";
let v3SelectedColor = null;
let v3RoundCategory = "";
let v3RoundIsBonus = false;

function v3Seconds(){
  return Number($("duration") ? $("duration").value : 20) || 20;
}

function v3Room(){
  return currentRoomCode || localStorage.getItem("hb_host_room") || "";
}

function v3SendReadyRound(){
  const roomCode = v3Room();
  if(!db || !roomCode || !v3SelectedColor) return;

  v3RoundId = "r_" + Date.now();

  const roundData = {
    id: v3RoundId,
    status: "ready",
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    seconds: v3Seconds(),
    isBonus: v3RoundIsBonus,
    colorKey: v3SelectedColor.key || "",
    colorName: v3SelectedColor.name || "",
    colorEmoji: v3SelectedColor.emoji || "",
    category: v3RoundCategory || ""
  };

  db.ref("rooms/" + roomCode + "/currentRound").set(roundData)
    .then(() => db.ref("rooms/" + roomCode + "/rounds/" + v3RoundId).set(roundData))
    .then(() => {
      if($("roundSyncStatus")) $("roundSyncStatus").textContent =
        "✅ Ronde klaar voor spelers. Timer start pas bij 'Speel verborgen nummer'.";
      if($("hostAnswersBox")) $("hostAnswersBox").classList.remove("hidden");
      listenAnswersForHost(roomCode, v3RoundId);
    })
    .catch(e => showError("Ronde klaarzetten mislukt: " + e.message));
}

function startRoundV3(){
  currentTrack=chooseTrack();
  $("answerArea").innerHTML="";
  $("playBtn").disabled=true;
  $("answerBtn").disabled=true;

  if(!currentTrack){
    alert("Upload eerst je CSV.");
    return;
  }

  const area=$("pickerArea");
  const mode=Math.random()<.5?"discobal":"rad";
  v3RoundIsBonus=$("bonusOn").checked&&Math.random()<.05;

  area.innerHTML=mode==="discobal"
    ? `<div class="discoWrap"><div class="pickerTitle">🎉 Discobal kiest...</div><div class="disco"></div></div>`
    : `<div><div class="pickerTitle">🎡 Draairad draait...</div><div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div></div>`;

  setTimeout(()=>{
    flash();

    if(v3RoundIsBonus){
      v3SelectedColor={key:"", name:"BONUS", emoji:"⭐", hex:"#fff200", input:""};
      v3RoundCategory=pick(["Vrije kleur kiezen","2 vakjes afstrepen","Extra beurt","Raad binnen 5 seconden"]);
      area.innerHTML=`<div class="reveal"><div class="colorName">⭐ BONUSRONDE</div><div class="category">${v3RoundCategory}</div></div>`;
    }else{
      v3SelectedColor=pick(colors);
      v3RoundCategory=$(v3SelectedColor.input).value.trim()||"Geen categorie ingevuld";
      area.innerHTML=`<div class="reveal"><div class="colorDot" style="background:${v3SelectedColor.hex};color:${v3SelectedColor.hex}"></div><div class="colorName">${v3SelectedColor.emoji} ${v3SelectedColor.name}</div><div class="category">Categorie:<br><strong>${v3RoundCategory}</strong></div></div>`;
    }

    $("playBtn").disabled=false;
    $("answerBtn").disabled=false;
    $("playBtn").textContent="🎵 Speel verborgen nummer";
    v3SendReadyRound();
  },2500);
}

async function playHiddenV3(){
  if(!currentTrack) return;

  $("playBtn").disabled=true;
  $("playBtn").textContent="🎵 Nummer speelt...";

  if(!deviceId){
    await activatePlayer();
    await new Promise(r=>setTimeout(r,1200));
  }

  if(!deviceId){
    alert("Geen Spotify-speler actief.");
    $("playBtn").disabled=false;
    $("playBtn").textContent="🎵 Speel verborgen nummer";
    return;
  }

  const dur=v3Seconds()*1000;
  let pos=0;

  if($("randomStart").checked&&currentTrack.duration_ms>dur+40000){
    const max=Math.max(0,currentTrack.duration_ms-dur-5000);
    pos=Math.floor(20000+Math.random()*Math.max(1,max-20000));
  }

  try{
    await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{
      method:"PUT",
      body:JSON.stringify({uris:[currentTrack.uri],position_ms:pos})
    });

    const roomCode=v3Room();
    if(db && roomCode && v3RoundId){
      const deadline=Date.now()+dur;
      const updates={
        status:"answering",
        startedAt:firebase.database.ServerValue.TIMESTAMP,
        deadlineMs:deadline
      };
      await db.ref("rooms/"+roomCode+"/currentRound").update(updates);
      await db.ref("rooms/"+roomCode+"/rounds/"+v3RoundId).update(updates);
      if($("roundSyncStatus")) $("roundSyncStatus").textContent="⏱️ Muziek gestart. Timer loopt bij spelers.";
      setTimeout(()=>lockRound(v3RoundId), dur);
    }

    $("stopBtn").disabled=false;
    clearTimeout(stopTimer);
    stopTimer=setTimeout(stopPlayback,dur);
  }catch(e){
    alert("Afspelen mislukt: "+e.message);
    $("playBtn").disabled=false;
    $("playBtn").textContent="🎵 Speel verborgen nummer";
  }
}

function publishResultsToPlayers(){
  const roomCode=v3Room();
  if(!db || !roomCode || !hostAnswerRoundId) return;

  db.ref("rooms/"+roomCode+"/currentRound/status").set("judged");
  db.ref("rooms/"+roomCode+"/rounds/"+hostAnswerRoundId+"/status").set("judged");

  if($("roundSyncStatus")) $("roundSyncStatus").textContent="✅ Resultaten verzonden. Goede spelers mogen 1 vakje van de gespeelde kleur kiezen.";
}

function playerCanPickCell(cellColor, index){
  if(!activePlayerRound) return false;
  if(activePlayerRound.status!=="judged") return false;
  if(!window.__playerIsCorrect) return false;
  if(window.__playerPickedThisRound) return false;
  if(cellColor==="free") return false;
  return cellColor===activePlayerRound.colorKey;
}

function checkBingo(marked){
  const lines=[
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  const isMarked=i=>marked && (marked[i] || i===12);
  return lines.some(line=>line.every(isMarked));
}

function markBingoCell(index){
  if(!db||!currentRoomCode||!currentPlayerId||!activePlayerRound) return;

  db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).once("value").then(s=>{
    const p=s.val()||{};
    const card=p.card||[];
    const marked=p.marked||{};
    if(!playerCanPickCell(card[index], index)) return;

    marked[index]=true;
    window.__playerPickedThisRound=true;

    const hasBingo=checkBingo(marked);
    const updates={marked};
    if(hasBingo) updates.bingo=true;

    return db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).update(updates)
      .then(()=>{
        $("answerStatus").innerHTML=hasBingo
          ? "🎉 <strong>BINGO!</strong>"
          : "✅ Vakje afgestreept. Wacht op de volgende ronde.";
        if(hasBingo){
          db.ref("rooms/"+currentRoomCode+"/bingos/"+currentPlayerId).set({
            name:currentPlayerName,
            roundId:activePlayerRound.id,
            at:firebase.database.ServerValue.TIMESTAMP
          });
        }
      });
  });
}

function renderCardV3(card,marked){
  const canPick = activePlayerRound && activePlayerRound.status==="judged" && window.__playerIsCorrect && !window.__playerPickedThisRound;
  $("bingoCard").innerHTML=card.map((c,i)=>{
    const markedHere = marked && marked[i];
    const pickable = canPick && playerCanPickCell(c,i) && !markedHere;
    const blocked = canPick && !pickable && c!=="free" && !markedHere;
    return `<div class="bingoCell ${c==="free"?"free":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-index="${i}" data-color="${c}">
      ${markedHere?"✅":emoji(c)}
    </div>`;
  }).join("");

  document.querySelectorAll(".pickableCell").forEach(el=>{
    el.addEventListener("click",()=>markBingoCell(Number(el.dataset.index)));
  });
}

// Override renderCard to support pickable cells
renderCard = renderCardV3;

function listenPlayerResultStatus(){
  if(!db||!currentRoomCode||!currentPlayerId) return;

  db.ref("rooms/"+currentRoomCode).on("value", snap=>{
    const room=snap.val()||{};
    const round=room.currentRound||{};
    if(!round.id) return;

    const correct=room.correct && room.correct[round.id] ? room.correct[round.id][currentPlayerId] : undefined;
    const player=room.players && room.players[currentPlayerId] ? room.players[currentPlayerId] : {};
    const card=player.card||[];
    const marked=player.marked||{};

    window.__playerIsCorrect = correct===true;

    if(round.status==="judged"){
      if(correct===true){
        $("answerStatus").innerHTML=`✅ Goed! Kies 1 ${round.colorEmoji} ${round.colorName} vakje op je bingokaart.`;
      }else if(correct===false){
        $("answerStatus").textContent="❌ Helaas, geen vakje deze ronde.";
      }else{
        $("answerStatus").textContent="Wachten op beoordeling van de host.";
      }
      renderCardV3(card, marked);
    }
  });
}

// Patch player round render: ready means wachten op muziek, answering means input open
const oldRenderPlayerRoundV3 = renderPlayerRound;
renderPlayerRound = function(round){
  activePlayerRound=round;
  window.__playerPickedThisRound=false;

  if(!$("playerAnswerPanel")) return;
  $("playerAnswerPanel").classList.remove("hidden");

  if(!round||!round.id){
    $("playerRoundInfo").textContent="Wachten op ronde...";
    $("timerBox").textContent="⏱️ --";
    $("playerAnswerInput").disabled=true;
    $("submitAnswerBtn").disabled=true;
    return;
  }

  $("playerRoundInfo").textContent=(round.colorEmoji||"")+" "+(round.colorName||"")+" — "+(round.category||"");

  if(round.status==="ready"){
    clearInterval(playerTimerInterval);
    $("timerBox").textContent="⏱️ Wacht op muziek";
    $("playerAnswerInput").value="";
    $("playerAnswerInput").disabled=true;
    $("submitAnswerBtn").disabled=true;
    $("answerStatus").textContent="De host moet het nummer nog starten.";
    return;
  }

  oldRenderPlayerRoundV3(round);
};

setTimeout(()=>{
  const start=$("startBtn");
  if(start){
    start.onclick=null;
    start.replaceWith(start.cloneNode(true));
    $("startBtn").addEventListener("click", startRoundV3);
  }

  const play=$("playBtn");
  if(play){
    play.onclick=null;
    play.replaceWith(play.cloneNode(true));
    $("playBtn").addEventListener("click", playHiddenV3);
  }

  if($("publishResultsBtn")){
    $("publishResultsBtn").addEventListener("click", publishResultsToPlayers);
  }

  listenPlayerResultStatus();
},50);


/* =========================
   SPELERSMODULE V4: SPELERS ZIEN ELKAARS ANTWOORDEN
   ========================= */

function playerMaySeeAnswers(room, round){
  if(!round || !round.id) return false;
  const answer = room.answers && room.answers[round.id] ? room.answers[round.id][currentPlayerId] : null;
  return !!answer || round.status === "locked" || round.status === "judged";
}

function renderPlayerAnswersOverview(room){
  if(!$("playerAnswersOverviewPanel") || !$("playerAnswersOverview")) return;

  const round = room.currentRound || {};
  if(!round.id){
    $("playerAnswersOverviewPanel").classList.add("hidden");
    return;
  }

  if(!playerMaySeeAnswers(room, round)){
    $("playerAnswersOverviewPanel").classList.add("hidden");
    return;
  }

  $("playerAnswersOverviewPanel").classList.remove("hidden");

  const players = room.players || {};
  const answers = room.answers && room.answers[round.id] ? room.answers[round.id] : {};
  const correct = room.correct && room.correct[round.id] ? room.correct[round.id] : {};

  const rows = Object.entries(players).map(([pid, p]) => {
    const ans = answers[pid] && answers[pid].answer ? answers[pid].answer : "Geen antwoord";
    let verdict = "";
    if(round.status === "judged"){
      if(correct[pid] === true) verdict = " ✅";
      else if(correct[pid] === false) verdict = " ❌";
    }
    return `<div class="playerAnswerRow">
      <strong>${esc(p.name || "Speler")}${pid === currentPlayerId ? " (jij)" : ""}</strong>
      <span class="${ans === "Geen antwoord" ? "playerAnswerHidden" : ""}">${esc(ans)}${verdict}</span>
    </div>`;
  }).join("");

  $("playerAnswersOverview").innerHTML = rows || "Nog geen spelers.";
}

// Breid bestaande speler-room-listener uit met antwoordoverzicht
const oldListenPlayerResultStatusV4 = listenPlayerResultStatus;
listenPlayerResultStatus = function(){
  oldListenPlayerResultStatusV4();

  if(!db || !currentRoomCode) return;
  db.ref("rooms/" + currentRoomCode).on("value", snap => {
    const room = snap.val() || {};
    renderPlayerAnswersOverview(room);
  });
};

// Zorg dat overzicht direct verschijnt na insturen
const oldSubmitPlayerAnswerV4 = submitPlayerAnswer;
submitPlayerAnswer = function(){
  oldSubmitPlayerAnswerV4();
  setTimeout(() => {
    if(db && currentRoomCode){
      db.ref("rooms/" + currentRoomCode).once("value").then(s => {
        renderPlayerAnswersOverview(s.val() || {});
      });
    }
  }, 500);
};

// Wire opnieuw, omdat submitPlayerAnswer overschreven is
setTimeout(() => {
  const btn = $("submitAnswerBtn");
  if(btn){
    btn.replaceWith(btn.cloneNode(true));
    $("submitAnswerBtn").addEventListener("click", submitPlayerAnswer);
  }
}, 100);


/* =========================
   V5 DEFINITIEVE FLOW FIX
   - Timer start pas bij Speel verborgen nummer
   - Host publiceert resultaat
   - Speler mag 1 vakje van juiste kleur kiezen
   ========================= */

let v5CurrentRoundId = "";
let v5SelectedColor = null;
let v5Category = "";
let v5TimerToLock = null;

function v5RoomCode(){
  return currentRoomCode || localStorage.getItem("hb_host_room") || "";
}

function v5Seconds(){
  return Number($("duration") ? $("duration").value : 20) || 20;
}

function v5SetHostStatus(text){
  if($("roundSyncStatus")) $("roundSyncStatus").textContent = text;
}

function v5CreateReadyRound(){
  const room = v5RoomCode();
  if(!db || !room || !v5SelectedColor) return;

  v5CurrentRoundId = "r_" + Date.now();

  const round = {
    id: v5CurrentRoundId,
    status: "ready",
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    seconds: v5Seconds(),
    isBonus: false,
    colorKey: v5SelectedColor.key,
    colorName: v5SelectedColor.name,
    colorEmoji: v5SelectedColor.emoji,
    category: v5Category
  };

  db.ref("rooms/" + room + "/currentRound").set(round)
    .then(() => db.ref("rooms/" + room + "/rounds/" + v5CurrentRoundId).set(round))
    .then(() => {
      v5SetHostStatus("✅ Ronde klaargezet. Spelers wachten op muziek. Timer loopt nog NIET.");
      if($("hostAnswersBox")) $("hostAnswersBox").classList.remove("hidden");
      if(typeof listenAnswersForHost === "function") listenAnswersForHost(room, v5CurrentRoundId);
    })
    .catch(e => showError("Ronde klaarzetten mislukt: " + e.message));
}

function startRoundV5(){
  currentTrack = chooseTrack();

  if($("answerArea")) $("answerArea").innerHTML = "";
  if($("playBtn")) {
    $("playBtn").disabled = true;
    $("playBtn").textContent = "🎵 Speel verborgen nummer";
  }
  if($("answerBtn")) $("answerBtn").disabled = true;

  if(!currentTrack){
    alert("Upload eerst je CSV.");
    return;
  }

  const area = $("pickerArea");
  const mode = Math.random() < .5 ? "discobal" : "rad";

  area.innerHTML = mode === "discobal"
    ? `<div class="discoWrap"><div class="pickerTitle">🎉 Discobal kiest...</div><div class="disco"></div></div>`
    : `<div><div class="pickerTitle">🎡 Draairad draait...</div><div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div></div>`;

  setTimeout(() => {
    flash();

    v5SelectedColor = pick(colors);
    v5Category = $(v5SelectedColor.input).value.trim() || "Geen categorie ingevuld";

    area.innerHTML = `<div class="reveal">
      <div class="colorDot" style="background:${v5SelectedColor.hex};color:${v5SelectedColor.hex}"></div>
      <div class="colorName">${v5SelectedColor.emoji} ${v5SelectedColor.name}</div>
      <div class="category">Categorie:<br><strong>${v5Category}</strong></div>
    </div>`;

    if($("playBtn")) $("playBtn").disabled = false;
    if($("answerBtn")) $("answerBtn").disabled = false;

    v5CreateReadyRound();
  }, 2500);
}

async function playHiddenV5(){
  if(!currentTrack) return;

  if($("playBtn")){
    $("playBtn").disabled = true;
    $("playBtn").textContent = "🎵 Nummer speelt...";
  }

  if(!deviceId){
    await activatePlayer();
    await new Promise(r => setTimeout(r, 1200));
  }

  if(!deviceId){
    alert("Geen Spotify-speler actief.");
    if($("playBtn")){
      $("playBtn").disabled = false;
      $("playBtn").textContent = "🎵 Speel verborgen nummer";
    }
    return;
  }

  const seconds = v5Seconds();
  const durationMs = seconds * 1000;
  let position = 0;

  if($("randomStart") && $("randomStart").checked && currentTrack.duration_ms > durationMs + 40000){
    const max = Math.max(0, currentTrack.duration_ms - durationMs - 5000);
    position = Math.floor(20000 + Math.random() * Math.max(1, max - 20000));
  }

  try{
    await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{
      method:"PUT",
      body:JSON.stringify({uris:[currentTrack.uri], position_ms:position})
    });

    const room = v5RoomCode();
    if(db && room && v5CurrentRoundId){
      const deadline = Date.now() + durationMs;
      const updates = {
        status:"answering",
        startedAt: firebase.database.ServerValue.TIMESTAMP,
        deadlineMs: deadline,
        seconds: seconds
      };

      await db.ref("rooms/" + room + "/currentRound").update(updates);
      await db.ref("rooms/" + room + "/rounds/" + v5CurrentRoundId).update(updates);

      v5SetHostStatus("⏱️ Muziek gestart. Timer loopt nu bij spelers.");

      clearTimeout(v5TimerToLock);
      v5TimerToLock = setTimeout(() => {
        lockRound(v5CurrentRoundId);
        v5SetHostStatus("🔒 Timer voorbij. Antwoorden vergrendeld.");
      }, durationMs);
    }

    if($("stopBtn")) $("stopBtn").disabled = false;
    clearTimeout(stopTimer);
    stopTimer = setTimeout(stopPlayback, durationMs);
  }catch(e){
    alert("Afspelen mislukt: " + e.message);
    if($("playBtn")){
      $("playBtn").disabled = false;
      $("playBtn").textContent = "🎵 Speel verborgen nummer";
    }
  }
}

function publishResultsToPlayersV5(){
  const room = v5RoomCode();
  const roundId = hostAnswerRoundId || v5CurrentRoundId;
  if(!db || !room || !roundId){
    alert("Geen ronde gevonden om te publiceren.");
    return;
  }

  db.ref("rooms/" + room + "/currentRound/status").set("judged")
    .then(() => db.ref("rooms/" + room + "/rounds/" + roundId + "/status").set("judged"))
    .then(() => {
      v5SetHostStatus("✅ Resultaten verzonden. Goede spelers mogen nu 1 vakje kiezen van de gespeelde kleur.");
    })
    .catch(e => showError("Resultaten verzenden mislukt: " + e.message));
}

function renderPlayerRoundV5(round){
  activePlayerRound = round;

  if(!$("playerAnswerPanel")) return;
  $("playerAnswerPanel").classList.remove("hidden");

  if(!round || !round.id){
    $("playerRoundInfo").textContent = "Wachten op ronde...";
    $("timerBox").textContent = "⏱️ --";
    $("playerAnswerInput").disabled = true;
    $("submitAnswerBtn").disabled = true;
    return;
  }

  $("playerRoundInfo").textContent = (round.colorEmoji || "") + " " + (round.colorName || "") + " — " + (round.category || "");

  if(round.status === "ready"){
    clearInterval(playerTimerInterval);
    $("timerBox").innerHTML = `<div class="playerWaiting">Wachten tot de host het nummer start 🎵</div>`;
    $("playerAnswerInput").value = "";
    $("playerAnswerInput").disabled = true;
    $("submitAnswerBtn").disabled = true;
    $("answerStatus").textContent = "Je kunt antwoorden zodra de muziek start.";
    return;
  }

  if(round.status === "answering"){
    db.ref("rooms/" + currentRoomCode + "/answers/" + round.id + "/" + currentPlayerId).once("value").then(s => {
      const existing = s.val();
      if(existing){
        $("playerAnswerInput").value = existing.answer || "";
        $("playerAnswerInput").disabled = true;
        $("submitAnswerBtn").disabled = true;
        $("answerStatus").textContent = "🔒 Antwoord ingeleverd.";
      }else{
        $("playerAnswerInput").disabled = false;
        $("submitAnswerBtn").disabled = false;
        $("answerStatus").textContent = "Typ je antwoord en druk op Verstuur.";
      }
    });

    clearInterval(playerTimerInterval);
    playerTimerInterval = setInterval(() => {
      const left = Math.max(0, Math.ceil(((round.deadlineMs || 0) - Date.now()) / 1000));
      $("timerBox").textContent = "⏱️ " + left + " sec";

      if(left <= 0){
        clearInterval(playerTimerInterval);
        $("playerAnswerInput").disabled = true;
        $("submitAnswerBtn").disabled = true;
        $("answerStatus").textContent = "🔒 Tijd voorbij. Antwoord vergrendeld.";
      }
    }, 300);
    return;
  }

  if(round.status === "locked"){
    clearInterval(playerTimerInterval);
    $("timerBox").textContent = "🔒 Vergrendeld";
    $("playerAnswerInput").disabled = true;
    $("submitAnswerBtn").disabled = true;
    $("answerStatus").textContent = "Wachten op beoordeling van de host.";
    return;
  }

  if(round.status === "judged"){
    clearInterval(playerTimerInterval);
    $("timerBox").textContent = "✅ Beoordeeld";
    $("playerAnswerInput").disabled = true;
    $("submitAnswerBtn").disabled = true;
    // De exacte goed/fout tekst en vakjes worden door listenPlayerResultStatusV5 afgehandeld.
  }
}

function checkBingoV5(marked){
  const lines = [
    [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
    [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
    [0,6,12,18,24],[4,8,12,16,20]
  ];
  const ok = i => i === 12 || (marked && marked[i]);
  return lines.some(line => line.every(ok));
}

function playerMayPickV5(cellColor, index, marked){
  if(!activePlayerRound || activePlayerRound.status !== "judged") return false;
  if(window.__playerIsCorrect !== true) return false;
  if(window.__playerPickedThisRound === true) return false;
  if(cellColor === "free") return false;
  if(marked && marked[index]) return false;
  return cellColor === activePlayerRound.colorKey;
}

function renderCardV5(card, marked){
  const canPickNow = activePlayerRound && activePlayerRound.status === "judged" && window.__playerIsCorrect === true && !window.__playerPickedThisRound;

  $("bingoCard").innerHTML = card.map((c,i) => {
    const markedHere = marked && marked[i];
    const pickable = playerMayPickV5(c, i, marked);
    const blocked = canPickNow && !pickable && c !== "free" && !markedHere;

    return `<div class="bingoCell ${c==="free"?"free":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-index="${i}" data-color="${c}">
      ${markedHere ? "✅" : emoji(c)}
    </div>`;
  }).join("");

  document.querySelectorAll(".pickableCell").forEach(el => {
    el.addEventListener("click", () => markBingoCellV5(Number(el.dataset.index)));
  });
}

function markBingoCellV5(index){
  if(!db || !currentRoomCode || !currentPlayerId || !activePlayerRound) return;

  db.ref("rooms/" + currentRoomCode + "/players/" + currentPlayerId).once("value").then(s => {
    const p = s.val() || {};
    const card = p.card || [];
    const marked = p.marked || {};

    if(!playerMayPickV5(card[index], index, marked)) return;

    marked[index] = true;
    window.__playerPickedThisRound = true;

    const hasBingo = checkBingoV5(marked);

    return db.ref("rooms/" + currentRoomCode + "/players/" + currentPlayerId).update({
      marked: marked,
      bingo: hasBingo || false,
      lastPickedRound: activePlayerRound.id
    }).then(() => {
      $("answerStatus").innerHTML = hasBingo
        ? "🎉 <strong>BINGO!</strong>"
        : "✅ Vakje afgestreept. Wacht op de volgende ronde.";

      if(hasBingo){
        db.ref("rooms/" + currentRoomCode + "/bingos/" + currentPlayerId).set({
          name: currentPlayerName,
          roundId: activePlayerRound.id,
          at: firebase.database.ServerValue.TIMESTAMP
        });
      }
    });
  });
}

function listenPlayerResultStatusV5(){
  if(!db || !currentRoomCode || !currentPlayerId) return;

  db.ref("rooms/" + currentRoomCode).on("value", snap => {
    const room = snap.val() || {};
    const round = room.currentRound || {};
    if(!round.id) return;

    activePlayerRound = round;

    const player = room.players && room.players[currentPlayerId] ? room.players[currentPlayerId] : {};
    const correctForRound = room.correct && room.correct[round.id] ? room.correct[round.id] : {};
    const correct = correctForRound[currentPlayerId];

    window.__playerIsCorrect = correct === true;
    window.__playerPickedThisRound = player.lastPickedRound === round.id;

    if(round.status === "judged"){
      if(correct === true){
        if(window.__playerPickedThisRound){
          $("answerStatus").textContent = "✅ Je hebt deze ronde al een vakje gekozen.";
        }else{
          $("answerStatus").innerHTML = `✅ Goed! Kies 1 ${round.colorEmoji} ${round.colorName} vakje.`;
        }
      }else if(correct === false){
        $("answerStatus").textContent = "❌ Helaas, geen vakje deze ronde.";
      }else{
        $("answerStatus").textContent = "Wachten op beoordeling van de host.";
      }
    }

    renderCardV5(player.card || [], player.marked || {});
  });
}

// Override alle relevante functies definitief
startRound = startRoundV5;
playHidden = playHiddenV5;
renderPlayerRound = renderPlayerRoundV5;
renderCard = renderCardV5;
publishResultsToPlayers = publishResultsToPlayersV5;
listenPlayerResultStatus = listenPlayerResultStatusV5;

// Vervang knoppen zodat oude event listeners niet meer meedoen
setTimeout(() => {
  const startOld = $("startBtn");
  if(startOld){
    const startNew = startOld.cloneNode(true);
    startOld.parentNode.replaceChild(startNew, startOld);
    startNew.addEventListener("click", startRoundV5);
  }

  const playOld = $("playBtn");
  if(playOld){
    const playNew = playOld.cloneNode(true);
    playOld.parentNode.replaceChild(playNew, playOld);
    playNew.addEventListener("click", playHiddenV5);
  }

  const publishOld = $("publishResultsBtn");
  if(publishOld){
    const publishNew = publishOld.cloneNode(true);
    publishOld.parentNode.replaceChild(publishNew, publishOld);
    publishNew.addEventListener("click", publishResultsToPlayersV5);
  }

  // Zorg dat spelers altijd naar resultaten luisteren
  setTimeout(() => {
    try{ listenPlayerResultStatusV5(); }catch(e){}
  }, 500);
}, 500);


/* =========================
   V6 SCOREBOARD + BINGO BROADCAST + WINNAARSTEM
   ========================= */

let lastAnnouncedBingoKey = localStorage.getItem("hb_last_bingo_key") || "";

function playVictoryTune(){
  try{
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.16);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.18);
    });
  }catch(e){}
}

function speakWinner(name){
  try{
    if(!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance("Speler " + name + " heeft gewonnen!");
    msg.lang = "nl-NL";
    msg.rate = 0.9;
    msg.pitch = 1.05;
    msg.volume = 1;
    window.speechSynthesis.speak(msg);
  }catch(e){}
}

function launchConfetti(){
  const colors = ["#ffd21f","#ff4f93","#8d35ff","#19a8ff","#62d321","#ffffff"];
  for(let i=0;i<90;i++){
    const p = document.createElement("div");
    p.className = "confettiPiece";
    p.style.left = Math.random()*100 + "vw";
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.animationDelay = (Math.random()*0.6) + "s";
    p.style.transform = "rotate(" + (Math.random()*360) + "deg)";
    document.body.appendChild(p);
    setTimeout(()=>p.remove(), 3500);
  }
}

function showWinnerEverywhere(name){
  if($("winnerPanel") && $("winnerMessage")){
    $("winnerPanel").classList.remove("hidden");
    $("winnerMessage").innerHTML = "🏆 BINGO!<br>Speler " + esc(name) + " heeft gewonnen!";
  }
  if($("hostBingoBox") && $("hostBingoMessage")){
    $("hostBingoBox").classList.remove("hidden");
    $("hostBingoMessage").innerHTML = "🏆 BINGO!<br>Speler " + esc(name) + " heeft gewonnen!";
  }
  launchConfetti();
  playVictoryTune();
  setTimeout(()=>speakWinner(name), 700);
}

function listenForBingoV6(){
  const room = currentRoomCode || localStorage.getItem("hb_host_room") || "";
  if(!db || !room) return;

  db.ref("rooms/" + room + "/bingos").on("child_added", snap => {
    const bingo = snap.val() || {};
    const key = snap.key + "_" + (bingo.roundId || "");
    if(key === lastAnnouncedBingoKey) return;
    lastAnnouncedBingoKey = key;
    localStorage.setItem("hb_last_bingo_key", key);
    showWinnerEverywhere(bingo.name || "onbekend");
  });
}

function makeScoreCard(name, answer, status, isMe){
  let icon = "⏳";
  let cls = "scorePending";
  if(status === true){ icon = "✅"; cls = "scoreGood"; }
  else if(status === false){ icon = "❌"; cls = "scoreBad"; }

  return `<div class="scoreCard ${cls}">
    <div class="scoreName">${esc(name)}${isMe ? " (jij)" : ""}</div>
    <div class="scoreAnswer">${esc(answer || "Geen antwoord")}</div>
    <div class="scoreStatus">${icon}</div>
  </div>`;
}

// Host-scorebord mooier maken
if(typeof listenAnswersForHost === "function"){
  const oldListenAnswersForHostV6 = listenAnswersForHost;
  listenAnswersForHost = function(roomCode, roundId){
    hostAnswerRoundId = roundId;
    if($("hostAnswersBox")) $("hostAnswersBox").classList.remove("hidden");

    db.ref("rooms/"+roomCode).on("value", snap=>{
      const room=snap.val()||{};
      const round=room.currentRound||{};
      const activeRoundId = round.id || roundId;
      if(!activeRoundId) return;
      hostAnswerRoundId = activeRoundId;

      if($("hostRoundInfo")){
        $("hostRoundInfo").textContent =
          (round.colorEmoji||"") + " " + (round.colorName||"") +
          " — " + (round.category||"") +
          " — status: " + (round.status||"");
      }

      const players=room.players||{};
      const answers=room.answers&&room.answers[activeRoundId] ? room.answers[activeRoundId] : {};
      const correct=room.correct&&room.correct[activeRoundId] ? room.correct[activeRoundId] : {};

      const rows=Object.entries(players).map(([pid,p])=>{
        const ans=answers[pid] ? answers[pid].answer : "";
        const status=correct[pid];
        let statusClass = status === true ? "scoreGood" : status === false ? "scoreBad" : "scorePending";
        return `<div class="scoreCard ${statusClass}">
          <div class="scoreName">${esc(p.name||"Speler")}</div>
          <div class="scoreAnswer">${esc(ans||"Geen antwoord")}</div>
          <div>
            <button class="goodBtn ${status===true?"goodSelected":""}" onclick="markAnswer('${pid}', true)">✅</button>
            <button class="badBtn ${status===false?"badSelected":""}" onclick="markAnswer('${pid}', false)">❌</button>
          </div>
        </div>`;
      }).join("");

      if($("hostAnswersList")) $("hostAnswersList").innerHTML = rows || "Nog geen spelers.";
    });
  };
}

// Speler-scorebord mooier maken
function renderPlayerAnswersOverviewV6(room){
  if(!$("playerAnswersOverviewPanel") || !$("playerAnswersOverview")) return;

  const round = room.currentRound || {};
  if(!round.id){
    $("playerAnswersOverviewPanel").classList.add("hidden");
    return;
  }

  if(!playerMaySeeAnswers(room, round)){
    $("playerAnswersOverviewPanel").classList.add("hidden");
    return;
  }

  $("playerAnswersOverviewPanel").classList.remove("hidden");

  const players = room.players || {};
  const answers = room.answers && room.answers[round.id] ? room.answers[round.id] : {};
  const correct = room.correct && room.correct[round.id] ? room.correct[round.id] : {};

  const rows = Object.entries(players).map(([pid,p]) => {
    const ans = answers[pid] && answers[pid].answer ? answers[pid].answer : "Geen antwoord";
    const status = round.status === "judged" ? correct[pid] : undefined;
    return makeScoreCard(p.name || "Speler", ans, status, pid === currentPlayerId);
  }).join("");

  $("playerAnswersOverview").innerHTML = rows || "Nog geen spelers.";
}

// Override oude overzicht-renderer
renderPlayerAnswersOverview = renderPlayerAnswersOverviewV6;

// Fix: bingo opslaan met uniek push-id, zodat child_added altijd afgaat
if(typeof markBingoCellV5 === "function"){
  const oldMarkBingoCellV6 = markBingoCellV5;
  markBingoCellV5 = function(index){
    if(!db || !currentRoomCode || !currentPlayerId || !activePlayerRound) return;

    db.ref("rooms/" + currentRoomCode + "/players/" + currentPlayerId).once("value").then(s => {
      const p = s.val() || {};
      const card = p.card || [];
      const marked = p.marked || {};

      if(!playerMayPickV5(card[index], index, marked)) return;

      marked[index] = true;
      window.__playerPickedThisRound = true;

      const hasBingo = checkBingoV5(marked);

      return db.ref("rooms/" + currentRoomCode + "/players/" + currentPlayerId).update({
        marked: marked,
        bingo: hasBingo || false,
        lastPickedRound: activePlayerRound.id
      }).then(() => {
        if(hasBingo){
          $("answerStatus").innerHTML = "🎉 <strong>BINGO!</strong>";
          const bingoData = {
            playerId: currentPlayerId,
            name: currentPlayerName,
            roundId: activePlayerRound.id,
            at: firebase.database.ServerValue.TIMESTAMP
          };
          return db.ref("rooms/" + currentRoomCode + "/bingos").push(bingoData);
        }else{
          $("answerStatus").textContent = "✅ Vakje afgestreept. Wacht op de volgende ronde.";
        }
      });
    });
  };

  // Zorg dat renderCard de nieuwe mark-functie gebruikt
  renderCardV5 = function(card, marked){
    const canPickNow = activePlayerRound && activePlayerRound.status === "judged" && window.__playerIsCorrect === true && !window.__playerPickedThisRound;

    $("bingoCard").innerHTML = card.map((c,i) => {
      const markedHere = marked && marked[i];
      const pickable = playerMayPickV5(c, i, marked);
      const blocked = canPickNow && !pickable && c !== "free" && !markedHere;

      return `<div class="bingoCell ${c==="free"?"free":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-index="${i}" data-color="${c}">
        ${markedHere ? "✅" : emoji(c)}
      </div>`;
    }).join("");

    document.querySelectorAll(".pickableCell").forEach(el => {
      el.addEventListener("click", () => markBingoCellV5(Number(el.dataset.index)));
    });
  };

  renderCard = renderCardV5;
}

// Start bingo-listener op host en speler
setTimeout(() => {
  listenForBingoV6();
}, 1200);


/* =========================
   V7 JUISTE ANTWOORD NAAR SPELERS
   ========================= */

function currentCorrectAnswerData(){
  if(!currentTrack) return null;
  return {
    title: currentTrack.name || "",
    artist: currentTrack.artists || "",
    album: currentTrack.album || "",
    year: (currentTrack.release_date || "").slice(0,4),
    shownAt: firebase && firebase.database ? firebase.database.ServerValue.TIMESTAMP : Date.now()
  };
}

function showAnswerV7(){
  if(!currentTrack) return;

  // Host ziet antwoord zoals eerst
  $("answerArea").innerHTML=`<div class="answerCard">
    <h3>${esc(currentTrack.name)}</h3>
    <p><strong>Artiest:</strong> ${esc(currentTrack.artists)}</p>
    <p><strong>Album:</strong> ${esc(currentTrack.album||"-")}</p>
    <p><strong>Jaar:</strong> ${esc((currentTrack.release_date||"-").slice(0,4))}</p>
    <p><strong>Volgende:</strong> druk op START RONDE voor een nieuw willekeurig nummer.</p>
  </div>`;

  // Stuur antwoord naar spelers
  const room = currentRoomCode || localStorage.getItem("hb_host_room") || "";
  const roundId = hostAnswerRoundId || v5CurrentRoundId || "";
  const answer = currentCorrectAnswerData();

  if(db && room && roundId && answer){
    db.ref("rooms/" + room + "/correctAnswer/" + roundId).set(answer);
    db.ref("rooms/" + room + "/currentRound/correctAnswerShown").set(true);
  }
}

function renderCorrectAnswerBox(answer){
  if(!$("correctAnswerBox")) return;

  if(!answer || (!answer.title && !answer.artist)){
    $("correctAnswerBox").classList.add("hidden");
    $("correctAnswerBox").innerHTML = "";
    return;
  }

  $("correctAnswerBox").classList.remove("hidden");
  $("correctAnswerBox").innerHTML = `
    <h3>✅ Juiste antwoord</h3>
    <p><strong>${esc(answer.title || "-")}</strong></p>
    <p>👤 ${esc(answer.artist || "-")}</p>
    <p>💿 ${esc(answer.album || "-")}</p>
    <p>📅 ${esc(answer.year || "-")}</p>
  `;
}

// Breid scorebord-render uit met juiste antwoord
const oldRenderPlayerAnswersOverviewV7 = renderPlayerAnswersOverview;
renderPlayerAnswersOverview = function(room){
  const round = room.currentRound || {};
  if(round && round.id){
    const answer = room.correctAnswer && room.correctAnswer[round.id] ? room.correctAnswer[round.id] : null;
    renderCorrectAnswerBox(answer);
  } else {
    renderCorrectAnswerBox(null);
  }
  oldRenderPlayerAnswersOverviewV7(room);
};

// Override Toon antwoord knop
showAnswer = showAnswerV7;

setTimeout(() => {
  const answerOld = $("answerBtn");
  if(answerOld){
    const answerNew = answerOld.cloneNode(true);
    answerOld.parentNode.replaceChild(answerNew, answerOld);
    answerNew.addEventListener("click", showAnswerV7);
  }
}, 500);


/* =========================
   V8 SPOTIFY ANTWOORD ROBUUST NAAR SPELERS
   ========================= */

function buildSpotifyAnswerV8(){
  if(!currentTrack) return null;
  return {
    track: currentTrack.name || "",
    title: currentTrack.name || "",
    artist: currentTrack.artists || "",
    artists: currentTrack.artists || "",
    album: currentTrack.album || "",
    year: (currentTrack.release_date || "").slice(0,4) || "",
    release_date: currentTrack.release_date || "",
    shownAtClient: Date.now()
  };
}

function showAnswerV8(){
  if(!currentTrack) return;

  const answer = buildSpotifyAnswerV8();

  if($("answerArea")){
    $("answerArea").innerHTML=`<div class="answerCard">
      <h3>${esc(answer.track || "-")}</h3>
      <p><strong>Artiest:</strong> ${esc(answer.artist || "-")}</p>
      <p><strong>Album:</strong> ${esc(answer.album || "-")}</p>
      <p><strong>Jaar:</strong> ${esc(answer.year || "-")}</p>
      <p><strong>Volgende:</strong> druk op START RONDE voor een nieuw willekeurig nummer.</p>
    </div>`;
  }

  const room = currentRoomCode || localStorage.getItem("hb_host_room") || "";
  const roundId = hostAnswerRoundId || v5CurrentRoundId || v3RoundId || "";

  if(db && room && roundId && answer){
    const payload = {
      ...answer,
      shownAt: firebase.database.ServerValue.TIMESTAMP
    };

    const updates = {};
    updates["rooms/" + room + "/correctAnswer/" + roundId] = payload;
    updates["rooms/" + room + "/currentRound/correctAnswer"] = payload;
    updates["rooms/" + room + "/currentRound/correctAnswerShown"] = true;
    updates["rooms/" + room + "/rounds/" + roundId + "/correctAnswer"] = payload;
    updates["rooms/" + room + "/rounds/" + roundId + "/correctAnswerShown"] = true;

    db.ref().update(updates).then(()=>{
      if($("roundSyncStatus")) $("roundSyncStatus").textContent = "✅ Juiste antwoord verzonden naar spelers.";
    }).catch(e=>showError("Juiste antwoord verzenden mislukt: " + e.message));
  }
}

function renderSpotifyAnswerForPlayersV8(answer){
  if(!$("correctAnswerBox")) return;

  if(!answer || (!answer.track && !answer.title && !answer.artist && !answer.artists)){
    $("correctAnswerBox").classList.add("hidden");
    $("correctAnswerBox").innerHTML = "";
    return;
  }

  const track = answer.track || answer.title || "-";
  const artist = answer.artist || answer.artists || "-";
  const album = answer.album || "-";
  const year = answer.year || (answer.release_date || "").slice(0,4) || "-";

  $("correctAnswerBox").classList.remove("hidden");
  $("correctAnswerBox").innerHTML = `
    <div class="spotifyAnswerCard">
      <h3>✅ Juiste Spotify-antwoord</h3>
      <div class="spotifyAnswerGrid">
        <div>🎵 <strong>Track:</strong> ${esc(track)}</div>
        <div>👤 <strong>Artiest:</strong> ${esc(artist)}</div>
        <div>📅 <strong>Jaar:</strong> ${esc(year)}</div>
        <div>💿 <strong>Album:</strong> ${esc(album)}</div>
      </div>
    </div>
  `;
}

function listenSpotifyAnswerForPlayersV8(){
  if(!db || !currentRoomCode) return;

  db.ref("rooms/" + currentRoomCode + "/currentRound").on("value", snap=>{
    const round = snap.val() || {};
    if(round.correctAnswerShown && round.correctAnswer){
      if($("playerAnswersOverviewPanel")) $("playerAnswersOverviewPanel").classList.remove("hidden");
      renderSpotifyAnswerForPlayersV8(round.correctAnswer);
    }else{
      renderSpotifyAnswerForPlayersV8(null);
    }
  });
}

// Override oude Toon antwoord definitief
showAnswer = showAnswerV8;

setTimeout(()=>{
  const oldBtn = $("answerBtn");
  if(oldBtn){
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener("click", showAnswerV8);
  }

  // Start speler-listener, ook als eerdere scorebord render niet opnieuw triggert
  try{ listenSpotifyAnswerForPlayersV8(); }catch(e){}
}, 800);



/* =========================================================
   CLEAN FINAL PATCH - correcte hoofdflow
   ========================================================= */
(function(){
  function getRoom(){ return currentRoomCode || localStorage.getItem("hb_host_room") || ""; }
  function getSeconds(){ return Number(document.getElementById("duration")?.value || 20) || 20; }
  function getColorList(){ return (typeof colors !== "undefined" && colors.length) ? colors : [
    {key:"yellow",name:"GEEL",emoji:"🟨",input:"cat-yellow",hex:"#ffd21f"},
    {key:"pink",name:"ROZE",emoji:"🩷",input:"cat-pink",hex:"#ff4f93"},
    {key:"purple",name:"PAARS",emoji:"🟪",input:"cat-purple",hex:"#8d35ff"},
    {key:"blue",name:"BLAUW",emoji:"🟦",input:"cat-blue",hex:"#19a8ff"},
    {key:"green",name:"GROEN",emoji:"🟩",input:"cat-green",hex:"#62d321"}
  ]; }

  window.__cleanRoundId = "";
  window.__cleanSelectedColor = null;

  function cleanHostStatus(text){
    if(document.getElementById("roundSyncStatus")) document.getElementById("roundSyncStatus").textContent = text;
  }

  window.cleanStartRound = function(){
    currentTrack = chooseTrack();
    if(!currentTrack){ alert("Upload eerst je CSV."); return; }

    if($("answerArea")) $("answerArea").innerHTML = "";
    if($("playBtn")) { $("playBtn").disabled = true; $("playBtn").textContent = "🎵 Speel verborgen nummer"; }
    if($("answerBtn")) $("answerBtn").disabled = true;

    const area = $("pickerArea");
    const mode = Math.random() < .5 ? "discobal" : "rad";
    area.innerHTML = mode === "discobal"
      ? `<div class="discoWrap"><div class="pickerTitle">🎉 Discobal kiest...</div><div class="disco"></div></div>`
      : `<div><div class="pickerTitle">🎡 Draairad draait...</div><div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div></div>`;

    setTimeout(() => {
      if(typeof flash === "function") flash();

      window.__cleanSelectedColor = pick(getColorList());
      const c = window.__cleanSelectedColor;
      const category = $(c.input).value.trim() || "Geen categorie ingevuld";

      area.innerHTML = `<div class="reveal">
        <div class="colorDot" style="background:${c.hex};color:${c.hex}"></div>
        <div class="colorName">${c.emoji} ${c.name}</div>
        <div class="category">Categorie:<br><strong>${category}</strong></div>
      </div>`;

      if($("playBtn")) $("playBtn").disabled = false;
      if($("answerBtn")) $("answerBtn").disabled = false;

      const room = getRoom();
      if(db && room){
        window.__cleanRoundId = "r_" + Date.now();
        hostAnswerRoundId = window.__cleanRoundId;
        if(typeof v5CurrentRoundId !== "undefined") v5CurrentRoundId = window.__cleanRoundId;
        if(typeof v3RoundId !== "undefined") v3RoundId = window.__cleanRoundId;

        const round = {
          id: window.__cleanRoundId,
          status: "ready",
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          seconds: getSeconds(),
          isBonus: false,
          colorKey: c.key,
          colorName: c.name,
          colorEmoji: c.emoji,
          category: category
        };

        db.ref("rooms/" + room + "/currentRound").set(round)
          .then(() => db.ref("rooms/" + room + "/rounds/" + window.__cleanRoundId).set(round))
          .then(() => {
            cleanHostStatus("✅ Ronde klaargezet. Spelers wachten op muziek. Timer loopt nog niet.");
            if($("hostAnswersBox")) $("hostAnswersBox").classList.remove("hidden");
            if(typeof listenAnswersForHost === "function") listenAnswersForHost(room, window.__cleanRoundId);
          })
          .catch(e => showError("Ronde klaarzetten mislukt: " + e.message));
      }
    }, 2500);
  };

  window.cleanPlayHidden = async function(){
    if(!currentTrack) return;

    if($("playBtn")) { $("playBtn").disabled = true; $("playBtn").textContent = "🎵 Nummer speelt..."; }

    if(!deviceId){
      await activatePlayer();
      await new Promise(r => setTimeout(r, 1200));
    }

    if(!deviceId){
      alert("Geen Spotify-speler actief. Tik eerst op Activeer Spotify-speler.");
      if($("playBtn")) { $("playBtn").disabled = false; $("playBtn").textContent = "🎵 Speel verborgen nummer"; }
      return;
    }

    const durationMs = getSeconds() * 1000;
    let position = 0;

    if($("randomStart") && $("randomStart").checked && currentTrack.duration_ms > durationMs + 40000){
      const max = Math.max(0, currentTrack.duration_ms - durationMs - 5000);
      position = Math.floor(20000 + Math.random() * Math.max(1, max - 20000));
    }

    try{
      await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{
        method:"PUT",
        body:JSON.stringify({uris:[currentTrack.uri], position_ms:position})
      });

      const room = getRoom();
      const rid = window.__cleanRoundId || hostAnswerRoundId || (typeof v5CurrentRoundId !== "undefined" ? v5CurrentRoundId : "");

      if(db && room && rid){
        const deadline = Date.now() + durationMs;
        const update = {
          status:"answering",
          startedAt: firebase.database.ServerValue.TIMESTAMP,
          deadlineMs: deadline,
          seconds: getSeconds()
        };

        await db.ref("rooms/" + room + "/currentRound").update(update);
        await db.ref("rooms/" + room + "/rounds/" + rid).update(update);

        cleanHostStatus("⏱️ Muziek gestart. Timer loopt nu bij spelers.");

        setTimeout(() => {
          if(typeof lockRound === "function") lockRound(rid);
          cleanHostStatus("🔒 Tijd voorbij. Antwoorden vergrendeld.");
        }, durationMs);
      }

      if($("stopBtn")) $("stopBtn").disabled = false;
      clearTimeout(stopTimer);
      stopTimer = setTimeout(stopPlayback, durationMs);
    }catch(e){
      alert("Afspelen mislukt: " + e.message);
      if($("playBtn")) { $("playBtn").disabled = false; $("playBtn").textContent = "🎵 Speel verborgen nummer"; }
    }
  };

  window.cleanShowAnswer = function(){
    if(!currentTrack) return;

    const answer = {
      track: currentTrack.name || "",
      title: currentTrack.name || "",
      artist: currentTrack.artists || "",
      artists: currentTrack.artists || "",
      album: currentTrack.album || "",
      year: (currentTrack.release_date || "").slice(0,4) || "",
      release_date: currentTrack.release_date || ""
    };

    if($("answerArea")){
      $("answerArea").innerHTML = `<div class="answerCard">
        <h3>${esc(answer.track || "-")}</h3>
        <p><strong>Artiest:</strong> ${esc(answer.artist || "-")}</p>
        <p><strong>Album:</strong> ${esc(answer.album || "-")}</p>
        <p><strong>Jaar:</strong> ${esc(answer.year || "-")}</p>
      </div>`;
    }

    const room = getRoom();
    const rid = window.__cleanRoundId || hostAnswerRoundId || (typeof v5CurrentRoundId !== "undefined" ? v5CurrentRoundId : "");

    if(db && room && rid){
      const payload = {...answer, shownAt: firebase.database.ServerValue.TIMESTAMP};
      const updates = {};
      updates["rooms/" + room + "/currentRound/correctAnswer"] = payload;
      updates["rooms/" + room + "/currentRound/correctAnswerShown"] = true;
      updates["rooms/" + room + "/correctAnswer/" + rid] = payload;
      updates["rooms/" + room + "/rounds/" + rid + "/correctAnswer"] = payload;
      updates["rooms/" + room + "/rounds/" + rid + "/correctAnswerShown"] = true;
      db.ref().update(updates).then(() => cleanHostStatus("✅ Juiste Spotify-antwoord verzonden naar spelers."));
    }
  };

  window.cleanPublishResults = function(){
    const room = getRoom();
    const rid = hostAnswerRoundId || window.__cleanRoundId || (typeof v5CurrentRoundId !== "undefined" ? v5CurrentRoundId : "");
    if(!db || !room || !rid){ alert("Geen ronde gevonden om te publiceren."); return; }
    db.ref("rooms/" + room + "/currentRound/status").set("judged")
      .then(() => db.ref("rooms/" + room + "/rounds/" + rid + "/status").set("judged"))
      .then(() => cleanHostStatus("✅ Resultaten verzonden. Goede spelers mogen 1 vakje kiezen."));
  };

  // Force correct button wiring
  setTimeout(() => {
    const mappings = [
      ["startBtn", cleanStartRound],
      ["playBtn", cleanPlayHidden],
      ["answerBtn", cleanShowAnswer],
      ["publishResultsBtn", cleanPublishResults]
    ];

    mappings.forEach(([id, fn]) => {
      const old = $(id);
      if(old){
        const neu = old.cloneNode(true);
        old.parentNode.replaceChild(neu, old);
        neu.addEventListener("click", fn);
      }
    });
  }, 1200);
})();


/* =========================
   RESET MELDINGEN FIX
   ========================= */

function clearElement(id, text=""){
  const el = document.getElementById(id);
  if(el) el.innerHTML = text;
}

function hideElement(id){
  const el = document.getElementById(id);
  if(el) el.classList.add("hidden");
}

function resetRoundMessages(){
  hideElement("winnerPanel");
  hideElement("hostBingoBox");
  hideElement("correctAnswerBox");
  hideElement("playerAnswersOverviewPanel");

  clearElement("winnerMessage", "🏆");
  clearElement("hostBingoMessage", "Nog geen bingo.");
  clearElement("answerArea", "");
  clearElement("correctAnswerBox", "");
  clearElement("playerAnswersOverview", "Nog geen antwoorden zichtbaar.");
  clearElement("hostAnswersList", "Nog geen antwoorden.");
  clearElement("hostRoundInfo", "");
  clearElement("answerStatus", "");
  clearElement("roundSyncStatus", "Nieuwe ronde gestart.");

  const answerInput = document.getElementById("playerAnswerInput");
  if(answerInput){
    answerInput.value = "";
    answerInput.disabled = true;
  }

  const submitBtn = document.getElementById("submitAnswerBtn");
  if(submitBtn) submitBtn.disabled = true;

  const timerBox = document.getElementById("timerBox");
  if(timerBox) timerBox.textContent = "⏱️ --";

  const playerRoundInfo = document.getElementById("playerRoundInfo");
  if(playerRoundInfo) playerRoundInfo.textContent = "Wachten op ronde...";
}

function resetNewGameMessages(){
  resetRoundMessages();
  localStorage.removeItem("hb_last_bingo_key");
  lastBingoKey = "";

  clearElement("playersList", "Nog geen spelers.");
  clearElement("roundSyncStatus", "Nieuw spel gestart.");
}

// Override startRound so each new round clears old UI first
if(typeof startRound === "function"){
  const originalStartRoundResetFix = startRound;
  startRound = function(){
    resetRoundMessages();
    return originalStartRoundResetFix.apply(this, arguments);
  };
}

// Override createRoom so each new game clears old UI first
if(typeof createRoom === "function"){
  const originalCreateRoomResetFix = createRoom;
  createRoom = function(){
    resetNewGameMessages();
    return originalCreateRoomResetFix.apply(this, arguments);
  };
}

// Rebind buttons to the overridden functions
setTimeout(() => {
  const startOld = document.getElementById("startBtn");
  if(startOld){
    const startNew = startOld.cloneNode(true);
    startOld.parentNode.replaceChild(startNew, startOld);
    startNew.addEventListener("click", startRound);
  }

  const roomOld = document.getElementById("newRoomBtn");
  if(roomOld){
    const roomNew = roomOld.cloneNode(true);
    roomOld.parentNode.replaceChild(roomNew, roomOld);
    roomNew.addEventListener("click", createRoom);
  }
}, 300);


/* =========================
   BINGO GELUID FIX
   iPhone/Safari vereist eerst een klik om audio/spraak te activeren
   ========================= */

let hbAudioCtx = null;
let hbHostSoundReady = false;

function getHbAudioCtx(){
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if(!AudioContext) return null;
  if(!hbAudioCtx) hbAudioCtx = new AudioContext();
  return hbAudioCtx;
}

async function activateHostSound(){
  try{
    const ctx = getHbAudioCtx();
    if(ctx && ctx.state === "suspended") await ctx.resume();

    // Heel kort stil geluidje om audio op iPhone te unlocken
    if(ctx){
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }

    // Speech ook alvast wakker maken
    if("speechSynthesis" in window){
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("Geluid actief.");
      u.lang = "nl-NL";
      u.volume = 0.01;
      window.speechSynthesis.speak(u);
    }

    hbHostSoundReady = true;
    localStorage.setItem("hb_host_sound_ready","1");

    const s = document.getElementById("hostSoundStatus");
    if(s){
      s.textContent = "✅ Host-geluid actief.";
      s.classList.add("soundReady");
    }
  }catch(e){
    alert("Geluid activeren mislukt: " + e.message);
  }
}

function playTuneFixed(){
  try{
    const ctx = getHbAudioCtx();
    if(!ctx) return;

    if(ctx.state === "suspended"){
      ctx.resume();
    }

    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  }catch(e){
    console.log("Tune error", e);
  }
}

function speakWinnerFixed(name){
  try{
    if(!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const text = "Aiiii mi hende. Speler " + name + " heeft bingo!";
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "nl-NL";
    u.rate = 0.86;
    u.pitch = 1.05;
    u.volume = 1;

    // kleine vertraging zodat tune eerst start
    setTimeout(() => {
      window.speechSynthesis.speak(u);
    }, 650);
  }catch(e){
    console.log("Speech error", e);
  }
}

// Override oude functies
playTune = playTuneFixed;
speakWinner = speakWinnerFixed;

// Override showWinner zodat audio geforceerd start op host
const oldShowWinnerSoundFix = showWinner;
showWinner = function(name){
  oldShowWinnerSoundFix(name);

  // extra poging voor host-speaker
  setTimeout(() => playTuneFixed(), 100);
  setTimeout(() => speakWinnerFixed(name), 900);

  const s = document.getElementById("hostSoundStatus");
  if(s && !hbHostSoundReady){
    s.textContent = "⚠️ Geen geluid? Tik eerst op 'Activeer host-geluid'.";
  }
};

// Extra robuuste bingo-listener opnieuw starten
function restartBingoListenerSoundFix(){
  const room = currentRoomCode || localStorage.getItem("hb_host_room") || localStorage.getItem("hb_player_room") || "";
  if(db && room){
    try{ listenBingo(room); }catch(e){}
  }
}

setTimeout(() => {
  const btn = document.getElementById("activateHostSoundBtn");
  if(btn) btn.addEventListener("click", activateHostSound);

  if(localStorage.getItem("hb_host_sound_ready")==="1"){
    const s = document.getElementById("hostSoundStatus");
    if(s){
      s.textContent = "✅ Host-geluid eerder geactiveerd. Tik opnieuw als Safari geen geluid geeft.";
      s.classList.add("soundReady");
    }
  }

  restartBingoListenerSoundFix();
}, 500);


/* =========================
   UITKLAPBARE BINGOKAARTEN OVERZICHT
   ========================= */

function countMarkedCells(marked){
  let count = 1; // middenvak is gratis
  if(marked){
    Object.keys(marked).forEach(k => {
      if(Number(k) !== 12 && marked[k]) count++;
    });
  }
  return count;
}

function renderMiniCard(player){
  const card = player.card || [];
  const marked = player.marked || {};
  const markedCount = countMarkedCells(marked);

  const cells = card.map((c, i) => {
    const isMarked = marked && marked[i];
    return `<div class="miniBingoCell ${isMarked || i === 12 ? "marked" : ""}">
      ${isMarked ? "✅" : emoji(c)}
    </div>`;
  }).join("");

  return `<div class="miniPlayerCard">
    <div class="miniPlayerName">
      <span>${esc(player.name || "Speler")}</span>
      <span class="miniProgress">${markedCount}/25</span>
    </div>
    <div class="miniBingoGrid">${cells}</div>
  </div>`;
}

function renderCardsOverview(room){
  const players = room.players || {};
  const cardsHtml = Object.values(players).map(renderMiniCard).join("") || "Nog geen spelers.";

  if(document.getElementById("hostCardsOverview")){
    document.getElementById("hostCardsOverview").innerHTML = cardsHtml;
  }

  if(document.getElementById("playerCardsOverview")){
    document.getElementById("playerCardsOverviewPanel")?.classList.remove("hidden");
    document.getElementById("playerCardsOverview").innerHTML = cardsHtml;
  }
}

// Host kaarten live volgen
function listenCardsForHost(roomCode){
  if(!db || !roomCode) return;
  db.ref("rooms/" + roomCode).on("value", snap => {
    renderCardsOverview(snap.val() || {});
  });
}

// Koppel aan bestaande listeners
const originalListenPlayersCards = listenPlayers;
listenPlayers = function(code){
  originalListenPlayersCards(code);
  listenCardsForHost(code);
};

// Speler krijgt kaarten ook via bestaande listenPlayer room snapshot.
// Override listenPlayer minimaal om cards overview te renderen.
const originalListenPlayerCards = listenPlayer;
listenPlayer = function(){
  db.ref("rooms/" + currentRoomCode).on("value", snap => {
    renderCardsOverview(snap.val() || {});
  });
  originalListenPlayerCards();
};

// Als er al een host room actief is bij laden
setTimeout(() => {
  const room = currentRoomCode || localStorage.getItem("hb_host_room") || localStorage.getItem("hb_player_room") || "";
  if(db && room){
    listenCardsForHost(room);
  }
}, 1000);


/* =========================
   SCOREBOARD NAAM KLIK -> BINGOKAART
   ========================= */

let openedScoreCards = {};

function toggleScoreCard(playerId){
  openedScoreCards[playerId] = !openedScoreCards[playerId];

  const room = currentRoomCode || localStorage.getItem("hb_host_room") || localStorage.getItem("hb_player_room") || "";
  if(db && room){
    db.ref("rooms/" + room).once("value").then(snap => {
      const data = snap.val() || {};
      if(document.getElementById("hostAnswersList")) renderHostScoreboardWithCards(data);
      if(document.getElementById("playerAnswersOverview")) renderPlayerScoreboardWithCards(data);
    });
  }
}

function miniCardInline(player){
  const card = player.card || [];
  const marked = player.marked || {};
  const cells = card.map((c, i) => {
    const isMarked = marked && marked[i];
    return `<div class="miniBingoCell ${isMarked || i === 12 ? "marked" : ""}">
      ${isMarked ? "✅" : emoji(c)}
    </div>`;
  }).join("");

  return `<div class="inlineMiniCard">
    <div class="miniBingoGrid">${cells}</div>
  </div>`;
}

function renderHostScoreboardWithCards(room){
  const round = room.currentRound || {};
  const rid = round.id || hostAnswerRoundId;
  if(!rid || !document.getElementById("hostAnswersList")) return;

  const players = room.players || {};
  const answers = room.answers && room.answers[rid] ? room.answers[rid] : {};
  const correct = room.correct && room.correct[rid] ? room.correct[rid] : {};

  document.getElementById("hostAnswersList").innerHTML = Object.entries(players).map(([pid,p]) => {
    const ans = answers[pid] ? answers[pid].answer : "Geen antwoord";
    const st = correct[pid];
    const cls = st === true ? "scoreGood" : st === false ? "scoreBad" : "scorePending";
    const opened = openedScoreCards[pid];

    return `<div class="scoreCard ${cls}">
      <div class="scoreName clickableName" onclick="toggleScoreCard('${pid}')">
        ${opened ? "▼" : "▶"} ${esc(p.name || "Speler")}
      </div>
      <div class="scoreAnswer">${esc(ans || "Geen antwoord")}</div>
      <div>
        <button class="goodBtn ${st===true?"goodSelected":""}" onclick="event.stopPropagation(); markAnswer('${pid}', true)">✅</button>
        <button class="badBtn ${st===false?"badSelected":""}" onclick="event.stopPropagation(); markAnswer('${pid}', false)">❌</button>
      </div>
      ${opened ? miniCardInline(p) : ""}
    </div>`;
  }).join("") || "Nog geen spelers.";
}

function renderPlayerScoreboardWithCards(room){
  const round = room.currentRound || {};
  if(!round.id || !document.getElementById("playerAnswersOverview")) return;

  if(typeof playerMaySeeAnswers === "function" && !playerMaySeeAnswers(room, round)){
    document.getElementById("playerAnswersOverviewPanel")?.classList.add("hidden");
    return;
  }

  if(typeof maySee === "function" && !maySee(room)){
    document.getElementById("playerAnswersOverviewPanel")?.classList.add("hidden");
    return;
  }

  document.getElementById("playerAnswersOverviewPanel")?.classList.remove("hidden");

  const players = room.players || {};
  const answers = room.answers && room.answers[round.id] ? room.answers[round.id] : {};
  const correct = room.correct && room.correct[round.id] ? room.correct[round.id] : {};

  document.getElementById("playerAnswersOverview").innerHTML = Object.entries(players).map(([pid,p]) => {
    const ans = answers[pid] && answers[pid].answer ? answers[pid].answer : "Geen antwoord";
    const st = round.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "scoreGood" : st === false ? "scoreBad" : "scorePending";
    const icon = st === true ? "✅" : st === false ? "❌" : "⏳";
    const opened = openedScoreCards[pid];

    return `<div class="scoreCard ${cls}">
      <div class="scoreName clickableName" onclick="toggleScoreCard('${pid}')">
        ${opened ? "▼" : "▶"} ${esc(p.name || "Speler")}${pid === currentPlayerId ? " (jij)" : ""}
      </div>
      <div class="scoreAnswer">${esc(ans)}</div>
      <div class="scoreStatus">${icon}</div>
      ${opened ? miniCardInline(p) : ""}
    </div>`;
  }).join("") || "Nog geen spelers.";
}

// Override host-listener voor scorebord
if(typeof listenAnswers === "function"){
  const originalListenAnswersClickableCards = listenAnswers;
  listenAnswers = function(room, rid){
    hostAnswerRoundId = rid;
    db.ref("rooms/" + room).on("value", snap => {
      const data = snap.val() || {};
      const round = data.currentRound || {};
      if(document.getElementById("hostRoundInfo")){
        document.getElementById("hostRoundInfo").textContent =
          `${round.colorEmoji || ""} ${round.colorName || ""} — ${round.category || ""} — status: ${round.status || ""}`;
      }
      renderHostScoreboardWithCards(data);
    });
  };
}

// Override speler-scorebord
if(typeof renderScoreboard === "function"){
  renderScoreboard = function(room){
    renderPlayerScoreboardWithCards(room);
  };
}

// Maak toggle beschikbaar voor inline onclick
window.toggleScoreCard = toggleScoreCard;


/* =========================
   SPELER POPUP FLOW
   ========================= */

let popupLastRoundId = "";
let popupScoreShownForRound = "";
let popupPickShownForRound = "";

function showModal(id){
  const el = document.getElementById(id);
  if(el){
    el.classList.remove("hidden");
    document.body.classList.add("modalOpen");
  }
}

function hideModal(id){
  const el = document.getElementById(id);
  if(el) el.classList.add("hidden");

  const anyOpen = [...document.querySelectorAll(".modalOverlay")].some(m => !m.classList.contains("hidden"));
  if(!anyOpen) document.body.classList.remove("modalOpen");
}

function syncAnswerModal(round){
  if(!round || !round.id) return;

  const info = document.getElementById("modalRoundInfo");
  if(info) info.textContent = `${round.colorEmoji || ""} ${round.colorName || ""} — ${round.category || ""}`;

  const source = document.getElementById("playerAnswerInput");
  const modalInput = document.getElementById("modalAnswerInput");
  if(source && modalInput && document.activeElement !== modalInput){
    modalInput.value = source.value || "";
  }
}

function openAnswerPopup(round){
  if(!round || !round.id || round.status !== "answering") return;
  if(popupLastRoundId !== round.id){
    popupLastRoundId = round.id;
    popupScoreShownForRound = "";
    popupPickShownForRound = "";
    const mi = document.getElementById("modalAnswerInput");
    if(mi) mi.value = "";
  }
  syncAnswerModal(round);
  showModal("playerAnswerModal");
}

function closeAnswerPopup(){
  hideModal("playerAnswerModal");
}

function openScoreboardPopup(room){
  const round = room.currentRound || {};
  if(!round.id) return;
  if(popupScoreShownForRound === round.id) return;

  popupScoreShownForRound = round.id;
  renderScoreboardModal(room);
  showModal("playerScoreboardModal");
}

function renderScoreboardModal(room){
  const round = room.currentRound || {};
  const box = document.getElementById("modalPlayerAnswersOverview");
  if(!box || !round.id) return;

  const players = room.players || {};
  const answers = room.answers && room.answers[round.id] ? room.answers[round.id] : {};
  const correct = room.correct && room.correct[round.id] ? room.correct[round.id] : {};

  box.innerHTML = Object.entries(players).map(([pid,p]) => {
    const ans = answers[pid] && answers[pid].answer ? answers[pid].answer : "Geen antwoord";
    const st = round.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "scoreGood" : st === false ? "scoreBad" : "scorePending";
    const icon = st === true ? "✅" : st === false ? "❌" : "⏳";
    const opened = openedScoreCards && openedScoreCards[pid];

    return `<div class="scoreCard ${cls}">
      <div class="scoreName clickableName" onclick="toggleScoreCard('${pid}')">
        ${opened ? "▼" : "▶"} ${esc(p.name || "Speler")}${pid === currentPlayerId ? " (jij)" : ""}
      </div>
      <div class="scoreAnswer">${esc(ans)}</div>
      <div class="scoreStatus">${icon}</div>
      ${opened ? miniCardInline(p) : ""}
    </div>`;
  }).join("") || "Nog geen spelers.";

  renderCorrectAnswerModal(room);
}

function renderCorrectAnswerModal(room){
  const round = room.currentRound || {};
  const ans = round.correctAnswer;
  const box = document.getElementById("modalCorrectAnswerBox");
  if(!box) return;

  if(!ans){
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `<h3>✅ Juiste Spotify-antwoord</h3>
    <p>🎵 <strong>Track:</strong> ${esc(ans.track || "-")}</p>
    <p>👤 <strong>Artiest:</strong> ${esc(ans.artist || "-")}</p>
    <p>📅 <strong>Jaar:</strong> ${esc(ans.year || "-")}</p>
    <p>💿 <strong>Album:</strong> ${esc(ans.album || "-")}</p>`;
}

function openPickCardPopup(room){
  const round = room.currentRound || {};
  const player = room.players && room.players[currentPlayerId] ? room.players[currentPlayerId] : {};
  const good = room.correct && room.correct[round.id] ? room.correct[round.id][currentPlayerId] : undefined;
  const alreadyPicked = player.lastPickedRound === round.id;

  if(!round.id || round.status !== "judged" || good !== true || alreadyPicked) return;
  if(popupPickShownForRound === round.id) return;

  popupPickShownForRound = round.id;
  const info = document.getElementById("modalPickInfo");
  if(info) info.textContent = `Kies 1 ${round.colorEmoji} ${round.colorName} vakje.`;

  renderModalBingoCard(player.card || [], player.marked || {}, round);
  showModal("playerPickCardModal");
}

function renderModalBingoCard(card, marked, round){
  const target = document.getElementById("modalBingoCard");
  if(!target) return;

  target.innerHTML = card.map((c,i) => {
    const m = marked && marked[i];
    const pickable = c === round.colorKey && c !== "free" && !m;
    const blocked = !pickable && c !== "free" && !m;

    return `<div class="bingoCell ${c==="free"?"free":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-index="${i}">
      ${m ? "✅" : emoji(c)}
    </div>`;
  }).join("");

  target.querySelectorAll(".pickableCell").forEach(el => {
    el.addEventListener("click", () => {
      markCell(Number(el.dataset.index));
      hideModal("playerPickCardModal");
    });
  });
}

// Modal submit gebruikt bestaande submitAnswer flow
function submitAnswerFromModal(){
  const mi = document.getElementById("modalAnswerInput");
  const pi = document.getElementById("playerAnswerInput");
  if(mi && pi) pi.value = mi.value;
  submitAnswer();

  const status = document.getElementById("modalAnswerStatus");
  if(status) status.textContent = "🔒 Antwoord ingeleverd.";

  setTimeout(() => {
    hideModal("playerAnswerModal");
    const room = currentRoomCode || localStorage.getItem("hb_player_room") || "";
    if(db && room){
      db.ref("rooms/" + room).once("value").then(s => {
        openScoreboardPopup(s.val() || {});
      });
    }
  }, 500);
}

// Verbind knoppen
setTimeout(() => {
  const submit = document.getElementById("modalSubmitAnswerBtn");
  if(submit) submit.addEventListener("click", submitAnswerFromModal);

  const close = document.getElementById("closeScoreboardModalBtn");
  if(close) close.addEventListener("click", () => hideModal("playerScoreboardModal"));
}, 500);

// Override renderPlayerRound: antwoord-popup opent bij muziekstart
const originalRenderPlayerRoundPopup = renderPlayerRound;
renderPlayerRound = function(room, round){
  originalRenderPlayerRoundPopup(room, round);

  if(round && round.status === "answering"){
    const existing = room.answers && room.answers[round.id] ? room.answers[round.id][currentPlayerId] : null;
    if(!existing) openAnswerPopup(round);
  }

  if(round && (round.status === "locked" || round.status === "judged")){
    closeAnswerPopup();
    if(maySee(room)) openScoreboardPopup(room);
  }
};

// Override renderScoreboard zodat modal live meeververst als open
const originalRenderScoreboardPopup = renderScoreboard;
renderScoreboard = function(room){
  originalRenderScoreboardPopup(room);
  if(!document.getElementById("playerScoreboardModal")?.classList.contains("hidden")){
    renderScoreboardModal(room);
  }
};

// Override renderCorrect zodat modal ook het juiste antwoord krijgt
const originalRenderCorrectPopup = renderCorrect;
renderCorrect = function(room){
  originalRenderCorrectPopup(room);
  renderCorrectAnswerModal(room);
};

// Override result status: bij goed antwoord kaart-popup openen
const originalRenderResultStatusPopup = renderResultStatus;
renderResultStatus = function(room){
  originalRenderResultStatusPopup(room);
  openPickCardPopup(room);
};

// Toggle scorecard moet ook modal verversen
const originalToggleScoreCardPopup = toggleScoreCard;
toggleScoreCard = function(playerId){
  openedScoreCards[playerId] = !openedScoreCards[playerId];
  const room = currentRoomCode || localStorage.getItem("hb_host_room") || localStorage.getItem("hb_player_room") || "";
  if(db && room){
    db.ref("rooms/" + room).once("value").then(snap => {
      const data = snap.val() || {};
      if(document.getElementById("hostAnswersList")) renderHostScoreboardWithCards(data);
      if(document.getElementById("playerAnswersOverview")) renderPlayerScoreboardWithCards(data);
      renderScoreboardModal(data);
    });
  }
};
window.toggleScoreCard = toggleScoreCard;


/* =========================
   WACHT OP VAKJES FIX
   Host kan pas volgende ronde starten als goede spelers hun vakje kozen
   ========================= */

function getPendingPickPlayers(room){
  const round = room.currentRound || {};
  if(!round.id || round.status !== "judged") return [];

  const players = room.players || {};
  const correct = room.correct && room.correct[round.id] ? room.correct[round.id] : {};

  return Object.entries(players)
    .filter(([pid,p]) => correct[pid] === true && p.lastPickedRound !== round.id)
    .map(([pid,p]) => ({id:pid, name:p.name || "Speler"}));
}

function updateHostNextRoundLock(room){
  const startBtn = document.getElementById("startBtn");
  if(!startBtn) return;

  const pending = getPendingPickPlayers(room);

  if(pending.length){
    startBtn.disabled = true;
    startBtn.textContent = "⏳ Wachten op vakjes";
    const names = pending.map(p => p.name).join(", ");
    if(document.getElementById("roundSyncStatus")){
      document.getElementById("roundSyncStatus").textContent =
        "Wachten tot deze spelers hun bingovakje kiezen: " + names;
    }
  }else{
    // Alleen terugzetten als hij door deze lock geblokkeerd was
    if(startBtn.textContent.includes("Wachten op vakjes")){
      startBtn.disabled = false;
      startBtn.textContent = "🎲 START RONDE";
      if(document.getElementById("roundSyncStatus")){
        document.getElementById("roundSyncStatus").textContent =
          "Iedereen is klaar. Je kunt de volgende ronde starten.";
      }
    }
  }
}

// Override publishResults zodat direct pending players zichtbaar worden
if(typeof publishResults === "function"){
  const originalPublishResultsWaitFix = publishResults;
  publishResults = function(){
    const result = originalPublishResultsWaitFix.apply(this, arguments);
    setTimeout(() => {
      const room = currentRoomCode || localStorage.getItem("hb_host_room") || "";
      if(db && room){
        db.ref("rooms/" + room).once("value").then(s => updateHostNextRoundLock(s.val() || {}));
      }
    }, 600);
    return result;
  };
}

// Override startRound: als er nog pending spelers zijn, niet starten
if(typeof startRound === "function"){
  const originalStartRoundWaitFix = startRound;
  startRound = function(){
    const room = currentRoomCode || localStorage.getItem("hb_host_room") || "";
    if(db && room){
      db.ref("rooms/" + room).once("value").then(s => {
        const data = s.val() || {};
        const pending = getPendingPickPlayers(data);
        if(pending.length){
          alert("Wacht nog even. Deze spelers moeten nog een bingovakje kiezen: " + pending.map(p=>p.name).join(", "));
          updateHostNextRoundLock(data);
          return;
        }
        originalStartRoundWaitFix.apply(this, arguments);
      });
      return;
    }
    return originalStartRoundWaitFix.apply(this, arguments);
  };
}

// Host room live volgen voor lock
function listenHostPendingPickLock(){
  const room = currentRoomCode || localStorage.getItem("hb_host_room") || "";
  if(!db || !room) return;
  db.ref("rooms/" + room).on("value", snap => {
    updateHostNextRoundLock(snap.val() || {});
  });
}

// Rebind start en publish buttons naar overrides
setTimeout(() => {
  const startOld = document.getElementById("startBtn");
  if(startOld){
    const startNew = startOld.cloneNode(true);
    startOld.parentNode.replaceChild(startNew, startOld);
    startNew.addEventListener("click", startRound);
  }

  const pubOld = document.getElementById("publishResultsBtn");
  if(pubOld){
    const pubNew = pubOld.cloneNode(true);
    pubOld.parentNode.replaceChild(pubNew, pubOld);
    pubNew.addEventListener("click", publishResults);
  }

  listenHostPendingPickLock();
}, 800);
