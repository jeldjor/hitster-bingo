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
