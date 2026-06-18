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
function startRound(){currentTrack=chooseTrack();$("answerArea").innerHTML="";$("playBtn").disabled=true;$("answerBtn").disabled=true;if(!currentTrack){alert("Upload eerst je CSV.");return}const area=$("pickerArea"),mode=Math.random()<.5?"discobal":"rad";area.innerHTML=mode==="discobal"?`<div class="discoWrap"><div class="pickerTitle">🎉 Discobal kiest...</div><div class="disco"></div></div>`:`<div><div class="pickerTitle">🎡 Draairad draait...</div><div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div></div>`;setTimeout(()=>{flash();if($("bonusOn").checked&&Math.random()<.05)area.innerHTML=`<div class="reveal"><div class="colorName">⭐ BONUSRONDE</div><div class="category">${pick(["Vrije kleur kiezen","2 vakjes afstrepen","Extra beurt","Raad binnen 5 seconden"])}</div></div>`;else{const s=pick(colors),cat=$(s.input).value.trim()||"Geen categorie ingevuld";area.innerHTML=`<div class="reveal"><div class="colorDot" style="background:${s.hex};color:${s.hex}"></div><div class="colorName">${s.emoji} ${s.name}</div><div class="category">Categorie:<br><strong>${cat}</strong></div></div>`}$("playBtn").disabled=false;$("answerBtn").disabled=false;$("playBtn").textContent="🎵 Speel verborgen nummer"},2500)}
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
