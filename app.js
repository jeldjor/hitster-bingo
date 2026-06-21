const CLIENT_ID="4765b89201b44558a7d5141f9b93c178";
const REDIRECT_URI=location.origin+location.pathname;
const SCOPES=["streaming","user-read-email","user-read-private","user-read-playback-state","user-modify-playback-state"].join(" ");
const firebaseConfig={apiKey:"AIzaSyCcquz1mpz3FsmFFBKgJLgpbkHCajTUpzY",authDomain:"hitster-bingo-cb792.firebaseapp.com",databaseURL:"https://hitster-bingo-cb792-default-rtdb.europe-west1.firebasedatabase.app",projectId:"hitster-bingo-cb792",storageBucket:"hitster-bingo-cb792.firebasestorage.app",messagingSenderId:"98696776977",appId:"1:98696776977:web:e797e555e2d9b38bcc99b0"};
const COLORS=[{key:"yellow",name:"GOUD",emoji:"🟡",input:"cat-yellow",hex:"#FFCC33"},{key:"pink",name:"AQUA",emoji:"🩵",input:"cat-pink",hex:"#00D4C7"},{key:"purple",name:"ORANJE",emoji:"🟠",input:"cat-purple",hex:"#FF8A1F"},{key:"blue",name:"LIME",emoji:"🟢",input:"cat-blue",hex:"#7ED957"},{key:"green",name:"KORAAL",emoji:"🔴",input:"cat-green",hex:"#FF5A5F"}];
let db, player, deviceId="", accessToken=localStorage.spotify_access_token||"", refreshToken=localStorage.spotify_refresh_token||"", expiresAt=Number(localStorage.spotify_expires_at||0);
let tracks=JSON.parse(localStorage.hb_csv_tracks||"[]"), currentTrack=null, currentRoomCode="", currentRoundId="", currentPlayerId=localStorage.hb_player_id||"", currentPlayerName=localStorage.hb_player_name||"", activeRound=null;
let stopTimer=null, lockTimer=null, screenTimer=null, audioCtx=null, lastBingoKey=localStorage.hb_last_bingo_key||"";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const emoji=k=>({yellow:"🟡",pink:"🩵",purple:"🟠",blue:"🟢",green:"🔴",free:bbMonkey()}[k]||"⬜");

function init(){if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);db=firebase.database();wire();handleRedirect().then(updateStatus);setupPlayerMode();restoreHost();setTimeout(()=>{try{hbBootV7B()}catch(e){console.error(e)}},300);}
function wire(){
 $("loginBtn")?.addEventListener("click",login);$("logoutBtn")?.addEventListener("click",logout);$("activateBtn")?.addEventListener("click",activatePlayer);$("csvFile")?.addEventListener("change",handleCsv);$("resetUsedBtn")?.addEventListener("click",()=>{delete localStorage.hb_used;updateStatus()});
 $("newRoomBtn")?.addEventListener("click",createRoom);$("soundBtn")?.addEventListener("click",activateSound);$("startRoundBtn")?.addEventListener("click",startRound);$("playBtn")?.addEventListener("click",playHidden);$("stopBtn")?.addEventListener("click",stopPlayback);$("showAnswerBtn")?.addEventListener("click",showAnswer);$("lockBtn")?.addEventListener("click",lockRound);$("publishBtn")?.addEventListener("click",publishResults);
 $("joinBtn")?.addEventListener("click",joinPlayer);$("readyBtn")?.addEventListener("click",setReady);$("scoreReadyBtn")?.addEventListener("click",setReady);$("submitAnswerBtn")?.addEventListener("click",submitAnswer);
 $("hostScoreboard")?.addEventListener("click",scoreboardClick);
}

// CSV
function parseCSV(t){let rows=[],r=[],c="",q=false;for(let i=0;i<t.length;i++){let ch=t[i],n=t[i+1];if(ch=='"'&&q&&n=='"'){c+='"';i++}else if(ch=='"')q=!q;else if(ch==","&&!q){r.push(c);c=""}else if((ch=="\n"||ch=="\r")&&!q){if(ch=="\r"&&n=="\n")i++;r.push(c);c="";if(r.some(v=>v.trim()))rows.push(r);r=[]}else c+=ch}r.push(c);if(r.some(v=>v.trim()))rows.push(r);return rows}
function norm(h){return h.toLowerCase().replace(/[^a-z0-9]/g,"")}function findI(h,n){let ns=h.map(norm);for(let x of n){let i=ns.indexOf(norm(x));if(i>=0)return i}return -1}
function tid(u){let m=String(u||"").match(/spotify:track:([a-zA-Z0-9]+)/)||String(u||"").match(/track\/([a-zA-Z0-9]+)/);return m?m[1]:(/^[a-zA-Z0-9]{15,}$/.test(String(u).trim())?String(u).trim():"")}
function handleCsv(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{loadCsv(r.result)}catch(err){alert(err.message)}};r.readAsText(f)}
function loadCsv(text){let rows=parseCSV(text),h=rows[0]||[],ui=findI(h,["Track URI","Spotify URI","URI"]),ti=findI(h,["Track Name","Name","Title"]),ai=findI(h,["Artist Name(s)","Artist Names","Artists","Artist"]),al=findI(h,["Album Name","Album"]),ri=findI(h,["Release Date","Release"]),di=findI(h,["Duration (ms)","Duration"]);if(ui<0||ti<0||ai<0)throw Error("CSV mist Track URI, Track Name of Artist Name(s).");let out=[],seen=new Set();for(let i=1;i<rows.length;i++){let row=rows[i],id=tid(row[ui]);if(!id||seen.has(id))continue;seen.add(id);out.push({id,uri:"spotify:track:"+id,name:row[ti]||"Onbekend",artists:row[ai]||"Onbekend",album:al>=0?row[al]||"":"",release_date:ri>=0?row[ri]||"":"",duration_ms:Number(row[di])||180000})}tracks=out;localStorage.hb_csv_tracks=JSON.stringify(tracks);updateStatus()}
function chooseTrack(){if(!tracks.length)return null;let u=new Set(JSON.parse(localStorage.hb_used||"[]")),a=$("noRepeat").checked?tracks.filter(t=>!u.has(t.id)):tracks;if(!a.length){u.clear();a=tracks}let t=pick(a);u.add(t.id);localStorage.hb_used=JSON.stringify([...u]);updateStatus();return t}

// Spotify
function rand(l){let ch="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~",o="";crypto.getRandomValues(new Uint8Array(l)).forEach(x=>o+=ch[x%ch.length]);return o}
async function sha(s){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))}function b64(b){return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
async function login(){let v=rand(96);localStorage.spotify_code_verifier=v;location="https://accounts.spotify.com/authorize?"+new URLSearchParams({response_type:"code",client_id:CLIENT_ID,scope:SCOPES,code_challenge_method:"S256",code_challenge:b64(await sha(v)),redirect_uri:REDIRECT_URI})}
async function handleRedirect(){let code=new URLSearchParams(location.search).get("code");if(!code)return;let v=localStorage.spotify_code_verifier;let res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI,code_verifier:v})});let d=await res.json();if(d.access_token){saveTokens(d);history.replaceState({},document.title,REDIRECT_URI)}else alert("Spotify login fout")}
function saveTokens(d){accessToken=d.access_token;if(d.refresh_token)refreshToken=d.refresh_token;expiresAt=Date.now()+d.expires_in*1000-60000;localStorage.spotify_access_token=accessToken;if(refreshToken)localStorage.spotify_refresh_token=refreshToken;localStorage.spotify_expires_at=expiresAt}
async function getToken(){if(accessToken&&Date.now()<expiresAt)return accessToken;if(!refreshToken)return"";let res=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken,client_id:CLIENT_ID})});let d=await res.json();if(d.access_token){saveTokens(d);return accessToken}return""}
async function api(url,opt={}){let t=await getToken();if(!t)throw Error("Niet ingelogd.");let r=await fetch(url,{...opt,headers:{...(opt.headers||{}),Authorization:"Bearer "+t,"Content-Type":"application/json"}});if(r.status===204)return{};let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error?.message||"Spotify fout");return d}
function logout(){["spotify_access_token","spotify_refresh_token","spotify_expires_at"].forEach(k=>localStorage.removeItem(k));accessToken=refreshToken="";expiresAt=0;updateStatus()}
async function updateStatus(){if($("csvStatus"))$("csvStatus").textContent=tracks.length?`${tracks.length} nummers geladen.`:"Nog geen CSV geladen.";if(!$("loginStatus"))return;if(await getToken()){try{let me=await api("https://api.spotify.com/v1/me");$("loginStatus").textContent="Ingelogd als: "+(me.display_name||me.email||"Spotify gebruiker");$("activateBtn").disabled=false}catch(e){$("loginStatus").textContent="Ingelogd."}}else{$("loginStatus").textContent="Nog niet ingelogd."; $("activateBtn").disabled=true}}
window.onSpotifyWebPlaybackSDKReady=()=>{};
async function activatePlayer(){let t=await getToken();if(!t){alert("Login eerst.");return}if(!window.Spotify){alert("Spotify speler nog niet geladen.");return}if(player){await player.connect();return}player=new Spotify.Player({name:"Bingo Beats",getOAuthToken:async cb=>cb(await getToken()),volume:.8});player.addListener("ready",({device_id})=>{deviceId=device_id;$("loginStatus").textContent+=" — speler actief."});await player.connect()}

// Room/player
function getCats(){return{yellow:$("cat-yellow").value,pink:$("cat-pink").value,purple:$("cat-purple").value,blue:$("cat-blue").value,green:$("cat-green").value}}
function roomCode(){let c="",ch="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";for(let i=0;i<4;i++)c+=ch[Math.floor(Math.random()*ch.length)];return c}
function genCard(){let p=[],cs=["yellow","pink","purple","blue","green"];for(let i=0;i<24;i++)p.push(cs[i%5]);for(let i=p.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[p[i],p[j]]=[p[j],p[i]]}let card=[],k=0;for(let i=0;i<25;i++)card.push(i===12?"free":p[k++]);return card}
function createRoom(){currentRoomCode=roomCode();db.ref("rooms/"+currentRoomCode).set({createdAt:firebase.database.ServerValue.TIMESTAMP,categories:getCats()}).then(()=>{localStorage.hb_host_room=currentRoomCode;showRoom();listenHost(currentRoomCode);listenBingo(currentRoomCode)})}
function showRoom(){$("roomBox").classList.remove("hidden");$("roomCodeText").textContent=currentRoomCode;$("joinLink").value=location.origin+location.pathname+"?room="+currentRoomCode}
function restoreHost(){let room=localStorage.hb_host_room;if(room&&!new URLSearchParams(location.search).get("room")){currentRoomCode=room;showRoom();listenHost(room);listenBingo(room)}}
function setupPlayerMode(){let room=new URLSearchParams(location.search).get("room");if(!room)return;document.body.classList.add("playerMode");$("modeText").textContent="Speler";$("playerApp").classList.remove("hidden");currentRoomCode=room.toUpperCase();$("playerRoomCode").textContent=currentRoomCode;if(currentPlayerName)$("playerNameInput").value=currentPlayerName}
function joinPlayer(){let name=$("playerNameInput").value.trim();if(!name){alert("Vul je naam in.");return}currentPlayerName=name;if(!currentPlayerId)currentPlayerId="p_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);localStorage.hb_player_id=currentPlayerId;localStorage.hb_player_name=name;localStorage.hb_player_room=currentRoomCode;let ref=db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId);ref.once("value").then(s=>{let ex=s.val()||{};return ref.update({name,online:true,ready:false,joinedAt:ex.joinedAt||firebase.database.ServerValue.TIMESTAMP,lastSeen:firebase.database.ServerValue.TIMESTAMP,card:ex.card||genCard(),marked:ex.marked||{}})}).then(()=>{ref.child("online").onDisconnect().set(false);listenPlayer();showScreen("screenLobby")})}
function setReady(){if(!currentPlayerId)return;db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId+"/ready").set(true)}
function showScreen(id){document.querySelectorAll("#playerApp .screen").forEach(s=>s.classList.add("hidden"));$(id)?.classList.remove("hidden")}

// Host listen
function listenHost(room){db.ref("rooms/"+room).on("value",s=>{let data=s.val()||{};renderHostPlayers(data);renderHostScore(data);hostReadyState(data)})}
function renderHostPlayers(room){let ps=room.players||{};$("hostPlayers").innerHTML=Object.values(ps).length?Object.values(ps).map(p=>`<div class="playerRow ${p.ready?"ready":""}"><strong>${esc(p.name)}</strong><span>${p.ready?"🐵 READY":"⏳ wacht"}</span></div>`).join(""):"Nog geen spelers."}
function allReady(room){let ps=Object.values(room.players||{});return ps.length>0&&ps.every(p=>p.ready)}
function hostReadyState(room){let r=room.currentRound||{},btn=$("startRoundBtn");if(["picking","ready","answering","locked"].includes(r.status))return;if(allReady(room)){btn.disabled=false;btn.textContent="🎲 START RONDE";$("hostStatus").textContent="Iedereen is READY."}else{btn.disabled=true;btn.textContent="⏳ Wachten op READY";let not=Object.values(room.players||{}).filter(p=>!p.ready).map(p=>p.name).join(", ");$("hostStatus").textContent=not?"Nog niet ready: "+not:"Wachten op spelers."}}

// Round host
function flash(){let f=document.createElement("div");f.className="flash";document.body.appendChild(f);setTimeout(()=>f.remove(),700)}
function pickerHTML(mode){return mode==="wheel"?`<div class="bbOldPickerRemoved"><div class="pointer"></div><div class="bbOldPickerRemoved"></div></div><div class="pickerTitle">Kleurenmixer start...</div>`:`<div class="bbOldPickerRemoved">🪩</div><div class="pickerTitle">Kleurenmixer start...</div>`}
function startRound(){let room=currentRoomCode;if(!room){alert("Maak eerst kamer.");return}db.ref("rooms/"+room).once("value").then(s=>{let data=s.val()||{};if(!allReady(data)){alert("Nog niet iedereen is READY.");return}currentTrack=chooseTrack();if(!currentTrack){alert("Upload eerst CSV.");return}let up={};Object.keys(data.players||{}).forEach(pid=>up["rooms/"+room+"/players/"+pid+"/ready"]=false);db.ref().update(up).then(()=>startRoundVisual(room))})}
function startRoundVisual(room){
  $("hostAnswerArea").innerHTML="";
  $("playBtn").disabled=true;
  $("showAnswerBtn").disabled=true;
  const mode=Math.random()<.5?"disco":"wheel";
  $("hostPickerArea").innerHTML=pickerHTML(mode);
  currentRoundId="r_"+Date.now();

  db.ref("rooms/"+room+"/currentRound").set({
    id:currentRoundId,
    status:"picking",
    pickerMode:mode,
    seconds:Number($("duration").value)||20,
    createdAt:firebase.database.ServerValue.TIMESTAMP
  });

  setTimeout(()=>{
    flash();
    let color=pick(COLORS),cat=$(color.input).value||"Geen categorie";
    $("hostPickerArea").innerHTML=`<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;
    let round={id:currentRoundId,status:"ready",pickerMode:mode,colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,seconds:Number($("duration").value)||20};
    db.ref("rooms/"+room+"/currentRound").set(round);
    $("playBtn").disabled=false;
    $("showAnswerBtn").disabled=false;
    $("hostScorePanel").classList.remove("hidden");
  },2600);
}
async function playHidden(){if(!currentTrack)return;$("playBtn").disabled=true;if(!deviceId){await activatePlayer();await new Promise(r=>setTimeout(r,1200))}if(!deviceId){alert("Geen Spotify-speler actief.");$("playBtn").disabled=false;return}let dur=(Number($("duration").value)||20)*1000,pos=0;if($("randomStart").checked&&currentTrack.duration_ms>dur+40000){let max=Math.max(0,currentTrack.duration_ms-dur-5000);pos=Math.floor(20000+Math.random()*Math.max(1,max-20000))}await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{method:"PUT",body:JSON.stringify({uris:[currentTrack.uri],position_ms:pos})});let deadline=Date.now()+dur;await db.ref("rooms/"+currentRoomCode+"/currentRound").update({status:"answering",deadlineMs:deadline});$("stopBtn").disabled=false;clearTimeout(lockTimer);lockTimer=setTimeout(lockRound,dur);clearTimeout(stopTimer);stopTimer=setTimeout(stopPlayback,dur)}
async function stopPlayback(){try{await api("https://api.spotify.com/v1/me/player/pause",{method:"PUT",body:"{}"})}catch(e){}$("stopBtn").disabled=true}
function lockRound(){db.ref("rooms/"+currentRoomCode+"/currentRound/status").set("locked")}
function showAnswer(){if(!currentTrack)return;let ans={track:currentTrack.name,artist:currentTrack.artists,album:currentTrack.album,year:(currentTrack.release_date||"").slice(0,4)};$("hostAnswerArea").innerHTML=`<div class="correctBox"><h3>${esc(ans.track)}</h3><p>${esc(ans.artist)}</p><p>${esc(ans.album||"-")} — ${esc(ans.year||"-")}</p></div>`;db.ref("rooms/"+currentRoomCode+"/currentRound").update({correctAnswer:ans})}
function renderHostScore(room){let r=room.currentRound||{};if(!r.id)return;$("hostScorePanel").classList.remove("hidden");$("hostRoundInfo").textContent=`${r.colorEmoji||""} ${r.colorName||""} — ${r.category||""} — ${r.status||""}`;let ps=room.players||{},ans=room.answers?.[r.id]||{},cor=room.correct?.[r.id]||{};$("hostScoreboard").innerHTML=Object.entries(ps).map(([pid,p])=>{let st=cor[pid],cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending";return `<div class="scoreCard ${cls}"><div>${esc(p.name)}</div><div>${esc(ans[pid]?.answer||"Geen antwoord")}</div><div><button type="button" class="goodBtn ${st===true?"goodSelected":""}" data-pid="${pid}" data-good="true">🐵</button><button type="button" class="badBtn ${st===false?"badSelected":""}" data-pid="${pid}" data-good="false">❌</button></div></div>`}).join("")}
function scoreboardClick(e){let btn=e.target.closest("button[data-pid]");if(!btn)return;e.preventDefault();let pid=btn.dataset.pid,good=btn.dataset.good==="true";db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{let r=s.val()||{};if(!r.id)throw Error("Geen actieve ronde.");return db.ref("rooms/"+currentRoomCode+"/correct/"+r.id+"/"+pid).set(good)}).then(()=>{$("hostStatus").textContent="🐵 Beoordeling opgeslagen."}).catch(err=>alert(err.message))}
function publishResults(){db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{},up={};up["rooms/"+currentRoomCode+"/currentRound/status"]="judged";Object.keys(room.players||{}).forEach(pid=>up["rooms/"+currentRoomCode+"/players/"+pid+"/ready"]=false);return db.ref().update(up)}).then(()=>{$("hostStatus").textContent="Resultaten verzonden. Goede spelers mogen kiezen."})}

// Player listen/render
function listenPlayer(){db.ref("rooms/"+currentRoomCode).on("value",s=>{let room=s.val()||{},r=room.currentRound||{};activeRound=r;renderLobby(room);if(!r.id){showScreen("screenLobby");return}if(r.status==="picking"){renderPlayerPicker(r);showScreen("screenPicker");return}if(r.status==="ready"){renderColor(r);showScreen("screenColor");return}if(r.status==="answering"){renderAnswer(room,r);showScreen("screenAnswer");return}if(r.status==="locked"){renderScore(room);showScreen("screenScore");return}if(r.status==="judged"){renderScore(room);let me=room.players?.[currentPlayerId]||{},good=room.correct?.[r.id]?.[currentPlayerId]===true,picked=me.lastPickedRound===r.id;if(good&&!picked){renderPick(room,r);showScreen("screenPick")}else showScreen("screenScore")}});listenBingo(currentRoomCode)}
function renderLobby(room){let ps=room.players||{},me=ps[currentPlayerId]||{};$("playerList").innerHTML=Object.entries(ps).map(([pid,p])=>`<div class="playerRow ${p.ready?"ready":""}" onclick="showOther('${pid}')"><strong>${esc(p.name)}${pid===currentPlayerId?" (jij)":""}</strong><span>${p.ready?"🐵 READY":"⏳ wacht"}</span></div>`).join("");let total=Object.keys(ps).length,ready=Object.values(ps).filter(p=>p.ready).length;$("lobbyInfo").textContent=`${ready}/${total} spelers ready`;renderCard("ownCard",me.card||[],me.marked||{});$("readyBtn").disabled=!!me.ready}
function showOther(pid){db.ref("rooms/"+currentRoomCode+"/players/"+pid).once("value").then(s=>{let p=s.val();if(!p)return;$("otherCardBox").classList.remove("hidden");$("otherCardTitle").textContent="Kaart van "+p.name;renderCard("otherCard",p.card||[],p.marked||{})})}
window.showOther=showOther;
function renderCard(id,card,marked,click=false,r=null){let el=$(id);if(!el)return;el.innerHTML=(card||[]).map((c,i)=>{let m=marked&&marked[i],pickable=click&&r&&c===r.colorKey&&c!=="free"&&!m,blocked=click&&!pickable&&c!=="free"&&!m;return `<div class="bingoCell ${c==="free"?"free":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-i="${i}">${m?"🐵":emoji(c)}</div>`}).join("");if(click)el.querySelectorAll(".pickableCell").forEach(x=>x.addEventListener("click",()=>pickCell(Number(x.dataset.i))))}
function renderPlayerPicker(r){$("playerPickerArea").innerHTML=pickerHTML(r.pickerMode||"disco")}
function renderColor(r){$("colorDisplay").innerHTML=`${r.colorEmoji}<br>${r.colorName}`;$("categoryDisplay").textContent=r.category}
function renderAnswer(room,r){$("answerRoundInfo").textContent=`${r.colorEmoji} ${r.colorName} — ${r.category}`;let ex=room.answers?.[r.id]?.[currentPlayerId];if(ex){$("answerInput").value=ex.answer;$("answerInput").disabled=true;$("submitAnswerBtn").disabled=true;$("answerStatus").textContent="🔒 Antwoord ingeleverd."}else{$("answerInput").disabled=false;$("submitAnswerBtn").disabled=false;$("answerStatus").textContent="Typ je antwoord."}clearInterval(screenTimer);screenTimer=setInterval(()=>{let left=Math.max(0,Math.ceil(((r.deadlineMs||0)-Date.now())/1000));$("timerBox").textContent="⏱️ "+left+" sec";if(left<=0){clearInterval(screenTimer);$("answerInput").disabled=true;$("submitAnswerBtn").disabled=true}},300)}
function submitAnswer(){if(!activeRound?.id)return;db.ref("rooms/"+currentRoomCode+"/answers/"+activeRound.id+"/"+currentPlayerId).set({answer:$("answerInput").value||"",submittedAt:firebase.database.ServerValue.TIMESTAMP}).then(()=>showScreen("screenScore"))}
function renderScore(room){let r=room.currentRound||{},box=$("correctAnswerBox"),ans=r.correctAnswer;if(ans){box.classList.remove("hidden");box.innerHTML=`<h3>🐵 Juiste antwoord</h3><p>🎵 ${esc(ans.track||"-")}</p><p>👤 ${esc(ans.artist||"-")}</p><p>📅 ${esc(ans.year||"-")}</p><p>💿 ${esc(ans.album||"-")}</p>`}else box.classList.add("hidden");let ps=room.players||{},answers=room.answers?.[r.id]||{},cor=room.correct?.[r.id]||{};$("playerScoreboard").innerHTML=Object.entries(ps).map(([pid,p])=>{let st=r.status==="judged"?cor[pid]:undefined,cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending",icon=st===true?"🐵":st===false?"❌":"⏳";return `<div class="scoreCard ${cls}"><div class="scoreName" onclick="showOther('${pid}')">${esc(p.name)}${pid===currentPlayerId?" (jij)":""}</div><div>${esc(answers[pid]?.answer||"Geen antwoord")}</div><div>${icon}</div></div>`}).join("")}
function renderPick(room,r){let me=room.players?.[currentPlayerId]||{};$("pickInfo").textContent=`Kies 1 ${r.colorEmoji} ${r.colorName} vakje.`;renderCard("pickCard",me.card||[],me.marked||{},true,r)}
function checkBingo(marked){let lines=[[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];return lines.some(line=>line.every(i=>i===12||(marked&&marked[i])))}
function pickCell(i){db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).once("value").then(s=>{let p=s.val()||{},marked=p.marked||{},card=p.card||[];if(card[i]!==activeRound.colorKey||marked[i])return;marked[i]=true;let bingo=checkBingo(marked);db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).update({marked,bingo,lastPickedRound:activeRound.id,ready:true}).then(()=>{if(bingo)db.ref("rooms/"+currentRoomCode+"/bingos").push({name:currentPlayerName,roundId:activeRound.id,at:firebase.database.ServerValue.TIMESTAMP});showScreen("screenLobby")})})}

// Audio/winner
function activateSound(){try{let C=window.AudioContext||window.webkitAudioContext;if(C&&!audioCtx)audioCtx=new C();if(audioCtx&&audioCtx.state==="suspended")audioCtx.resume();$("soundStatus").textContent="🐵  actief."}catch(e){}}
function tune(){try{let C=window.AudioContext||window.webkitAudioContext;if(!audioCtx&&C)audioCtx=new C();if(!audioCtx)return;[523,659,784,1046].forEach((f,i)=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f;o.connect(g);g.connect(audioCtx.destination);let t=audioCtx.currentTime+i*.18;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.3,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.start(t);o.stop(t+.18)})}catch(e){}}
function speak(name){try{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance("Aiiii mi hende. Speler "+name+" heeft bingo!");u.lang="nl-NL";u.rate=.9;speechSynthesis.speak(u)}catch(e){}}
function confetti(){let cs=["#FFCC33","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#fff"];for(let i=0;i<90;i++){let p=document.createElement("div");p.className="confetti";p.style.left=Math.random()*100+"vw";p.style.background=pick(cs);document.body.appendChild(p);setTimeout(()=>p.remove(),3500)}}
function showWinner(name){if($("winnerPanel")){$("winnerPanel").classList.remove("hidden");$("winnerMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}if($("hostBingoPanel")){$("hostBingoPanel").classList.remove("hidden");$("hostBingoMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}confetti();tune();setTimeout(()=>speak(name),700)}
function listenBingo(room){db.ref("rooms/"+room+"/bingos").on("child_added",s=>{let b=s.val()||{},key=s.key+"_"+(b.roundId||"");if(key===lastBingoKey)return;lastBingoKey=key;localStorage.hb_last_bingo_key=key;showWinner(b.name||"onbekend")})}


/* =========================
   V7B HARD STARTPOPUP / KAMERLOCK
   ========================= */
function hbIsPlayerUrlV7B(){
  return !!new URLSearchParams(location.search).get("room");
}
function hbSavedRoomV7B(){
  return localStorage.getItem("hb_host_room") || localStorage.getItem("hb_last_stable_room") || "";
}
function hbSaveRoomV7B(code){
  if(!code) return;
  localStorage.setItem("hb_host_room", code);
  localStorage.setItem("hb_last_stable_room", code);
}
function hbQrV7B(text){
  return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(text || "");
}
function hbRenderRoomBoxV7B(code){
  const box = document.getElementById("roomBox");
  if(!box || !code) return;
  const link = location.origin + location.pathname + "?room=" + code;
  box.classList.remove("hidden");
  box.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 126px;gap:14px;align-items:center">
      <div>
        <div style="font-size:12px;opacity:.75;font-weight:900;margin-bottom:5px">SPELCODE</div>
        <div style="font-size:42px;font-weight:900;color:#7ED957;letter-spacing:3px;line-height:1">${esc(code)}</div>
        <div style="width:100%;margin-top:10px;padding:8px 9px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.14);font-size:11px;word-break:break-all">${esc(link)}</div>
      </div>
      <img alt="QR code" src="${hbQrV7B(link)}" style="width:126px;height:126px;background:white;border-radius:12px;padding:6px">
    </div>`;
}
function hbResumeRoomV7B(code){
  if(!code) return;
  currentRoomCode = code;
  hbSaveRoomV7B(code);
  hbRenderRoomBoxV7B(code);
  try{ listenHost(code); }catch(e){}
  try{ listenBingo(code); }catch(e){}
  const st = document.getElementById("hostStatus");
  if(st) st.textContent = "Kamer hervat. Klaar voor nieuwe ronde.";
}
function hbShowStartPopupV7B(){
  if(hbIsPlayerUrlV7B()) return;
  const overlay = document.getElementById("hbHostStartOverlay");
  if(!overlay) return;
  const saved = hbSavedRoomV7B();
  const line = document.getElementById("hbLastRoomLine");
  const code = document.getElementById("hbLastRoomCode");
  const resume = document.getElementById("hbResumeRoomBtn");

  if(saved){
    if(line) line.classList.remove("hidden");
    if(code) code.textContent = saved;
    if(resume){
      resume.disabled = false;
      resume.textContent = "🔄 Hervat " + saved;
    }
    hbRenderRoomBoxV7B(saved);
  }else{
    if(line) line.classList.add("hidden");
    if(resume){
      resume.disabled = true;
      resume.textContent = "🔄 Hervat kamer";
    }
  }

  overlay.classList.remove("hidden");

  document.getElementById("hbResumeRoomBtn")?.addEventListener("click", () => {
    const r = hbSavedRoomV7B();
    if(r) hbResumeRoomV7B(r);
    overlay.classList.add("hidden");
  }, {once:true});

  document.getElementById("hbNewRoomModalBtn")?.addEventListener("click", () => {
    localStorage.removeItem("hb_host_room");
    localStorage.removeItem("hb_last_stable_room");
    currentRoomCode = "";
    overlay.classList.add("hidden");
    if(typeof createRoom === "function") createRoom();
  }, {once:true});

  document.getElementById("hbCloseModalBtn")?.addEventListener("click", () => {
    overlay.classList.add("hidden");
  }, {once:true});
}
function hbPlayerTopCodeV7B(){
  if(!hbIsPlayerUrlV7B()) return;
  const room = (new URLSearchParams(location.search).get("room") || currentRoomCode || localStorage.getItem("hb_player_room") || "").toUpperCase();
  const el = document.getElementById("dashRoundNo");
  if(el && room) el.textContent = room;
}
function hbWrapRoomFunctionsV7B(){
  if(typeof createRoom === "function" && !window.__hbCreateRoomV7B){
    window.__hbCreateRoomV7B = true;
    const old = createRoom;
    createRoom = function(){
      const out = old.apply(this, arguments);
      setTimeout(() => {
        const code = currentRoomCode || localStorage.getItem("hb_host_room");
        if(code){ hbSaveRoomV7B(code); hbRenderRoomBoxV7B(code); }
      }, 800);
      return out;
    };
  }
  if(typeof showRoom === "function" && !window.__hbShowRoomV7B){
    window.__hbShowRoomV7B = true;
    const old = showRoom;
    showRoom = function(){
      const out = old.apply(this, arguments);
      const code = currentRoomCode || localStorage.getItem("hb_host_room");
      if(code){ hbSaveRoomV7B(code); setTimeout(() => hbRenderRoomBoxV7B(code), 50); }
      return out;
    };
  }
}
function hbBootV7B(){
  hbWrapRoomFunctionsV7B();
  hbPlayerTopCodeV7B();
  if(!hbIsPlayerUrlV7B()){
    setTimeout(hbShowStartPopupV7B, 500);
  }
  setInterval(hbPlayerTopCodeV7B, 1500);
}


init();


/* =========================
   V4 PICKER FIX
   Spelers zien dezelfde discobal/draairad animatie als host
   ========================= */

function sharedPickerHTML(mode){
  if(mode === "wheel"){
    return `<div class="playerPickerBig">
      <div class="bbOldPickerRemoved"><div class="pointer"></div><div class="bbOldPickerRemoved"></div></div>
      <div class="pickerTitle">Kleurenmixer start...</div>
    </div>`;
  }

  return `<div class="playerPickerBig">
    <div class="bbOldPickerRemoved">🪩</div>
    <div class="pickerTitle">Kleurenmixer start...</div>
  </div>`;
}

// Override startRoundVisual: stuur pickerStatus meteen naar Firebase
startRoundVisual = function(room){
  $("hostAnswerArea").innerHTML = "";
  $("playBtn").disabled = true;
  $("showAnswerBtn").disabled = true;

  const mode = Math.random() < .5 ? "disco" : "wheel";
  const pickerMarkup = sharedPickerHTML(mode);

  $("hostPickerArea").innerHTML = pickerMarkup;
  currentRoundId = "r_" + Date.now();

  // Belangrijk: dit wordt direct naar spelers gestuurd
  db.ref("rooms/" + room + "/currentRound").set({
    id: currentRoundId,
    status: "picking",
    pickerMode: mode,
    pickerMarkup: pickerMarkup,
    pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
    seconds: Number($("duration").value) || 20
  }).then(() => {
    if($("hostStatus")) $("hostStatus").textContent = "Kleurkiezer draait bij host en spelers...";
  });

  setTimeout(() => {
    flash();

    const color = pick(COLORS);
    const cat = $(color.input).value || "Geen categorie";

    $("hostPickerArea").innerHTML =
      `<div class="colorDisplay">${color.emoji}<br>${color.name}</div>
       <div class="categoryDisplay">${esc(cat)}</div>`;

    const round = {
      id: currentRoundId,
      status: "ready",
      pickerMode: mode,
      pickerMarkup: pickerMarkup,
      colorKey: color.key,
      colorName: color.name,
      colorEmoji: color.emoji,
      category: cat,
      seconds: Number($("duration").value) || 20
    };

    db.ref("rooms/" + room + "/currentRound").set(round);

    $("playBtn").disabled = false;
    $("showAnswerBtn").disabled = false;
    $("hostScorePanel").classList.remove("hidden");
  }, 3500);
};

function renderPlayerPickerFixed(round){
  const area = $("playerPickerArea");
  if(!area) return;

  area.innerHTML = round.pickerMarkup || sharedPickerHTML(round.pickerMode || "disco");
}

// Override listenPlayer met expliciete picking status
listenPlayer = function(){
  db.ref("rooms/" + currentRoomCode).on("value", s => {
    const room = s.val() || {};
    const r = room.currentRound || {};
    activeRound = r;

    renderLobby(room);

    if(!r.id){
      showScreen("screenLobby");
      return;
    }

    if(r.status === "picking"){
      renderPlayerPickerFixed(r);
      showScreen("screenPicker");
      return;
    }

    if(r.status === "ready"){
      renderColor(r);
      showScreen("screenColor");
      return;
    }

    if(r.status === "answering"){
      renderAnswer(room, r);
      showScreen("screenAnswer");
      return;
    }

    if(r.status === "locked"){
      renderScore(room);
      showScreen("screenScore");
      return;
    }

    if(r.status === "judged"){
      renderScore(room);
      const me = room.players?.[currentPlayerId] || {};
      const good = room.correct?.[r.id]?.[currentPlayerId] === true;
      const picked = me.lastPickedRound === r.id;

      if(good && !picked){
        renderPick(room, r);
        showScreen("screenPick");
      }else{
        showScreen("screenScore");
      }
    }
  });

  listenBingo(currentRoomCode);
};


/* =========================
   V4.1 FLOW FIX
   Correcte flow:
   START RONDE -> picker bij host + spelers
   kleur/categorie zichtbaar
   pas bij SPEEL NUMMER -> spelers naar antwoordscherm
   timer klaar -> automatisch antwoord tonen + ronde locked
   ========================= */

function answerObjectV41(){
  if(!currentTrack) return null;
  return {
    track: currentTrack.name || "",
    artist: currentTrack.artists || "",
    album: currentTrack.album || "",
    year: (currentTrack.release_date || "").slice(0,4) || ""
  };
}

function showHostAnswerV41(ans){
  const area = document.getElementById("hostAnswerArea");
  if(!area || !ans) return;
  area.innerHTML =
    `<div class="correctBox">
      <h3>${esc(ans.track || "-")}</h3>
      <p>${esc(ans.artist || "-")}</p>
      <p>${esc(ans.album || "-")} — ${esc(ans.year || "-")}</p>
    </div>`;
}

function publishAnswerV41(){
  const room = currentRoomCode || localStorage.getItem("hb_host_room");
  const ans = answerObjectV41();
  if(!db || !room || !ans) return Promise.resolve();

  showHostAnswerV41(ans);

  return db.ref("rooms/" + room + "/currentRound").update({
    correctAnswer: ans,
    correctAnswerShown: true
  });
}

// Alleen locken NA timer, inclusief antwoord zichtbaar maken
lockRound = function(){
  const room = currentRoomCode || localStorage.getItem("hb_host_room");
  if(!db || !room) return;

  publishAnswerV41().then(() => {
    return db.ref("rooms/" + room + "/currentRound").update({
      status: "locked"
    });
  }).then(() => {
    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Tijd voorbij. Antwoord automatisch zichtbaar bij spelers.";
  }).catch(e => alert("Timer/antwoord fout: " + e.message));
};

// Toon antwoord knop blijft handmatig kunnen
showAnswer = function(){
  publishAnswerV41().catch(e => alert("Antwoord tonen mislukt: " + e.message));
};

// Speel knop: zet pas HIER de ronde op answering
playHidden = async function(){
  try{
    if(!currentTrack){
      alert("Geen nummer gekozen. Druk eerst op START RONDE.");
      return;
    }

    const playBtn = document.getElementById("playBtn");
    if(playBtn){
      playBtn.disabled = true;
      playBtn.textContent = "🎵 Nummer speelt...";
    }

    if(!deviceId){
      await activatePlayer();
      await new Promise(r => setTimeout(r, 1200));
    }

    if(!deviceId){
      alert("Geen Spotify-speler actief. Klik eerst op Activeer Spotify-speler.");
      if(playBtn){
        playBtn.disabled = false;
        playBtn.textContent = "🎵 Speel verborgen nummer";
      }
      return;
    }

    const dur = (Number(document.getElementById("duration").value) || 20) * 1000;
    let pos = 0;

    if(document.getElementById("randomStart").checked && currentTrack.duration_ms > dur + 40000){
      const max = Math.max(0, currentTrack.duration_ms - dur - 5000);
      pos = Math.floor(20000 + Math.random() * Math.max(1, max - 20000));
    }

    await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      body: JSON.stringify({uris:[currentTrack.uri], position_ms:pos})
    });

    const room = currentRoomCode || localStorage.getItem("hb_host_room");
    const deadline = Date.now() + dur;

    await db.ref("rooms/" + room + "/currentRound").update({
      status: "answering",
      deadlineMs: deadline,
      musicStartedAt: firebase.database.ServerValue.TIMESTAMP
    });

    const stopBtn = document.getElementById("stopBtn");
    if(stopBtn) stopBtn.disabled = false;

    clearTimeout(lockTimer);
    lockTimer = setTimeout(lockRound, dur);

    clearTimeout(stopTimer);
    stopTimer = setTimeout(stopPlayback, dur);

    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Muziek speelt. Spelers kunnen nu antwoorden.";

  }catch(e){
    alert("Afspelen mislukt: " + e.message);
    const playBtn = document.getElementById("playBtn");
    if(playBtn){
      playBtn.disabled = false;
      playBtn.textContent = "🎵 Speel verborgen nummer";
    }
  }
};

// Start ronde: na picker blijft speler op kleur/categorie tot muziek echt start
// Deze override zorgt ook dat speelknop opnieuw goed enabled is.
startRoundVisual = function(room){
  document.getElementById("hostAnswerArea").innerHTML = "";
  document.getElementById("playBtn").disabled = true;
  document.getElementById("showAnswerBtn").disabled = true;
  document.getElementById("playBtn").textContent = "🎵 Speel verborgen nummer";

  const mode = Math.random() < .5 ? "disco" : "wheel";
  const pickerMarkup = typeof sharedPickerHTML === "function"
    ? sharedPickerHTML(mode)
    : pickerHTML(mode);

  document.getElementById("hostPickerArea").innerHTML = pickerMarkup;
  currentRoundId = "r_" + Date.now();

  db.ref("rooms/" + room + "/currentRound").set({
    id: currentRoundId,
    status: "picking",
    pickerMode: mode,
    pickerMarkup: pickerMarkup,
    pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
    seconds: Number(document.getElementById("duration").value) || 20
  });

  setTimeout(() => {
    flash();

    const color = pick(COLORS);
    const cat = document.getElementById(color.input).value || "Geen categorie";

    document.getElementById("hostPickerArea").innerHTML =
      `<div class="colorDisplay">${color.emoji}<br>${color.name}</div>
       <div class="categoryDisplay">${esc(cat)}</div>`;

    const round = {
      id: currentRoundId,
      status: "ready",
      pickerMode: mode,
      pickerMarkup: pickerMarkup,
      colorKey: color.key,
      colorName: color.name,
      colorEmoji: color.emoji,
      category: cat,
      seconds: Number(document.getElementById("duration").value) || 20
    };

    db.ref("rooms/" + room + "/currentRound").set(round);

    document.getElementById("playBtn").disabled = false;
    document.getElementById("showAnswerBtn").disabled = false;
    document.getElementById("hostScorePanel").classList.remove("hidden");

    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Kleur bekend. Klik nu op Speel verborgen nummer.";
  }, 3500);
};

// Player listener strak: ready = kleur/categorie tonen, answering = antwoordscherm
listenPlayer = function(){
  db.ref("rooms/" + currentRoomCode).on("value", s => {
    const room = s.val() || {};
    const r = room.currentRound || {};
    activeRound = r;

    renderLobby(room);

    if(!r.id){
      showScreen("screenLobby");
      return;
    }

    if(r.status === "picking"){
      if(typeof renderPlayerPickerFixed === "function") renderPlayerPickerFixed(r);
      else renderPlayerPicker(r);
      showScreen("screenPicker");
      return;
    }

    if(r.status === "ready"){
      renderColor(r);
      showScreen("screenColor");
      return;
    }

    if(r.status === "answering"){
      renderAnswer(room, r);
      showScreen("screenAnswer");
      return;
    }

    if(r.status === "locked"){
      renderScore(room);
      showScreen("screenScore");
      return;
    }

    if(r.status === "judged"){
      renderScore(room);
      const me = room.players?.[currentPlayerId] || {};
      const good = room.correct?.[r.id]?.[currentPlayerId] === true;
      const picked = me.lastPickedRound === r.id;

      if(good && !picked){
        renderPick(room, r);
        showScreen("screenPick");
      }else{
        showScreen("screenScore");
      }
    }
  });

  listenBingo(currentRoomCode);
};

// Rebind knoppen, omdat oude listeners naar oude functies kunnen wijzen
function rebindHostButtonsV41(){
  const bindings = [
    ["playBtn", playHidden],
    ["showAnswerBtn", showAnswer],
    ["lockBtn", lockRound]
  ];

  bindings.forEach(([id, fn]) => {
    const old = document.getElementById(id);
    if(!old) return;
    const fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    fresh.addEventListener("click", fn);
  });
}

setTimeout(rebindHostButtonsV41, 400);
setTimeout(rebindHostButtonsV41, 1200);


/* =========================
   V4.2 REALTIME SCOREBOARD
   Na eigen antwoord direct live scorebord van HUIDIGE ronde
   ========================= */

let lastSeenRoundIdRealtime = "";

// Reset oude score zodra er een nieuwe ronde is
function clearRealtimeRoundUi(roundId){
  if(!roundId || lastSeenRoundIdRealtime === roundId) return;
  lastSeenRoundIdRealtime = roundId;

  const score = document.getElementById("playerScoreboard");
  if(score) score.innerHTML = "Nog geen antwoorden voor deze ronde.";

  const correct = document.getElementById("correctAnswerBox");
  if(correct){
    correct.classList.add("hidden");
    correct.innerHTML = "";
  }

  const answer = document.getElementById("answerInput");
  if(answer) answer.value = "";

  const status = document.getElementById("answerStatus");
  if(status) status.textContent = "";

  const timer = document.getElementById("timerBox");
  if(timer) timer.textContent = "⏱️ --";
}

function playerHasAnsweredCurrentRound(room, round){
  return !!(round && round.id && room.answers && room.answers[round.id] && room.answers[round.id][currentPlayerId]);
}

function renderScoreRealtime(room){
  const r = room.currentRound || {};
  if(!r.id) return;

  clearRealtimeRoundUi(r.id);

  const box = document.getElementById("correctAnswerBox");
  const ans = r.correctAnswer;

  if(box){
    if(ans){
      box.classList.remove("hidden");
      box.innerHTML =
        `<h3>🐵 Juiste antwoord</h3>
         <p>🎵 ${esc(ans.track || "-")}</p>
         <p>👤 ${esc(ans.artist || "-")}</p>
         <p>📅 ${esc(ans.year || "-")}</p>
         <p>💿 ${esc(ans.album || "-")}</p>`;
    }else{
      box.classList.add("hidden");
      box.innerHTML = "";
    }
  }

  const players = room.players || {};
  const answers = room.answers && room.answers[r.id] ? room.answers[r.id] : {};
  const correct = room.correct && room.correct[r.id] ? room.correct[r.id] : {};

  const score = document.getElementById("playerScoreboard");
  if(!score) return;

  score.innerHTML = Object.entries(players).map(([pid,p]) => {
    const hasAnswer = answers[pid] && typeof answers[pid].answer !== "undefined";
    const answerText = hasAnswer && String(answers[pid].answer).trim()
      ? answers[pid].answer
      : (hasAnswer ? "Leeg antwoord" : "Nog niet ingevuld");

    let st = undefined;
    if(r.status === "judged") st = correct[pid];

    const cls = st === true ? "scoreGood" : st === false ? "scoreBad" : "scorePending";
    const icon = st === true ? "🐵" : st === false ? "❌" : (hasAnswer ? "📝" : "⏳");

    return `<div class="scoreCard ${cls}">
      <div class="scoreName" onclick="showOther('${pid}')">${esc(p.name || "Speler")}${pid===currentPlayerId ? " (jij)" : ""}</div>
      <div>${esc(answerText)}</div>
      <div>${icon}</div>
    </div>`;
  }).join("") || "Nog geen spelers.";
}

// Override renderScore overal naar realtime versie
renderScore = renderScoreRealtime;

// Na insturen direct naar live scorebord van huidige ronde
submitAnswer = function(){
  if(!activeRound?.id) return;

  const answer = document.getElementById("answerInput").value || "";

  db.ref("rooms/" + currentRoomCode + "/answers/" + activeRound.id + "/" + currentPlayerId)
    .set({
      answer: answer,
      submittedAt: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => {
      const input = document.getElementById("answerInput");
      const btn = document.getElementById("submitAnswerBtn");
      const status = document.getElementById("answerStatus");

      if(input) input.disabled = true;
      if(btn) btn.disabled = true;
      if(status) status.textContent = "🔒 Antwoord ingeleverd.";

      return db.ref("rooms/" + currentRoomCode).once("value");
    })
    .then(s => {
      renderScoreRealtime(s.val() || {});
      showScreen("screenScore");
    })
    .catch(e => alert("Antwoord opslaan mislukt: " + e.message));
};

// Player listener: tijdens answering naar scorebord als jij al antwoord hebt gegeven
listenPlayer = function(){
  db.ref("rooms/" + currentRoomCode).on("value", s => {
    const room = s.val() || {};
    const r = room.currentRound || {};
    activeRound = r;

    if(r.id) clearRealtimeRoundUi(r.id);

    renderLobby(room);

    if(!r.id){
      showScreen("screenLobby");
      return;
    }

    if(r.status === "picking"){
      if(typeof renderPlayerPickerFixed === "function") renderPlayerPickerFixed(r);
      else renderPlayerPicker(r);
      showScreen("screenPicker");
      return;
    }

    if(r.status === "ready"){
      renderColor(r);
      showScreen("screenColor");
      return;
    }

    if(r.status === "answering"){
      if(playerHasAnsweredCurrentRound(room, r)){
        renderScoreRealtime(room);
        showScreen("screenScore");
      }else{
        renderAnswer(room, r);
        showScreen("screenAnswer");
      }
      return;
    }

    if(r.status === "locked"){
      renderScoreRealtime(room);
      showScreen("screenScore");
      return;
    }

    if(r.status === "judged"){
      renderScoreRealtime(room);

      const me = room.players?.[currentPlayerId] || {};
      const good = room.correct?.[r.id]?.[currentPlayerId] === true;
      const picked = me.lastPickedRound === r.id;

      if(good && !picked){
        renderPick(room, r);
        showScreen("screenPick");
      }else{
        showScreen("screenScore");
      }
    }
  });

  listenBingo(currentRoomCode);
};

// Rebind submit knop naar nieuwe functie
setTimeout(() => {
  const btn = document.getElementById("submitAnswerBtn");
  if(btn){
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", submitAnswer);
  }
}, 500);


/* =========================
   V4.3 ANTWOORDVELD LEEG BIJ NIEUWE RONDE
   ========================= */

let answerInputRoundIdV43 = "";

function resetAnswerInputForRoundV43(roundId){
  if(!roundId) return;

  if(answerInputRoundIdV43 !== roundId){
    answerInputRoundIdV43 = roundId;

    const input = document.getElementById("answerInput");
    const btn = document.getElementById("submitAnswerBtn");
    const status = document.getElementById("answerStatus");

    if(input){
      input.value = "";
      input.disabled = false;
    }
    if(btn) btn.disabled = false;
    if(status) status.textContent = "";
  }
}

// Override renderAnswer zodat oude antwoord nooit blijft staan
renderAnswer = function(room, r){
  resetAnswerInputForRoundV43(r.id);

  const info = document.getElementById("answerRoundInfo");
  if(info) info.textContent = `${r.colorEmoji || ""} ${r.colorName || ""} — ${r.category || ""}`;

  const input = document.getElementById("answerInput");
  const btn = document.getElementById("submitAnswerBtn");
  const status = document.getElementById("answerStatus");

  const existing = room.answers && room.answers[r.id] ? room.answers[r.id][currentPlayerId] : null;

  if(existing){
    if(input){
      input.value = existing.answer || "";
      input.disabled = true;
    }
    if(btn) btn.disabled = true;
    if(status) status.textContent = "🔒 Antwoord ingeleverd.";
  }else{
    if(input){
      input.value = "";
      input.disabled = false;
    }
    if(btn) btn.disabled = false;
    if(status) status.textContent = "Typ je antwoord.";
  }

  clearInterval(screenTimer);
  screenTimer = setInterval(() => {
    const left = Math.max(0, Math.ceil(((r.deadlineMs || 0) - Date.now()) / 1000));
    const timer = document.getElementById("timerBox");
    if(timer) timer.textContent = "⏱️ " + left + " sec";

    if(left <= 0){
      clearInterval(screenTimer);
      if(input) input.disabled = true;
      if(btn) btn.disabled = true;
      if(status) status.textContent = "🔒 Tijd voorbij.";
    }
  }, 300);
};

// Extra zekerheid: bij status ready/picking ook invulveld leegmaken voor nieuwe ronde
const oldListenPlayerV43 = listenPlayer;
listenPlayer = function(){
  db.ref("rooms/" + currentRoomCode).on("value", s => {
    const room = s.val() || {};
    const r = room.currentRound || {};
    activeRound = r;

    if(r.id && r.id !== answerInputRoundIdV43 && (r.status === "picking" || r.status === "ready")){
      resetAnswerInputForRoundV43(r.id);
    }

    renderLobby(room);

    if(!r.id){
      showScreen("screenLobby");
      return;
    }

    if(r.status === "picking"){
      if(typeof renderPlayerPickerFixed === "function") renderPlayerPickerFixed(r);
      else renderPlayerPicker(r);
      showScreen("screenPicker");
      return;
    }

    if(r.status === "ready"){
      renderColor(r);
      showScreen("screenColor");
      return;
    }

    if(r.status === "answering"){
      if(typeof playerHasAnsweredCurrentRound === "function" && playerHasAnsweredCurrentRound(room, r)){
        renderScore(room);
        showScreen("screenScore");
      }else{
        renderAnswer(room, r);
        showScreen("screenAnswer");
      }
      return;
    }

    if(r.status === "locked"){
      renderScore(room);
      showScreen("screenScore");
      return;
    }

    if(r.status === "judged"){
      renderScore(room);
      const me = room.players?.[currentPlayerId] || {};
      const good = room.correct?.[r.id]?.[currentPlayerId] === true;
      const picked = me.lastPickedRound === r.id;

      if(good && !picked){
        renderPick(room, r);
        showScreen("screenPick");
      }else{
        showScreen("screenScore");
      }
    }
  });

  listenBingo(currentRoomCode);
};


/* =========================
   V4.4 ZELFDE SCHERM
   Scorebord blijft altijd staan.
   Antwoordveld wordt vervangen door juiste antwoord.
   ========================= */

let activeScoreRoundIdV44 = "";

function renderDynamicAnswerBlockV44(room){
  const r = room.currentRound || {};
  const block = document.getElementById("dynamicAnswerBlock");
  if(!block || !r.id) return;

  const ownAnswer = room.answers && room.answers[r.id] ? room.answers[r.id][currentPlayerId] : null;
  const ans = r.correctAnswer;

  // Timer klaar / locked / judged: antwoordveld weg, juiste antwoord op dezelfde plek
  if(ans && (r.status === "locked" || r.status === "judged")){
    block.innerHTML =
      `<h3>🐵 Juiste antwoord</h3>
       <p>🎵 <strong>${esc(ans.track || "-")}</strong></p>
       <p>👤 ${esc(ans.artist || "-")}</p>
       <p>📅 ${esc(ans.year || "-")}</p>
       <p>💿 ${esc(ans.album || "-")}</p>`;
    return;
  }

  // Na insturen, maar timer loopt nog
  if(ownAnswer){
    block.innerHTML =
      `<h3>🔒 Antwoord ingeleverd</h3>
       <p class="submitted">Jouw antwoord: ${esc(ownAnswer.answer || "Leeg antwoord")}</p>
       <p class="small">Wachten tot de tijd voorbij is...</p>`;
    return;
  }

  // Tijdens answering nog geen antwoord: compact invoerveld in hetzelfde scherm
  if(r.status === "answering"){
    block.innerHTML =
      `<h3>✍️ Vul je antwoord in</h3>
       <p class="small">${esc(r.colorEmoji || "")} ${esc(r.colorName || "")} — ${esc(r.category || "")}</p>
       <div id="scoreTimerBox" class="timer">⏱️ --</div>
       <div class="compactInputRow">
         <input id="scoreAnswerInput" placeholder="Typ je antwoord">
         <button id="scoreSubmitAnswerBtn">Verstuur antwoord</button>
       </div>`;

    const btn = document.getElementById("scoreSubmitAnswerBtn");
    if(btn){
      btn.addEventListener("click", () => {
        const val = document.getElementById("scoreAnswerInput")?.value || "";
        submitAnswerValueV44(val);
      });
    }
    startScoreTimerV44(r);
    return;
  }

  // Ready/picking fallback
  block.innerHTML =
    `<h3>🎵 Wachten op muziek</h3>
     <p class="small">${esc(r.colorEmoji || "")} ${esc(r.colorName || "")} ${r.category ? "— " + esc(r.category) : ""}</p>`;
}

function startScoreTimerV44(r){
  clearInterval(window.__scoreTimerV44);
  window.__scoreTimerV44 = setInterval(() => {
    const left = Math.max(0, Math.ceil(((r.deadlineMs || 0) - Date.now()) / 1000));
    const el = document.getElementById("scoreTimerBox");
    if(el) el.textContent = "⏱️ " + left + " sec";
    if(left <= 0) clearInterval(window.__scoreTimerV44);
  }, 300);
}

function submitAnswerValueV44(value){
  if(!activeRound?.id) return;

  db.ref("rooms/" + currentRoomCode + "/answers/" + activeRound.id + "/" + currentPlayerId)
    .set({
      answer: value || "",
      submittedAt: firebase.database.ServerValue.TIMESTAMP
    })
    .catch(e => alert("Antwoord opslaan mislukt: " + e.message));
}

function renderScoreV44(room){
  const r = room.currentRound || {};
  if(!r.id) return;

  renderDynamicAnswerBlockV44(room);

  const players = room.players || {};
  const answers = room.answers && room.answers[r.id] ? room.answers[r.id] : {};
  const correct = room.correct && room.correct[r.id] ? room.correct[r.id] : {};

  const score = document.getElementById("playerScoreboard");
  if(!score) return;

  score.innerHTML = Object.entries(players).map(([pid,p]) => {
    const hasAnswer = answers[pid] && typeof answers[pid].answer !== "undefined";
    const answerText = hasAnswer && String(answers[pid].answer).trim()
      ? answers[pid].answer
      : (hasAnswer ? "Leeg antwoord" : "Nog niet ingevuld");

    let st = undefined;
    if(r.status === "judged") st = correct[pid];

    const cls = st === true ? "scoreGood" : st === false ? "scoreBad" : "scorePending";
    const icon = st === true ? "🐵" : st === false ? "❌" : (hasAnswer ? "📝" : "⏳");

    return `<div class="scoreCard ${cls}">
      <div class="scoreName" onclick="showOther('${pid}')">${esc(p.name || "Speler")}${pid===currentPlayerId ? " (jij)" : ""}</div>
      <div>${esc(answerText)}</div>
      <div>${icon}</div>
    </div>`;
  }).join("") || "Nog geen spelers.";
}

// Score-scherm wordt nu ook gebruikt tijdens answering
renderScore = renderScoreV44;

submitAnswer = function(){
  const val = document.getElementById("answerInput")?.value || "";
  submitAnswerValueV44(val);
};

// Nieuwe listener: tijdens answering altijd score-scherm tonen.
// Als je nog niet hebt ingevuld, staat antwoordveld boven scorebord.
// Na invullen verdwijnt dat veld en blijft scorebord staan.
listenPlayer = function(){
  db.ref("rooms/" + currentRoomCode).on("value", s => {
    const room = s.val() || {};
    const r = room.currentRound || {};
    activeRound = r;

    renderLobby(room);

    if(!r.id){
      showScreen("screenLobby");
      return;
    }

    if(r.status === "picking"){
      if(typeof renderPlayerPickerFixed === "function") renderPlayerPickerFixed(r);
      else renderPlayerPicker(r);
      showScreen("screenPicker");
      return;
    }

    if(r.status === "ready"){
      renderColor(r);
      showScreen("screenColor");
      return;
    }

    if(r.status === "answering"){
      renderScoreV44(room);
      showScreen("screenScore");
      return;
    }

    if(r.status === "locked"){
      renderScoreV44(room);
      showScreen("screenScore");
      return;
    }

    if(r.status === "judged"){
      renderScoreV44(room);

      const me = room.players?.[currentPlayerId] || {};
      const good = room.correct?.[r.id]?.[currentPlayerId] === true;
      const picked = me.lastPickedRound === r.id;

      if(good && !picked){
        renderPick(room, r);
        showScreen("screenPick");
      }else{
        showScreen("screenScore");
      }
    }
  });

  listenBingo(currentRoomCode);
};

// Rebind oude submit voor zekerheid
setTimeout(() => {
  const btn = document.getElementById("submitAnswerBtn");
  if(btn){
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", submitAnswer);
  }
}, 500);


/* =========================
   V5 COMPACT 2x2 DASHBOARD
   1 joinscherm + 1 speelscherm
   ========================= */

let compactOpenCards = {};
let compactRoundId = "";
let compactTimerInterval = null;

function colorHexV5(key){return {yellow:"#FFCC33",pink:"#00D4C7",purple:"#FF8A1F",blue:"#7ED957",green:"#FF5A5F",free:"#FFCC33"}[key] || "rgba(255,255,255,.18)";}

function showCompactDashboard(){
  const join = document.getElementById("screenJoin");
  const dash = document.getElementById("screenDashboard");
  if(join) join.classList.add("hidden");
  if(dash) dash.classList.remove("hidden");
}

function showCompactJoin(){
  const join = document.getElementById("screenJoin");
  const dash = document.getElementById("screenDashboard");
  if(join) join.classList.remove("hidden");
  if(dash) dash.classList.add("hidden");
}

function resetCompactRoundIfNeeded(roundId){
  if(!roundId || compactRoundId === roundId) return;
  compactRoundId = roundId;
  compactOpenCards = {};
  const answer = document.getElementById("dashAnswerBlock");
  if(answer) answer.innerHTML = "";
}

function renderCompactTop(room, r){
  const players = room.players || {};
  const count = Object.keys(players).length;
  const roundNo = document.getElementById("dashRoundNo");
  const playerCount = document.getElementById("dashPlayerCount");
  if(roundNo) roundNo.textContent = "READY";
  if(playerCount) playerCount.textContent = count;

  clearInterval(compactTimerInterval);
  compactTimerInterval = setInterval(() => {
    const timer = document.getElementById("dashTimer");
    if(!timer) return;
    if(r && r.status === "answering" && r.deadlineMs){
      const left = Math.max(0, Math.ceil((r.deadlineMs - Date.now()) / 1000));
      timer.textContent = "00:" + String(left).padStart(2,"0");
      if(left <= 0) clearInterval(compactTimerInterval);
    }else if(r && (r.status === "locked" || r.status === "judged")){
      timer.textContent = "00:00";
    }else{
      timer.textContent = "--";
    }
  }, 300);
}

function renderCompactAnswer(room, r){
  const block = document.getElementById("dashAnswerBlock");
  if(!block) return;

  const own = r?.id && room.answers && room.answers[r.id] ? room.answers[r.id][currentPlayerId] : null;

  if(!r || !r.id){
    block.innerHTML = `<div class="answerSubmitted"><h3>🎮 Wachten</h3><p>Host start zo de ronde.</p></div>`;
    return;
  }

  if(r.correctAnswer && (r.status === "locked" || r.status === "judged")){
    const a = r.correctAnswer;
    block.innerHTML =
      `<div class="correctMini">
        <h3>🐵 Juiste antwoord</h3>
        <p>🎵 <strong>${esc(a.track || "-")}</strong></p>
        <p>👤 ${esc(a.artist || "-")}</p>
        <p>📅 ${esc(a.year || "-")}</p>
        <p>💿 ${esc(a.album || "-")}</p>
      </div>`;
    return;
  }

  if(r.status === "answering" && own){
    block.innerHTML =
      `<div class="answerSubmitted">
        <h3>🔒 Ingeleverd</h3>
        <p><strong>Jouw antwoord:</strong></p>
        <p>${esc(own.answer || "Leeg antwoord")}</p>
        <p class="small">Wachten op de rest...</p>
      </div>`;
    return;
  }

  if(r.status === "answering"){
    block.innerHTML =
      `<div class="compactInputRow">
        <div class="answerMiniTitle">${esc(r.colorEmoji || "")} ${esc(r.colorName || "")} — ${esc(r.category || "")}</div>
        <input id="compactAnswerInput" class="compactAnswerInput" placeholder="Typ je antwoord">
        <button id="compactSubmitBtn" class="compactSubmit">VERSTUUR</button>
      </div>`;
    const btn = document.getElementById("compactSubmitBtn");
    if(btn){
      btn.addEventListener("click", () => {
        const val = document.getElementById("compactAnswerInput")?.value || "";
        submitCompactAnswer(val);
      });
    }
    return;
  }

  if(r.status === "picking"){
    block.innerHTML = `<div class="answerSubmitted"><h3>🪩 Kleurkiezer</h3><p>De host kiest een kleur...</p></div>`;
    return;
  }

  if(r.status === "ready"){
    block.innerHTML =
      `<div class="answerSubmitted">
        <h3>${esc(r.colorEmoji || "")} ${esc(r.colorName || "")}</h3>
        <p><strong>${esc(r.category || "")}</strong></p>
        <p class="small">Wachten tot muziek start...</p>
      </div>`;
    return;
  }

  block.innerHTML = `<div class="answerSubmitted"><h3>🎮 Wachten</h3><p>Volgende ronde komt eraan.</p></div>`;
}

function submitCompactAnswer(value){
  if(!activeRound?.id) return;
  db.ref("rooms/" + currentRoomCode + "/answers/" + activeRound.id + "/" + currentPlayerId)
    .set({
      answer:value || "",
      submittedAt:firebase.database.ServerValue.TIMESTAMP
    })
    .catch(e => alert("Antwoord opslaan mislukt: " + e.message));
}

function playerColorByIndex(i){const colors=["#FFCC33","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#FFCC33"];return colors[i % colors.length];}

function renderInlineMiniCardV5(player){
  const card = player.card || [];
  const marked = player.marked || {};
  return `<div class="inlineMiniCard">` + card.map((c,i) => {
    const bg = colorHexV5(c);
    const mark = marked[i] || i === 12;
    return `<div class="inlineMiniCell" style="background:${bg};${mark ? "box-shadow:0 0 0 2px #fff inset" : ""}"></div>`;
  }).join("") + `</div>`;
}

function renderCompactScore(room, r){
  const box = document.getElementById("dashScoreboard");
  if(!box) return;

  const players = room.players || {};
  const answers = r?.id && room.answers && room.answers[r.id] ? room.answers[r.id] : {};
  const correct = r?.id && room.correct && room.correct[r.id] ? room.correct[r.id] : {};

  box.innerHTML = Object.entries(players).map(([pid,p], idx) => {
    const hasAnswer = answers[pid] && typeof answers[pid].answer !== "undefined";
    const ans = hasAnswer && String(answers[pid].answer).trim() ? answers[pid].answer : (hasAnswer ? "leeg" : "...");
    const st = r?.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "good" : st === false ? "bad" : "";
    const icon = st === true ? "🐵" : st === false ? "❌" : (hasAnswer ? "📝" : "⏳");
    const open = compactOpenCards[pid];

    return `<div class="compactScoreRow ${cls}" data-pid="${pid}">
      <div class="compactInitial" style="background:${playerColorByIndex(idx)}">${esc((p.name || "?").slice(0,1).toUpperCase())}</div>
      <div class="compactName">${esc(p.name || "Speler")}${pid===currentPlayerId ? " (jij)" : ""}</div>
      <div class="compactAns">${esc(ans)}</div>
      <div class="compactIcon">${icon}</div>
      ${open ? renderInlineMiniCardV5(p) : ""}
    </div>`;
  }).join("") || "Nog geen spelers.";

  box.querySelectorAll(".compactScoreRow").forEach(row => {
    row.addEventListener("click", () => {
      const pid = row.dataset.pid;
      compactOpenCards[pid] = !compactOpenCards[pid];
      renderCompactScore(room, r);
    });
  });
}

function renderCompactCard(room, r){
  const me = room.players?.[currentPlayerId] || {};
  const card = me.card || [];
  const marked = me.marked || {};
  const box = document.getElementById("dashOwnCard");
  const hint = document.getElementById("dashCardHint");
  const status = document.getElementById("dashCardStatus");
  if(!box) return;

  const good = r?.id && room.correct && room.correct[r.id] ? room.correct[r.id][currentPlayerId] === true : false;
  const picked = r?.id && me.lastPickedRound === r.id;
  const canPick = r?.status === "judged" && good && !picked;

  if(hint){
    if(canPick) hint.textContent = `Kies een ${r.colorEmoji || ""} ${r.colorName || ""} vakje`;
    else if(picked) hint.textContent = "🐵 Vakje gekozen";
    else hint.textContent = "Jouw bingokaart";
  }
  if(status){
    if(canPick) status.textContent = "Tik op een geldig kleurvakje";
    else if(me.ready) status.textContent = "🐵 READY voor volgende ronde";
    else status.textContent = "Wachten op ronde";
  }

  box.innerHTML = card.map((c,i) => {
    const bg = colorHexV5(c);
    const isMarked = marked[i] || i === 12;
    const pickable = canPick && c === r.colorKey && c !== "free" && !marked[i];
    return `<div class="compactCell ${c==="free" ? "free" : ""} ${isMarked ? "marked" : ""} ${pickable ? "pickable" : ""}" data-i="${i}" style="background:${bg}">
      ${isMarked ? "🐵" : ""}
    </div>`;
  }).join("");

  box.querySelectorAll(".pickable").forEach(cell => {
    cell.addEventListener("click", () => pickCell(Number(cell.dataset.i)));
  });
}

function renderCompactPicker(r){
  const area = document.getElementById("dashPickerArea");
  if(!area) return;

  if(!r || !r.id){
    area.innerHTML = `<div class="bbOldPickerRemoved">🪩</div><div class="dashCatText">Wachten op host</div>`;
    return;
  }

  if(r.status === "picking"){
    if(r.pickerMode === "wheel"){
      area.innerHTML = `<div class="bbOldPickerRemoved"></div><div class="dashCatText">Kleurenmixer start...</div>`;
    }else{
      area.innerHTML = `<div class="bbOldPickerRemoved">🪩</div><div class="dashCatText">Kleurenmixer start...</div>`;
    }
    return;
  }

  area.innerHTML =
    `<div class="dashColorBig">${esc(r.colorEmoji || "🪩")}</div>
     <div class="dashColorText">${esc(r.colorName || "KLEUR")}</div>
     <div class="dashCatText">${esc(r.category || "Wachten...")}</div>`;
}

function renderCompactDashboard(room){
  const r = room.currentRound || {};
  activeRound = r;
  if(r.id) resetCompactRoundIfNeeded(r.id);

  renderCompactTop(room, r);
  renderCompactAnswer(room, r);
  renderCompactScore(room, r);
  renderCompactCard(room, r);
  renderCompactPicker(r);
}

function listenPlayer(){
  db.ref("rooms/" + currentRoomCode).on("value", s => {
    const room = s.val() || {};
    renderCompactDashboard(room);
    showCompactDashboard();
  });
  listenBingo(currentRoomCode);
}

// Override joinPlayer to go to dashboard
joinPlayer = function(){
  let name = document.getElementById("playerNameInput").value.trim();
  if(!name){
    alert("Vul je naam in.");
    return;
  }

  currentPlayerName = name;
  if(!currentPlayerId) currentPlayerId = "p_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4);

  localStorage.hb_player_id = currentPlayerId;
  localStorage.hb_player_name = name;
  localStorage.hb_player_room = currentRoomCode;

  const ref = db.ref("rooms/" + currentRoomCode + "/players/" + currentPlayerId);
  ref.once("value").then(s => {
    const ex = s.val() || {};
    return ref.update({
      name,
      online:true,
      ready:true,
      joinedAt:ex.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeen:firebase.database.ServerValue.TIMESTAMP,
      card:ex.card || genCard(),
      marked:ex.marked || {}
    });
  }).then(() => {
    ref.child("online").onDisconnect().set(false);
    listenPlayer();
    showCompactDashboard();
  }).catch(e => alert("Meedoen mislukt: " + e.message));
};

// After choosing a cell, ready stays automatic via existing pickCell
// Rewire join button
setTimeout(() => {
  const btn = document.getElementById("joinBtn");
  if(btn){
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", joinPlayer);
  }
}, 300);


/* =========================
   V5 JOIN / ROOM DATA FIX
   Dashboard vult nu direct met spelers + bingokaart
   ========================= */

let compactRoomListenerStarted = false;

function getPlayerRoomFromUrlV5Fix(){
  return (new URLSearchParams(window.location.search).get("room") || currentRoomCode || localStorage.getItem("hb_player_room") || "").toUpperCase();
}

function ensureDbV5Fix(){
  if(!db){
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  }
}

function showCompactDashboardV5Fix(){
  const join = document.getElementById("screenJoin");
  const dash = document.getElementById("screenDashboard");
  if(join) join.classList.add("hidden");
  if(dash) dash.classList.remove("hidden");
}

function renderCompactDashboardSafeV5(room){
  room = room || {};
  const r = room.currentRound || {};
  activeRound = r;

  if(typeof renderCompactTop === "function") renderCompactTop(room, r);
  if(typeof renderCompactAnswer === "function") renderCompactAnswer(room, r);
  if(typeof renderCompactScore === "function") renderCompactScore(room, r);
  if(typeof renderCompactCard === "function") renderCompactCard(room, r);
  if(typeof renderCompactPicker === "function") renderCompactPicker(r);
}

function startCompactRoomListenerV5Fix(){
  ensureDbV5Fix();

  const room = getPlayerRoomFromUrlV5Fix();
  if(!room) return;

  currentRoomCode = room;
  localStorage.setItem("hb_player_room", room);

  if(compactRoomListenerStarted) return;
  compactRoomListenerStarted = true;

  db.ref("rooms/" + room).on("value", snap => {
    const data = snap.val() || {};
    renderCompactDashboardSafeV5(data);
    showCompactDashboardV5Fix();
  });

  if(typeof listenBingo === "function") listenBingo(room);
}

joinPlayer = async function(){
  try{
    ensureDbV5Fix();

    const room = getPlayerRoomFromUrlV5Fix();
    const input = document.getElementById("playerNameInput");
    const name = (input?.value || currentPlayerName || localStorage.getItem("hb_player_name") || "").trim();

    if(!room){
      alert("Geen spelcode gevonden. Open de spelerlink opnieuw.");
      return;
    }

    if(!name){
      alert("Vul je naam in.");
      return;
    }

    currentRoomCode = room;
    currentPlayerName = name;
    currentPlayerId = currentPlayerId || localStorage.getItem("hb_player_id") || ("p_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4));

    localStorage.setItem("hb_player_room", currentRoomCode);
    localStorage.setItem("hb_player_name", currentPlayerName);
    localStorage.setItem("hb_player_id", currentPlayerId);

    const ref = db.ref("rooms/" + currentRoomCode + "/players/" + currentPlayerId);
    const snap = await ref.once("value");
    const ex = snap.val() || {};

    await ref.update({
      name: currentPlayerName,
      online: true,
      ready: true,
      joinedAt: ex.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      card: ex.card || genCard(),
      marked: ex.marked || {}
    });

    ref.child("online").onDisconnect().set(false);
    ref.child("lastSeen").onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);

    const status = document.getElementById("joinStatus");
    if(status) status.textContent = "Je doet mee!";

    showCompactDashboardV5Fix();

    // Direct één keer renderen na join, daarna live listener
    const roomSnap = await db.ref("rooms/" + currentRoomCode).once("value");
    renderCompactDashboardSafeV5(roomSnap.val() || {});
    startCompactRoomListenerV5Fix();

  }catch(e){
    alert("Meedoen mislukt: " + e.message);
    console.error(e);
  }
};

listenPlayer = function(){
  startCompactRoomListenerV5Fix();
};

// Setup player mode extra robuust
function setupPlayerModeV5Fix(){
  const room = getPlayerRoomFromUrlV5Fix();
  if(!room) return;

  document.body.classList.add("playerMode");
  currentRoomCode = room;

  const mode = document.getElementById("modeText");
  if(mode) mode.textContent = "Speler";

  const app = document.getElementById("playerApp");
  if(app) app.classList.remove("hidden");

  const roomLabel = document.getElementById("playerRoomCode");
  if(roomLabel) roomLabel.textContent = room;

  const input = document.getElementById("playerNameInput");
  if(input && localStorage.getItem("hb_player_name")){
    input.value = localStorage.getItem("hb_player_name");
  }

  const savedRoom = localStorage.getItem("hb_player_room");
  const savedPid = localStorage.getItem("hb_player_id");
  const savedName = localStorage.getItem("hb_player_name");

  if(savedRoom === room && savedPid && savedName){
    currentPlayerId = savedPid;
    currentPlayerName = savedName;
    startCompactRoomListenerV5Fix();
  }
}

// Rebind join button hard
function rebindJoinV5Fix(){
  const btn = document.getElementById("joinBtn");
  if(btn){
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", joinPlayer);
  }
}

setTimeout(() => {
  setupPlayerModeV5Fix();
  rebindJoinV5Fix();
}, 300);

setTimeout(() => {
  setupPlayerModeV5Fix();
  rebindJoinV5Fix();
}, 1000);


/* =========================
   V5 DASHBOARD RENDER HARD FIX
   Vult dashboard direct met Firebase data
   ========================= */

let hbDashListenerOn = false;
let hbDashOpenCards = {};
let hbDashCurrentRoom = "";

function hbRoom(){
  return (new URLSearchParams(location.search).get("room") || currentRoomCode || localStorage.getItem("hb_player_room") || "").toUpperCase();
}

function hbPid(){
  return currentPlayerId || localStorage.getItem("hb_player_id") || "";
}

function hbColor(k){return {yellow:"#FFCC33",pink:"#00D4C7",purple:"#FF8A1F",blue:"#7ED957",green:"#FF5A5F",free:"#FFCC33"}[k] || "#333";}

function hbShowDash(){
  document.body.classList.add("playerMode");
  document.getElementById("playerApp")?.classList.remove("hidden");
  document.getElementById("screenJoin")?.classList.add("hidden");
  document.getElementById("screenDashboard")?.classList.remove("hidden");
}

function hbRenderTop(room,r){
  const players = room.players || {};
  const count = Object.keys(players).length;
  const rn = document.getElementById("dashRoundNo");
  const pc = document.getElementById("dashPlayerCount");
  if(rn) rn.textContent = r && r.id ? (String(r.id).slice(-2)) : "-";
  if(pc) pc.textContent = count;

  const timer = document.getElementById("dashTimer");
  if(timer){
    if(r && r.status === "answering" && r.deadlineMs){
      const left = Math.max(0, Math.ceil((r.deadlineMs - Date.now()) / 1000));
      timer.textContent = "00:" + String(left).padStart(2,"0");
    }else if(r && (r.status === "locked" || r.status === "judged")){
      timer.textContent = "00:00";
    }else{
      timer.textContent = "--";
    }
  }
}

function hbRenderAnswer(room,r){
  const block = document.getElementById("dashAnswerBlock");
  if(!block) return;

  const pid = hbPid();
  const own = r && r.id && room.answers && room.answers[r.id] ? room.answers[r.id][pid] : null;

  if(!r || !r.id){
    block.innerHTML = `<div class="answerSubmitted"><h3>🎮 Wachten</h3><p>Host start zo.</p></div>`;
    return;
  }

  if(r.correctAnswer && (r.status === "locked" || r.status === "judged")){
    const a = r.correctAnswer;
    block.innerHTML = `<div class="correctMini">
      <h3>🐵 Juiste antwoord</h3>
      <p>🎵 <strong>${esc(a.track || "-")}</strong></p>
      <p>👤 ${esc(a.artist || "-")}</p>
      <p>📅 ${esc(a.year || "-")}</p>
      <p>💿 ${esc(a.album || "-")}</p>
    </div>`;
    return;
  }

  if(r.status === "answering" && own){
    block.innerHTML = `<div class="answerSubmitted">
      <h3>🔒 Ingeleverd</h3>
      <p><strong>Jouw antwoord:</strong></p>
      <p>${esc(own.answer || "Leeg antwoord")}</p>
      <p class="small">Wachten op de rest...</p>
    </div>`;
    return;
  }

  if(r.status === "answering"){
    block.innerHTML = `<div class="compactInputRow">
      <div class="answerMiniTitle">${esc(r.colorEmoji || "")} ${esc(r.colorName || "")} — ${esc(r.category || "")}</div>
      <input id="compactAnswerInput" class="compactAnswerInput" placeholder="Typ je antwoord">
      <button id="compactSubmitBtn" class="compactSubmit">VERSTUUR</button>
    </div>`;
    document.getElementById("compactSubmitBtn")?.addEventListener("click", () => {
      const val = document.getElementById("compactAnswerInput")?.value || "";
      db.ref("rooms/" + hbRoom() + "/answers/" + r.id + "/" + hbPid()).set({
        answer: val,
        submittedAt: firebase.database.ServerValue.TIMESTAMP
      });
    });
    return;
  }

  if(r.status === "picking"){
    block.innerHTML = `<div class="answerSubmitted"><h3>🪩 Kleurkiezer</h3><p>De host kiest een kleur...</p></div>`;
    return;
  }

  if(r.status === "ready"){
    block.innerHTML = `<div class="answerSubmitted">
      <h3>${esc(r.colorEmoji || "")} ${esc(r.colorName || "")}</h3>
      <p><strong>${esc(r.category || "")}</strong></p>
      <p class="small">Wachten tot muziek start...</p>
    </div>`;
    return;
  }

  block.innerHTML = `<div class="answerSubmitted"><h3>🎮 Wachten</h3><p>Volgende ronde...</p></div>`;
}

function hbMiniCard(p){
  const card = p.card || [];
  const marked = p.marked || {};
  return `<div class="inlineMiniCard">` + card.map((c,i)=>{
    const mark = marked[i] || i === 12;
    return `<div class="inlineMiniCell" style="background:${hbColor(c)};${mark ? "box-shadow:0 0 0 2px #fff inset" : ""}"></div>`;
  }).join("") + `</div>`;
}

function hbRenderScore(room,r){
  const box = document.getElementById("dashScoreboard");
  if(!box) return;

  const players = room.players || {};
  const answers = r && r.id && room.answers && room.answers[r.id] ? room.answers[r.id] : {};
  const correct = r && r.id && room.correct && room.correct[r.id] ? room.correct[r.id] : {};
  const colors = ["#FF8A1F","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#FFCC33"];

  box.innerHTML = Object.entries(players).map(([pid,p],idx)=>{
    const has = answers[pid] && typeof answers[pid].answer !== "undefined";
    const ans = has && String(answers[pid].answer).trim() ? answers[pid].answer : (has ? "leeg" : "...");
    const st = r && r.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "good" : st === false ? "bad" : "";
    const icon = st === true ? "🐵" : st === false ? "❌" : (has ? "📝" : "⏳");
    const open = hbDashOpenCards[pid];

    return `<div class="compactScoreRow ${cls}" data-pid="${pid}">
      <div class="compactInitial" style="background:${colors[idx%colors.length]}">${esc((p.name || "?").slice(0,1).toUpperCase())}</div>
      <div class="compactName">${esc(p.name || "Speler")}${pid===hbPid() ? " (jij)" : ""}</div>
      <div class="compactAns">${esc(ans)}</div>
      <div class="compactIcon">${icon}</div>
      ${open ? hbMiniCard(p) : ""}
    </div>`;
  }).join("") || "Nog geen spelers.";

  box.querySelectorAll(".compactScoreRow").forEach(row => {
    row.addEventListener("click", () => {
      hbDashOpenCards[row.dataset.pid] = !hbDashOpenCards[row.dataset.pid];
      hbRenderScore(room,r);
    });
  });
}

function hbRenderCard(room,r){
  const box = document.getElementById("dashOwnCard");
  const hint = document.getElementById("dashCardHint");
  const status = document.getElementById("dashCardStatus");
  if(!box) return;

  const me = room.players && room.players[hbPid()] ? room.players[hbPid()] : {};
  const card = me.card || [];
  const marked = me.marked || {};
  const good = r && r.id && room.correct && room.correct[r.id] ? room.correct[r.id][hbPid()] === true : false;
  const picked = r && r.id && me.lastPickedRound === r.id;
  const canPick = r && r.status === "judged" && good && !picked;

  if(hint) hint.textContent = canPick ? `Kies ${r.colorEmoji || ""} ${r.colorName || ""}` : "Jouw bingokaart";
  if(status) status.textContent = canPick ? "Tik op een geldig vakje" : (me.ready ? "🐵 READY" : "Wachten");

  box.innerHTML = card.map((c,i)=>{
    const isMarked = marked[i] || i === 12;
    const pickable = canPick && c === r.colorKey && c !== "free" && !marked[i];
    return `<div class="compactCell ${c==="free"?"free":""} ${isMarked?"marked":""} ${pickable?"pickable":""}" data-i="${i}" style="background:${hbColor(c)}">${isMarked ? "🐵" : ""}</div>`;
  }).join("");

  box.querySelectorAll(".pickable").forEach(cell => {
    cell.addEventListener("click", () => pickCell(Number(cell.dataset.i)));
  });
}

function hbRenderPicker(r){
  const area = document.getElementById("dashPickerArea");
  if(!area) return;

  if(!r || !r.id){
    area.innerHTML = `<div class="bbOldPickerRemoved">🪩</div><div class="dashCatText">Wachten op host...</div>`;
    return;
  }

  if(r.status === "picking"){
    if(r.pickerMode === "wheel"){
      area.innerHTML = `<div class="bbOldPickerRemoved"></div><div class="dashCatText">Kleurenmixer start...</div>`;
    }else{
      area.innerHTML = `<div class="bbOldPickerRemoved">🪩</div><div class="dashCatText">Kleurenmixer start...</div>`;
    }
    return;
  }

  area.innerHTML = `<div class="dashColorBig">${esc(r.colorEmoji || "🪩")}</div>
    <div class="dashColorText">${esc(r.colorName || "KLEUR")}</div>
    <div class="dashCatText">${esc(r.category || "Wachten...")}</div>`;
}

function hbRenderAll(room){
  const r = room.currentRound || {};
  activeRound = r;
  hbRenderTop(room,r);
  hbRenderAnswer(room,r);
  hbRenderScore(room,r);
  hbRenderCard(room,r);
  hbRenderPicker(r);
  hbShowDash();
}

function hbStartListener(){
  if(hbDashListenerOn) return;
  const room = hbRoom();
  if(!room) return;
  hbDashListenerOn = true;
  currentRoomCode = room;
  db.ref("rooms/" + room).on("value", snap => hbRenderAll(snap.val() || {}));
}

joinPlayer = async function(){
  try{
    if(!db){
      if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      db = firebase.database();
    }

    const room = hbRoom();
    const name = (document.getElementById("playerNameInput")?.value || localStorage.getItem("hb_player_name") || "").trim();
    if(!room) return alert("Geen spelcode gevonden.");
    if(!name) return alert("Vul je naam in.");

    currentRoomCode = room;
    currentPlayerName = name;
    currentPlayerId = localStorage.getItem("hb_player_id") || currentPlayerId || ("p_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4));

    localStorage.setItem("hb_player_room", room);
    localStorage.setItem("hb_player_name", name);
    localStorage.setItem("hb_player_id", currentPlayerId);

    const ref = db.ref("rooms/" + room + "/players/" + currentPlayerId);
    const s = await ref.once("value");
    const ex = s.val() || {};

    await ref.update({
      name,
      online:true,
      ready:true,
      joinedAt:ex.joinedAt || firebase.database.ServerValue.TIMESTAMP,
      lastSeen:firebase.database.ServerValue.TIMESTAMP,
      card:ex.card || genCard(),
      marked:ex.marked || {}
    });

    ref.child("online").onDisconnect().set(false);
    hbDashListenerOn = false;
    hbStartListener();

  }catch(e){
    alert("Meedoen mislukt: " + e.message);
  }
};

listenPlayer = hbStartListener;

function hbBoot(){
  const room = hbRoom();
  if(!room) return;
  document.body.classList.add("playerMode");
  currentRoomCode = room;

  const mode = document.getElementById("modeText");
  if(mode) mode.textContent = "Speler";

  document.getElementById("playerApp")?.classList.remove("hidden");

  const code = document.getElementById("playerRoomCode");
  if(code) code.textContent = room;

  const name = localStorage.getItem("hb_player_name");
  if(name && document.getElementById("playerNameInput")) document.getElementById("playerNameInput").value = name;

  const savedRoom = localStorage.getItem("hb_player_room");
  const pid = localStorage.getItem("hb_player_id");
  if(savedRoom === room && pid){
    currentPlayerId = pid;
    currentPlayerName = name || "";
    hbStartListener();
  }

  const btn = document.getElementById("joinBtn");
  if(btn){
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", joinPlayer);
  }
}

setTimeout(hbBoot, 200);
setTimeout(hbBoot, 800);
setTimeout(() => {
  const room = hbRoom();
  if(room && hbPid() && !hbDashListenerOn) hbStartListener();
}, 1500);


/* =========================
   V5 SCOREBOARD 2 REGELS + HOST GUARD
   ========================= */

// Host/speler guard: alleen speler-dashboard als URL echt ?room= bevat
function hasPlayerRoomInUrlV5(){
  return !!new URLSearchParams(location.search).get("room");
}

function hostGuardV5(){
  if(hasPlayerRoomInUrlV5()) return;

  document.body.classList.remove("playerMode");

  const host = document.getElementById("hostApp");
  const player = document.getElementById("playerApp");
  const mode = document.getElementById("modeText");

  if(host) host.classList.remove("hidden");
  if(player) player.classList.add("hidden");
  if(mode) mode.textContent = "Host";
}

// Alleen hbBoot uitvoeren als er echt ?room= is
if(typeof hbBoot === "function"){
  const oldHbBootScore2 = hbBoot;
  hbBoot = function(){
    if(!hasPlayerRoomInUrlV5()){
      hostGuardV5();
      return;
    }
    return oldHbBootScore2.apply(this, arguments);
  };
}

// Scoreboard opnieuw renderen: naam regel 1, antwoord regel 2
function hbRenderScoreTwoLines(room,r){
  const box = document.getElementById("dashScoreboard");
  if(!box) return;

  const players = room.players || {};
  const answers = r && r.id && room.answers && room.answers[r.id] ? room.answers[r.id] : {};
  const correct = r && r.id && room.correct && room.correct[r.id] ? room.correct[r.id] : {};
  const colors = ["#FF8A1F","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#FFCC33"];

  box.innerHTML = Object.entries(players).map(([pid,p],idx)=>{
    const has = answers[pid] && typeof answers[pid].answer !== "undefined";
    const ans = has && String(answers[pid].answer).trim() ? answers[pid].answer : (has ? "Leeg antwoord" : "Nog niet ingevuld");
    const st = r && r.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "good" : st === false ? "bad" : "";
    const icon = st === true ? "🐵" : st === false ? "❌" : (has ? "📝" : "⏳");
    const open = (typeof hbDashOpenCards !== "undefined" && hbDashOpenCards[pid]);

    return `<div class="compactScoreRow ${cls}" data-pid="${pid}">
      <div class="compactInitial" style="background:${colors[idx%colors.length]}">${esc((p.name || "?").slice(0,1).toUpperCase())}</div>
      <div class="compactName">${esc(p.name || "Speler")}${pid===(currentPlayerId || localStorage.getItem("hb_player_id")) ? " (jij)" : ""}</div>
      <div class="compactAns">${esc(ans)}</div>
      <div class="compactIcon">${icon}</div>
      ${open && typeof hbMiniCard === "function" ? hbMiniCard(p) : ""}
    </div>`;
  }).join("") || "Nog geen spelers.";

  box.querySelectorAll(".compactScoreRow").forEach(row => {
    row.addEventListener("click", () => {
      if(typeof hbDashOpenCards !== "undefined"){
        hbDashOpenCards[row.dataset.pid] = !hbDashOpenCards[row.dataset.pid];
      }
      hbRenderScoreTwoLines(room,r);
    });
  });
}

// Override beide mogelijke score render functies
hbRenderScore = hbRenderScoreTwoLines;
renderCompactScore = hbRenderScoreTwoLines;

// Als dashboard render bestaat, gebruik daarin automatisch de nieuwe scoreboard functie
if(typeof hbRenderAll === "function"){
  const oldHbRenderAllScore2 = hbRenderAll;
  hbRenderAll = function(room){
    const r = (room || {}).currentRound || {};
    oldHbRenderAllScore2(room);
    hbRenderScoreTwoLines(room || {}, r);
  };
}

setTimeout(hostGuardV5, 300);
setTimeout(hostGuardV5, 1000);


/* =========================
   HARD FIX V5.1
   Timer aftellen + gelijke bingokaart + kroontjes
   ========================= */

let hbLiveTimerIntervalV51 = null;
let hbLastRoomForTimerV51 = null;

function hbCrown(){
  return "🐵";
}

function hbSafeRoomV51(){
  return (new URLSearchParams(location.search).get("room") || currentRoomCode || localStorage.getItem("hb_player_room") || "").toUpperCase();
}

function hbSafePidV51(){
  return currentPlayerId || localStorage.getItem("hb_player_id") || "";
}

function hbSetReadyLabelV51(){
  const rn = document.getElementById("dashRoundNo");
  if(rn) rn.textContent = "";
}

function hbUpdateTimerV51(r){
  const el = document.getElementById("dashTimer");
  if(!el) return;

  if(r && r.status === "answering" && r.deadlineMs){
    const left = Math.max(0, Math.ceil((Number(r.deadlineMs) - Date.now()) / 1000));
    el.textContent = "00:" + String(left).padStart(2,"0");
    return;
  }

  if(r && (r.status === "locked" || r.status === "judged")){
    el.textContent = "00:00";
    return;
  }

  el.textContent = "--";
}

function hbStartLiveTimerV51(r){
  clearInterval(hbLiveTimerIntervalV51);
  hbUpdateTimerV51(r);

  hbLiveTimerIntervalV51 = setInterval(() => {
    hbUpdateTimerV51(r || {});
  }, 250);
}

// Override top render: READY links, timer live rechts/midden
function hbRenderTopV51(room,r){
  const players = room.players || {};
  const pc = document.getElementById("dashPlayerCount");
  if(pc) pc.textContent = Object.keys(players).length;

  hbSetReadyLabelV51();
  hbStartLiveTimerV51(r || {});
}

// Render mini-card met kroontje
function hbMiniCardV51(p){
  const card = p.card || [];
  const marked = p.marked || {};
  return `<div class="inlineMiniCard">` + card.map((c,i)=>{
    const mark = marked[i] || i === 12;
    return `<div class="inlineMiniCell" style="background:${hbColor(c)};${mark ? "box-shadow:0 0 0 2px #fff inset" : ""}">${mark ? hbCrown() : ""}</div>`;
  }).join("") + `</div>`;
}

// Bingo kaart: exact 25 vakjes, allemaal gelijk, gemarkeerd = kroontje
function hbRenderCardV51(room,r){
  const box = document.getElementById("dashOwnCard");
  const hint = document.getElementById("dashCardHint");
  const status = document.getElementById("dashCardStatus");
  if(!box) return;

  const pid = hbSafePidV51();
  const me = room.players && room.players[pid] ? room.players[pid] : {};
  const card = Array.isArray(me.card) ? me.card.slice(0,25) : [];
  const marked = me.marked || {};

  while(card.length < 25) card.push(["yellow","pink","purple","blue","green"][card.length % 5]);

  const good = r && r.id && room.correct && room.correct[r.id] ? room.correct[r.id][pid] === true : false;
  const picked = r && r.id && me.lastPickedRound === r.id;
  const canPick = r && r.status === "judged" && good && !picked;

  if(hint) hint.textContent = canPick ? `Kies ${r.colorEmoji || ""} ${r.colorName || ""}` : "Jouw bingokaart";
  if(status) status.textContent = canPick ? "Tik op een geldig vakje" : (me.ready ? "🐵 READY" : "Wachten");

  box.innerHTML = card.map((c,i)=>{
    const isMarked = marked[i] || i === 12;
    const pickable = canPick && c === r.colorKey && c !== "free" && !marked[i];
    return `<div class="compactCell ${c==="free"?"free":""} ${isMarked?"marked":""} ${pickable?"pickable":""}" data-i="${i}" style="background:${hbColor(c)}">${isMarked ? hbCrown() : ""}</div>`;
  }).join("");

  box.querySelectorAll(".pickable").forEach(cell => {
    cell.addEventListener("click", () => pickCell(Number(cell.dataset.i)));
  });
}

// Scoreboard 2 regels behouden + mini-kaart met kroontjes
function hbRenderScoreV51(room,r){
  const box = document.getElementById("dashScoreboard");
  if(!box) return;

  const players = room.players || {};
  const answers = r && r.id && room.answers && room.answers[r.id] ? room.answers[r.id] : {};
  const correct = r && r.id && room.correct && room.correct[r.id] ? room.correct[r.id] : {};
  const colors = ["#FF8A1F","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#FFCC33"];
  const pidMe = hbSafePidV51();

  box.innerHTML = Object.entries(players).map(([pid,p],idx)=>{
    const has = answers[pid] && typeof answers[pid].answer !== "undefined";
    const ans = has && String(answers[pid].answer).trim() ? answers[pid].answer : (has ? "Leeg antwoord" : "Nog niet ingevuld");
    const st = r && r.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "good" : st === false ? "bad" : "";
    const icon = st === true ? "🐵" : st === false ? "❌" : (has ? "📝" : "⏳");
    const open = (typeof hbDashOpenCards !== "undefined" && hbDashOpenCards[pid]);

    return `<div class="compactScoreRow ${cls}" data-pid="${pid}">
      <div class="compactInitial" style="background:${colors[idx%colors.length]}">${esc((p.name || "?").slice(0,1).toUpperCase())}</div>
      <div class="compactName">${esc(p.name || "Speler")}${pid===pidMe ? " (jij)" : ""}</div>
      <div class="compactAns">${esc(ans)}</div>
      <div class="compactIcon">${icon}</div>
      ${open ? hbMiniCardV51(p) : ""}
    </div>`;
  }).join("") || "Nog geen spelers.";

  box.querySelectorAll(".compactScoreRow").forEach(row => {
    row.addEventListener("click", () => {
      if(typeof hbDashOpenCards !== "undefined"){
        hbDashOpenCards[row.dataset.pid] = !hbDashOpenCards[row.dataset.pid];
      }
      hbRenderScoreV51(room,r);
    });
  });
}

// Dashboard hard opnieuw opbouwen met fixed renderers
function hbRenderAllV51(room){
  room = room || {};
  const r = room.currentRound || {};
  activeRound = r;

  hbRenderTopV51(room,r);

  if(typeof hbRenderAnswer === "function") hbRenderAnswer(room,r);
  else if(typeof renderCompactAnswer === "function") renderCompactAnswer(room,r);

  hbRenderScoreV51(room,r);
  hbRenderCardV51(room,r);

  if(typeof hbRenderPicker === "function") hbRenderPicker(r);
  else if(typeof renderCompactPicker === "function") renderCompactPicker(r);

  if(typeof hbShowDash === "function") hbShowDash();
}

// Override alle bekende render-functies
hbRenderTop = hbRenderTopV51;
renderCompactTop = hbRenderTopV51;
hbMiniCard = hbMiniCardV51;
hbRenderCard = hbRenderCardV51;
renderCompactCard = hbRenderCardV51;
hbRenderScore = hbRenderScoreV51;
renderCompactScore = hbRenderScoreV51;
hbRenderAll = hbRenderAllV51;
renderCompactDashboard = hbRenderAllV51;

// Listener opnieuw koppelen zodat fixed render gebruikt wordt
function hbStartListenerV51(){
  const room = hbSafeRoomV51();
  if(!room || !db) return;

  currentRoomCode = room;

  // Zet oude listener uit door nieuwe ref opnieuw te luisteren met fixed renderer
  db.ref("rooms/" + room).off();
  db.ref("rooms/" + room).on("value", snap => {
    hbRenderAllV51(snap.val() || {});
  });
}

listenPlayer = hbStartListenerV51;

// Boot fixed render als speler
setTimeout(() => {
  if(new URLSearchParams(location.search).get("room")){
    hbStartListenerV51();
  }else{
    document.body.classList.remove("playerMode");
    document.getElementById("hostApp")?.classList.remove("hidden");
    document.getElementById("playerApp")?.classList.add("hidden");
    const mode = document.getElementById("modeText");
    if(mode) mode.textContent = "Host";
  }
}, 600);

setTimeout(() => {
  if(new URLSearchParams(location.search).get("room")){
    hbStartListenerV51();
  }
}, 1500);


/* =========================
   V5.2 SPELERSNAAM + EERST MEEDOEN
   - Linksboven = spelersnaam
   - Dashboard pas na klikken op Meedoen
   ========================= */

let hbHasClickedJoinV52 = false;

function hbPlayerNameV52(){
  return (
    currentPlayerName ||
    localStorage.getItem("hb_player_name") ||
    document.getElementById("playerNameInput")?.value ||
    "Speler"
  ).trim();
}

function hbSetNameTopV52(){ return; }

// Override top render: linksboven naam, timer blijft live
function hbRenderTopV52(room,r){
  const players = room.players || {};
  const pc = document.getElementById("dashPlayerCount");
  if(pc) pc.textContent = Object.keys(players).length;

  hbSetNameTopV52();

  if(typeof hbStartLiveTimerV51 === "function"){
    hbStartLiveTimerV51(r || {});
  }else if(typeof hbUpdateTimerV51 === "function"){
    hbUpdateTimerV51(r || {});
  }
}

// Dashboard alleen tonen als speler echt op Meedoen heeft geklikt
function hbShowJoinOnlyV52(){
  document.body.classList.add("playerMode");
  document.getElementById("playerApp")?.classList.remove("hidden");
  document.getElementById("screenJoin")?.classList.remove("hidden");
  document.getElementById("screenDashboard")?.classList.add("hidden");
}

function hbShowDashboardOnlyV52(){
  document.body.classList.add("playerMode");
  document.getElementById("playerApp")?.classList.remove("hidden");
  document.getElementById("screenJoin")?.classList.add("hidden");
  document.getElementById("screenDashboard")?.classList.remove("hidden");
}

// Override dashboard show functies zodat ze niet vanzelf openen vóór Meedoen
hbShowDash = function(){
  if(!hbHasClickedJoinV52){
    hbShowJoinOnlyV52();
    return;
  }
  hbShowDashboardOnlyV52();
};

showCompactDashboard = hbShowDash;

// Override render-all zodat dashboard niet zichtbaar wordt voor join
if(typeof hbRenderAllV51 === "function"){
  const oldHbRenderAllV51V52 = hbRenderAllV51;
  hbRenderAllV51 = function(room){
    oldHbRenderAllV51V52(room || {});
    hbSetNameTopV52();
    if(!hbHasClickedJoinV52) hbShowJoinOnlyV52();
  };
  hbRenderAll = hbRenderAllV51;
}

// Top render overrides
hbRenderTop = hbRenderTopV52;
renderCompactTop = hbRenderTopV52;

// Override joinPlayer: pas na klik dashboard openen
const oldJoinPlayerV52 = joinPlayer;
joinPlayer = async function(){
  hbHasClickedJoinV52 = true;

  const input = document.getElementById("playerNameInput");
  const name = (input?.value || "").trim();

  if(!name){
    hbHasClickedJoinV52 = false;
    alert("Vul eerst je naam in.");
    return;
  }

  currentPlayerName = name;
  localStorage.setItem("hb_player_name", name);

  await oldJoinPlayerV52.apply(this, arguments);

  hbSetNameTopV52();
  hbShowDashboardOnlyV52();
};

// Boot: spelerlink opent altijd eerst joinscherm
function hbBootV52(){
  const room = new URLSearchParams(location.search).get("room");

  if(!room){
    document.body.classList.remove("playerMode");
    document.getElementById("hostApp")?.classList.remove("hidden");
    document.getElementById("playerApp")?.classList.add("hidden");
    const mode = document.getElementById("modeText");
    if(mode) mode.textContent = "Host";
    return;
  }

  document.body.classList.add("playerMode");
  currentRoomCode = room.toUpperCase();

  const mode = document.getElementById("modeText");
  if(mode) mode.textContent = "Speler";

  const app = document.getElementById("playerApp");
  if(app) app.classList.remove("hidden");

  const code = document.getElementById("playerRoomCode");
  if(code) code.textContent = currentRoomCode;

  const input = document.getElementById("playerNameInput");
  const savedName = localStorage.getItem("hb_player_name");
  if(input && savedName) input.value = savedName;

  hbHasClickedJoinV52 = false;
  hbShowJoinOnlyV52();

  const btn = document.getElementById("joinBtn");
  if(btn){
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener("click", joinPlayer);
  }
}

// Hard override oude boot-timers
setTimeout(hbBootV52, 50);
setTimeout(hbBootV52, 500);
setTimeout(hbBootV52, 1200);

setTimeout(() => {
  const rn = document.getElementById("dashRoundNo");
  if(rn){
    const n = (window.currentPlayerName || localStorage.getItem("hb_player_name") || "").trim();
    if(n) rn.textContent = n;
  }
}, 1000);


/* =========================
   HARD FIX: alleen naam linksboven, geen 'Ronde'
   ========================= */

function forceNameOnlyTop(){ return; }

// overschrijf top-render nogmaals
hbRenderTop = function(room,r){
  const players = room?.players || {};
  const pc = document.getElementById("dashPlayerCount");
  if(pc) pc.textContent = Object.keys(players).length;

  forceNameOnlyTop();

  if(typeof hbStartLiveTimerV51 === "function"){
    hbStartLiveTimerV51(r || {});
  }
};

renderCompactTop = hbRenderTop;

// forceer meerdere keren, ook na Firebase-renders






/* =========================
   COMPACT HOST V6 JS
   - QR zichtbaar in kamerblok
   - Host blijft host zonder ?room=
   - UI compacter zonder host functies te breken
   ========================= */

function hostIsHostV6(){
  return !new URLSearchParams(location.search).get("room");
}

function makeQrUrlV6(text){
  return "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + encodeURIComponent(text || "");
}

function compactHostGuardV6(){
  if(!hostIsHostV6()) return;

  document.body.classList.remove("playerMode");

  const host = document.getElementById("hostApp");
  const player = document.getElementById("playerApp");
  const mode = document.getElementById("modeText");

  if(host) host.classList.remove("hidden");
  if(player) player.classList.add("hidden");
  if(mode) mode.textContent = "Host";
}

function enhanceRoomBoxV6(){
  if(!hostIsHostV6()) return;

  const roomBox = document.getElementById("roomBox");
  const roomCodeEl = document.getElementById("roomCodeText");
  const joinLinkEl = document.getElementById("joinLink");

  if(!roomBox || !roomCodeEl || !joinLinkEl) return;

  const code = roomCodeEl.textContent.trim();
  const link = joinLinkEl.value || joinLinkEl.getAttribute("value") || "";

  if(!code || roomBox.dataset.compactQrCode === code) return;

  roomBox.dataset.compactQrCode = code;

  roomBox.innerHTML = `
    <div class="hostQrCompact">
      <div>
        <div class="small">SPELCODE</div>
        <div class="codeBig">${esc(code)}</div>
        <div class="copyMini">${esc(link)}</div>
      </div>
      <img alt="QR code" src="${makeQrUrlV6(link)}">
    </div>
  `;
}

function observeHostRoomV6(){
  if(!hostIsHostV6()) return;

  const roomBox = document.getElementById("roomBox");
  if(!roomBox || roomBox.dataset.observedV6 === "1") return;
  roomBox.dataset.observedV6 = "1";

  const obs = new MutationObserver(() => enhanceRoomBoxV6());
  obs.observe(roomBox, {childList:true, subtree:true, characterData:true, attributes:true});
}

function compactHostBootV6(){
  compactHostGuardV6();
  observeHostRoomV6();
  enhanceRoomBoxV6();

  // Maak eerste panelen visueel compacter met badges
  const host = document.getElementById("hostApp");
  if(!host || host.dataset.compactV6 === "1") return;
  host.dataset.compactV6 = "1";

  const spotifyPanel = host.querySelector(".panel:nth-of-type(1)");
  if(spotifyPanel && !spotifyPanel.querySelector(".hostMiniBadge")){
    const badge = document.createElement("div");
    badge.className = "hostMiniRow";
    badge.innerHTML = `<span class="hostMiniBadge">🟢 Spotify</span><span class="hostMiniBadge">🎵 Player</span>`;
    spotifyPanel.insertBefore(badge, spotifyPanel.firstChild.nextSibling);
  }

  const csvPanel = host.querySelector(".panel:nth-of-type(2)");
  if(csvPanel && !csvPanel.querySelector(".hostMiniBadge")){
    const badge = document.createElement("div");
    badge.className = "hostMiniRow";
    badge.innerHTML = `<span class="hostMiniBadge">📂 CSV</span><span class="hostMiniBadge">🎶 Bibliotheek</span>`;
    csvPanel.insertBefore(badge, csvPanel.firstChild.nextSibling);
  }
}

// showRoom uitbreiden zodat QR direct wordt vernieuwd
if(typeof showRoom === "function"){
  const oldShowRoomV6 = showRoom;
  showRoom = function(){
    oldShowRoomV6.apply(this, arguments);
    setTimeout(enhanceRoomBoxV6, 100);
    setTimeout(enhanceRoomBoxV6, 500);
  };
}

setTimeout(compactHostBootV6, 100);
setTimeout(compactHostBootV6, 700);
setInterval(() => {
  if(hostIsHostV6()) compactHostBootV6();
}, 2000);


/* =========================
   HOST CLEAN START + QR FIX
   - Host opent schoon
   - QR altijd zichtbaar na nieuwe kamer
   ========================= */

let hostHasCreatedRoomCleanQr = false;

function hostHasRoomParamCleanQr(){
  return !!new URLSearchParams(location.search).get("room");
}

function qrUrlCleanQr(text){
  return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(text || "");
}

function cleanHostOpeningState(){
  if(hostHasRoomParamCleanQr()) return;

  document.body.classList.remove("playerMode");

  const host = document.getElementById("hostApp");
  const player = document.getElementById("playerApp");
  const mode = document.getElementById("modeText");

  if(host) host.classList.remove("hidden");
  if(player) player.classList.add("hidden");
  if(mode) mode.textContent = "Host";

  // Belangrijk: geen oude room automatisch heropenen
  localStorage.removeItem("hb_host_room");
  currentRoomCode = "";
  currentRoundId = "";
  currentTrack = null;

  const roomBox = document.getElementById("roomBox");
  if(roomBox){
    roomBox.classList.add("hidden");
    roomBox.classList.remove("hostRoomQrBox");
    roomBox.innerHTML = `<div class="hostCleanHint">Maak een nieuwe kamer om spelcode en QR-code te tonen.</div>`;
  }

  const hostPlayers = document.getElementById("hostPlayers");
  if(hostPlayers) hostPlayers.innerHTML = "Nog geen spelers.";

  const hostScorePanel = document.getElementById("hostScorePanel");
  if(hostScorePanel) hostScorePanel.classList.add("hidden");

  const hostScoreboard = document.getElementById("hostScoreboard");
  if(hostScoreboard) hostScoreboard.innerHTML = "";

  const hostRoundInfo = document.getElementById("hostRoundInfo");
  if(hostRoundInfo) hostRoundInfo.textContent = "";

  const hostAnswerArea = document.getElementById("hostAnswerArea");
  if(hostAnswerArea) hostAnswerArea.innerHTML = "";

  const hostBingoPanel = document.getElementById("hostBingoPanel");
  if(hostBingoPanel) hostBingoPanel.classList.add("hidden");

  const picker = document.getElementById("hostPickerArea") || document.getElementById("pickerArea");
  if(picker) picker.innerHTML = "🪩<br>Klaar om te spelen";

  const status = document.getElementById("hostStatus");
  if(status) status.textContent = "Maak een nieuwe kamer om te starten.";

  const start = document.getElementById("startRoundBtn");
  if(start){
    start.disabled = true;
    start.textContent = "⏳ Maak eerst een kamer";
  }
}

function renderHostQrRoom(code){
  const roomBox = document.getElementById("roomBox");
  if(!roomBox) return;

  const link = location.origin + location.pathname + "?room=" + code;

  roomBox.classList.remove("hidden");
  roomBox.classList.add("hostRoomQrBox");

  roomBox.innerHTML = `
    <div class="hostQrLayout">
      <div>
        <div class="hostQrLabel">SPELCODE</div>
        <div class="hostQrCodeBig">${esc(code)}</div>
        <div class="hostQrLink">${esc(link)}</div>
      </div>
      <img class="hostQrImg" alt="QR code" src="${qrUrlCleanQr(link)}">
    </div>
  `;
}

function createCleanRoomAndQr(){
  const code = typeof roomCode === "function"
    ? roomCode()
    : Math.random().toString(36).slice(2,6).toUpperCase();

  currentRoomCode = code;
  hostHasCreatedRoomCleanQr = true;

  const categories = typeof getCats === "function"
    ? getCats()
    : {};

  const roomData = {
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    categories: categories,
    currentRound: null,
    players: null,
    answers: null,
    correct: null,
    bingos: null
  };

  db.ref("rooms/" + code).set(roomData).then(() => {
    localStorage.setItem("hb_host_room", code);

    renderHostQrRoom(code);

    if(typeof listenHost === "function") listenHost(code);
    if(typeof listenBingo === "function") listenBingo(code);

    const status = document.getElementById("hostStatus");
    if(status) status.textContent = "Nieuwe kamer klaar. Laat spelers de QR-code scannen.";

    const start = document.getElementById("startRoundBtn");
    if(start){
      start.disabled = true;
      start.textContent = "⏳ Wachten op READY";
    }

    const hostScorePanel = document.getElementById("hostScorePanel");
    if(hostScorePanel) hostScorePanel.classList.add("hidden");

    const hostScoreboard = document.getElementById("hostScoreboard");
    if(hostScoreboard) hostScoreboard.innerHTML = "";

  }).catch(e => alert("Nieuwe kamer maken mislukt: " + e.message));
}

// Override oude restoreHost: niet automatisch oude kamer openen
restoreHost = function(){
  cleanHostOpeningState();
};

// Override createRoom / newRoom button
createRoom = createCleanRoomAndQr;

function rebindNewRoomCleanQr(){
  const btn = document.getElementById("newRoomBtn");
  if(btn && btn.dataset.cleanQrBound !== "1"){
    btn.dataset.cleanQrBound = "1";
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.dataset.cleanQrBound = "1";
    fresh.addEventListener("click", createCleanRoomAndQr);
  }
}

// Force host clean alleen vóórdat er een nieuwe kamer gemaakt is
function bootHostCleanQr(){
  if(hostHasRoomParamCleanQr()) return;
  if(!hostHasCreatedRoomCleanQr) cleanHostOpeningState();
  rebindNewRoomCleanQr();
}

setTimeout(bootHostCleanQr, 50);
setTimeout(bootHostCleanQr, 500);
setTimeout(bootHostCleanQr, 1200);


/* =========================
   SPOTIFY DEVICE NOT FOUND FIX
   ========================= */

async function waitForSpotifyDeviceFixed(timeoutMs = 5000){
  const start = Date.now();

  while(Date.now() - start < timeoutMs){
    if(deviceId) return deviceId;
    await new Promise(r => setTimeout(r, 250));
  }

  return deviceId || "";
}

async function ensureSpotifyDeviceFixed(){
  const token = await getToken();

  if(!token){
    alert("Login eerst met Spotify.");
    return "";
  }

  if(!player || !deviceId){
    try{
      await activatePlayer();
    }catch(e){
      console.warn("activatePlayer error", e);
    }
  }

  const id = await waitForSpotifyDeviceFixed(6000);

  if(!id){
    alert("Spotify device niet gevonden. Klik één keer op 'Activeer Spotify-speler' en probeer opnieuw.");
    return "";
  }

  try{
    await api("https://api.spotify.com/v1/me/player", {
      method:"PUT",
      body:JSON.stringify({
        device_ids:[id],
        play:false
      })
    });
  }catch(e){
    console.warn("Transfer playback mislukt:", e);
  }

  return id;
}

playHidden = async function(){
  try{
    if(!currentTrack){
      alert("Geen nummer gekozen. Druk eerst op START RONDE.");
      return;
    }

    const playBtn = document.getElementById("playBtn");
    if(playBtn){
      playBtn.disabled = true;
      playBtn.textContent = "🎵 Spotify activeren...";
    }

    const id = await ensureSpotifyDeviceFixed();

    if(!id){
      if(playBtn){
        playBtn.disabled = false;
        playBtn.textContent = "🎵 Speel verborgen nummer";
      }
      return;
    }

    if(playBtn) playBtn.textContent = "🎵 Nummer speelt...";

    const dur = (Number(document.getElementById("duration")?.value) || 20) * 1000;
    let pos = 0;

    const randomStart = document.getElementById("randomStart");
    if(randomStart && randomStart.checked && currentTrack.duration_ms > dur + 40000){
      const max = Math.max(0, currentTrack.duration_ms - dur - 5000);
      pos = Math.floor(20000 + Math.random() * Math.max(1, max - 20000));
    }

    await api(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(id)}`,{
      method:"PUT",
      body:JSON.stringify({
        uris:[currentTrack.uri],
        position_ms:pos
      })
    });

    const room = currentRoomCode || localStorage.getItem("hb_host_room");
    const deadline = Date.now() + dur;

    await db.ref("rooms/" + room + "/currentRound").update({
      status:"answering",
      deadlineMs:deadline,
      musicStartedAt:firebase.database.ServerValue.TIMESTAMP
    });

    const stopBtn = document.getElementById("stopBtn");
    if(stopBtn) stopBtn.disabled = false;

    clearTimeout(lockTimer);
    lockTimer = setTimeout(lockRound, dur);

    clearTimeout(stopTimer);
    stopTimer = setTimeout(stopPlayback, dur);

    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Muziek speelt. Spelers kunnen nu antwoorden.";

  }catch(e){
    const msg = String(e.message || e);

    if(msg.toLowerCase().includes("device") || msg.toLowerCase().includes("not found")){
      deviceId = "";
      alert("Spotify device niet gevonden. Klik op 'Activeer Spotify-speler' en druk daarna opnieuw op 'Speel verborgen nummer'.");
    }else{
      alert("Afspelen mislukt: " + msg);
    }

    const playBtn = document.getElementById("playBtn");
    if(playBtn){
      playBtn.disabled = false;
      playBtn.textContent = "🎵 Speel verborgen nummer";
    }
  }
};

function rebindSpotifyPlayFixed(){
  const btn = document.getElementById("playBtn");
  if(btn && btn.dataset.spotifyDeviceFix !== "1"){
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.dataset.spotifyDeviceFix = "1";
    fresh.addEventListener("click", playHidden);
  }
}

setTimeout(rebindSpotifyPlayFixed, 500);
setTimeout(rebindSpotifyPlayFixed, 1500);


/* =========================
   V7C FOUT ANTWOORD = AUTO READY
   Fix: ronde blijft niet hangen als iemand fout is
   ========================= */

scoreboardClick = function(e){
  const btn = e.target.closest("button[data-pid]");
  if(!btn) return;

  e.preventDefault();

  const pid = btn.dataset.pid;
  const good = btn.dataset.good === "true";
  const room = currentRoomCode || localStorage.getItem("hb_host_room");

  db.ref("rooms/" + room + "/currentRound").once("value").then(s => {
    const r = s.val() || {};
    if(!r.id) throw Error("Geen actieve ronde.");

    const updates = {};
    updates["rooms/" + room + "/correct/" + r.id + "/" + pid] = good;

    // Belangrijk:
    // FOUT = speler hoeft geen vakje te kiezen, dus direct ready.
    // GOED = speler moet eerst bingovakje kiezen, dus nog niet ready.
    updates["rooms/" + room + "/players/" + pid + "/ready"] = good ? false : true;

    return db.ref().update(updates);
  }).then(() => {
    const st = document.getElementById("hostStatus");
    if(st) st.textContent = good
      ? "🐵 Goed antwoord opgeslagen. Speler moet een vakje kiezen."
      : "❌ Fout antwoord opgeslagen. Speler is automatisch READY.";
  }).catch(err => alert(err.message));
};

publishResults = function(){
  const room = currentRoomCode || localStorage.getItem("hb_host_room");

  db.ref("rooms/" + room).once("value").then(s => {
    const data = s.val() || {};
    const r = data.currentRound || {};
    if(!r.id) throw Error("Geen actieve ronde.");

    const players = data.players || {};
    const correct = data.correct && data.correct[r.id] ? data.correct[r.id] : {};

    const updates = {};
    updates["rooms/" + room + "/currentRound/status"] = "judged";

    Object.keys(players).forEach(pid => {
      // Alleen spelers die goed zijn moeten nog een bingovakje kiezen.
      // Iedereen die fout is of niet beoordeeld is, wordt READY gezet,
      // zodat de ronde niet blijft hangen.
      updates["rooms/" + room + "/players/" + pid + "/ready"] = correct[pid] === true ? false : true;
    });

    return db.ref().update(updates);
  }).then(() => {
    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Resultaten verzonden. Foute spelers zijn automatisch READY. Goede spelers kiezen een vakje.";
  }).catch(err => alert(err.message));
};

// Rebind host score/publish knoppen zodat ze zeker de nieuwe functies gebruiken
function rebindV7CFoutReady(){
  const board = document.getElementById("hostScoreboard");
  if(board && board.dataset.v7cBound !== "1"){
    board.dataset.v7cBound = "1";
    board.addEventListener("click", scoreboardClick);
  }

  const publish = document.getElementById("publishBtn");
  if(publish && publish.dataset.v7cBound !== "1"){
    const fresh = publish.cloneNode(true);
    publish.parentNode.replaceChild(fresh, publish);
    fresh.dataset.v7cBound = "1";
    fresh.addEventListener("click", publishResults);
  }
}

setTimeout(rebindV7CFoutReady, 500);
setTimeout(rebindV7CFoutReady, 1500);


/* =========================
   V7D SPELER TOP: SPELCODE + NAAM OP 2 REGELS
   Geen knipperen meer
   ========================= */

function hbPlayerTopTwoLinesV7D(){ return; }

// Override bekende top renderers zodat niemand alleen naam terugzet
if(typeof hbRenderTop === "function" && !window.__hbTopV7D){
  window.__hbTopV7D = true;
  const oldHbRenderTopV7D = hbRenderTop;
  hbRenderTop = function(room,r){
    const res = oldHbRenderTopV7D.apply(this, arguments);
    hbPlayerTopTwoLinesV7D();
    return res;
  };
}

if(typeof renderCompactTop === "function" && !window.__compactTopV7D){
  window.__compactTopV7D = true;
  const oldRenderCompactTopV7D = renderCompactTop;
  renderCompactTop = function(room,r){
    const res = oldRenderCompactTopV7D.apply(this, arguments);
    hbPlayerTopTwoLinesV7D();
    return res;
  };
}

// Forceer rustig, maar niet zichtbaar knipperend omdat beide teksten samen staan





/* =========================
   V7E LINKS BOVEN = ALLEEN PLAIN SPELCODE
   ========================= */

function hbPlainRoomCodeTopV7E(){
  const room = (
    new URLSearchParams(location.search).get("room") ||
    currentRoomCode ||
    localStorage.getItem("hb_player_room") ||
    ""
  ).toUpperCase();

  if(!room) return;

  const pill = document.querySelector("body.playerMode .dashTop .dashPill:first-child");
  if(pill && pill.textContent !== room){
    pill.textContent = room;
  }

  const old = document.getElementById("dashRoundNo");
  if(old && old.textContent !== room){
    old.textContent = room;
  }
}

// Override renderers: altijd na render alleen roomcode terugzetten
if(typeof hbRenderTop === "function" && !window.__hbTopV7E){
  window.__hbTopV7E = true;
  const oldHbRenderTopV7E = hbRenderTop;
  hbRenderTop = function(room,r){
    const res = oldHbRenderTopV7E.apply(this, arguments);
    hbPlainRoomCodeTopV7E();
    return res;
  };
}

if(typeof renderCompactTop === "function" && !window.__compactTopV7E){
  window.__compactTopV7E = true;
  const oldRenderCompactTopV7E = renderCompactTop;
  renderCompactTop = function(room,r){
    const res = oldRenderCompactTopV7E.apply(this, arguments);
    hbPlainRoomCodeTopV7E();
    return res;
  };
}

// Rustige hard force: 1x per 2 sec, alleen plain tekst






/* =========================
   V7G SCHONE FIX: linksboven alleen spelcode
   Geen naam, geen wisselen, geen CSS-verbergen.
   ========================= */

function hbTopLeftRoomCodeOnlyV7G(){
  const room = (
    new URLSearchParams(location.search).get("room") ||
    currentRoomCode ||
    localStorage.getItem("hb_player_room") ||
    ""
  ).toUpperCase();

  if(!room) return;

  const pill = document.querySelector("body.playerMode .dashTop .dashPill:first-child");
  if(!pill) return;

  // Echte bron herstellen: bestaande inhoud vervangen door plain text.
  pill.textContent = room;
}

// Override alle bekende top-renderfuncties op één nette manier.
if(typeof hbRenderTop === "function"){
  hbRenderTop = function(room,r){
    const players = room?.players || {};
    const pc = document.getElementById("dashPlayerCount");
    if(pc) pc.textContent = Object.keys(players).length;

    if(typeof hbStartLiveTimerV51 === "function"){
      hbStartLiveTimerV51(r || {});
    }else if(typeof hbUpdateTimerV51 === "function"){
      hbUpdateTimerV51(r || {});
    }

    hbTopLeftRoomCodeOnlyV7G();
  };
}

if(typeof renderCompactTop === "function"){
  renderCompactTop = function(room,r){
    const players = room?.players || {};
    const pc = document.getElementById("dashPlayerCount");
    if(pc) pc.textContent = Object.keys(players).length;

    if(typeof hbStartLiveTimerV51 === "function"){
      hbStartLiveTimerV51(r || {});
    }else if(typeof hbUpdateTimerV51 === "function"){
      hbUpdateTimerV51(r || {});
    }

    hbTopLeftRoomCodeOnlyV7G();
  };
}

// Alleen als fallback, rustig en zonder naam.
setTimeout(hbTopLeftRoomCodeOnlyV7G, 100);
setTimeout(hbTopLeftRoomCodeOnlyV7G, 800);
setTimeout(hbTopLeftRoomCodeOnlyV7G, 1600);


/* =========================
   V7I HOST PICKER POPUP
   Grote host-popup bij kleurkiezer
   ========================= */

function hbHostPickerPopupEnsureV7I(){
  let pop = document.getElementById("hostPickerPopupV7I");
  if(pop) return pop;

  pop = document.createElement("div");
  pop.id = "hostPickerPopupV7I";
  pop.className = "hostPickerPopup hidden";
  pop.innerHTML = `<div class="hostPickerPopupCard" id="hostPickerPopupCardV7I"></div>`;
  document.body.appendChild(pop);
  return pop;
}

function hbHostPickerPopupShowV7I(html){
  const pop = hbHostPickerPopupEnsureV7I();
  const card = document.getElementById("hostPickerPopupCardV7I");
  if(card) card.innerHTML = html;
  pop.classList.remove("hidden");
}

function hbHostPickerPopupHideV7I(){
  const pop = document.getElementById("hostPickerPopupV7I");
  if(pop) pop.classList.add("hidden");
}

function hbHostPickerPopupPickingV7I(mode){
  const inner = typeof sharedPickerHTML === "function"
    ? sharedPickerHTML(mode)
    : (typeof pickerHTML === "function" ? pickerHTML(mode) : `<div class="bbOldPickerRemoved">🪩</div><div class="pickerTitle">Kleurenmixer start...</div>`);

  hbHostPickerPopupShowV7I(`
    <div class="hostPickerPopupTitle">Kleurkiezer draait...</div>
    ${inner}
    <div class="hostPickerPopupSub">Even wachten...</div>
  `);
}

function hbHostPickerPopupResultV7I(color, cat){
  hbHostPickerPopupShowV7I(`
    <div class="hostPickerPopupTitle">Deze ronde wordt:</div>
    <div class="hostPickerPopupColor">${esc(color.emoji || "")}<br>${esc(color.name || "")}</div>
    <div class="hostPickerPopupCategory">${esc(cat || "Geen categorie")}</div>
    <div class="hostPickerPopupSub">Maak je klaar om het nummer te starten</div>
  `);
}

// Override startRoundVisual met popup, maar behoud bestaande Firebase/player flow
startRoundVisual = function(room){
  document.getElementById("hostAnswerArea").innerHTML = "";
  document.getElementById("playBtn").disabled = true;
  document.getElementById("showAnswerBtn").disabled = true;
  document.getElementById("playBtn").textContent = "🎵 Speel verborgen nummer";

  const mode = Math.random() < .5 ? "disco" : "wheel";
  const pickerMarkup = typeof sharedPickerHTML === "function"
    ? sharedPickerHTML(mode)
    : pickerHTML(mode);

  // Klein vak blijft gewoon normaal, popup is groot
  document.getElementById("hostPickerArea").innerHTML = pickerMarkup;
  hbHostPickerPopupPickingV7I(mode);

  currentRoundId = "r_" + Date.now();

  db.ref("rooms/" + room + "/currentRound").set({
    id: currentRoundId,
    status: "picking",
    pickerMode: mode,
    pickerMarkup: pickerMarkup,
    pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
    seconds: Number(document.getElementById("duration").value) || 20
  });

  setTimeout(() => {
    flash();

    const color = pick(COLORS);
    const cat = document.getElementById(color.input).value || "Geen categorie";

    document.getElementById("hostPickerArea").innerHTML =
      `<div class="colorDisplay">${color.emoji}<br>${color.name}</div>
       <div class="categoryDisplay">${esc(cat)}</div>`;

    hbHostPickerPopupResultV7I(color, cat);

    const round = {
      id: currentRoundId,
      status: "ready",
      pickerMode: mode,
      pickerMarkup: pickerMarkup,
      colorKey: color.key,
      colorName: color.name,
      colorEmoji: color.emoji,
      category: cat,
      seconds: Number(document.getElementById("duration").value) || 20
    };

    db.ref("rooms/" + room + "/currentRound").set(round);

    document.getElementById("playBtn").disabled = false;
    document.getElementById("showAnswerBtn").disabled = false;
    document.getElementById("hostScorePanel").classList.remove("hidden");

    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Kleur bekend. Klik nu op Speel verborgen nummer.";

    setTimeout(hbHostPickerPopupHideV7I, 3000);
  }, 3500);
};

/* V8 RANDOM SHOW ANIMATIONS */
const HB_SHOW_ANIMS_V8 = ["disco","wheel","vinyl","box","dart","penalty","slot","dice","mic"];

function hbAnimLabelV8(mode){
  return {
    disco:"🪩 Discobal", wheel:"🎡 Kleurenrad", vinyl:"💿 Vinyl Picker",
    box:"🎁 Mystery Box", dart:"🎯 Dartbord", penalty:"⚽ Strafschop",
    slot:"🎰 Slotmachine", dice:"🎲 Dobbelsteen", mic:"🎤 Microfoon Toss"
  }[mode] || "🎉 Showmoment";
}

function hbGoalGridV8(){
  const keys = ["yellow","pink","purple","blue","green","purple","blue","yellow","green","pink","green","yellow","pink","purple","blue"];
  return `<div class="goalGrid">${keys.map(k=>`<div class="goalCell" style="background:${COLORS.find(c=>c.key===k)?.hex || "#fff"}"></div>`).join("")}<div class="goalBall">⚽</div></div>`;
}

function hbShowAnimHTMLV8(mode){
  if(mode==="wheel") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div><div class="showPointer"></div><div class="showWheel"></div><div class="showAnimSub">Het rad draait...</div></div>`;
  if(mode==="vinyl") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div><div class="showVinyl"></div><div class="showAnimSub">De plaat kiest de categorie...</div></div>`;
  if(mode==="box") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div><div class="showBox">🎁</div><div class="showAnimTitle">Wat zit erin?</div></div>`;
  if(mode==="dart") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div><div class="showDartBoard"></div><div class="showAnimSub">De pijl vliegt...</div></div>`;
  if(mode==="penalty") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div>${hbGoalGridV8()}<div class="showAnimSub">Schiet in een kleurvak...</div></div>`;
  if(mode==="slot") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div><div class="slotMachine"><div class="slotReel">🟨</div><div class="slotReel">🟪</div><div class="slotReel">🟩</div></div><div class="showAnimSub">De rollen draaien...</div></div>`;
  if(mode==="dice") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div><div class="showDice">🎲</div><div class="showAnimTitle">Rollen maar...</div></div>`;
  if(mode==="mic") return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)}</div><div class="showMic">🎤</div><div class="showAnimTitle">Microfoon toss...</div></div>`;
  return `<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8("disco")}</div><div class="showAnimBig">🪩</div><div class="showAnimTitle">Kleurenmixer start...</div></div>`;
}

function hbHostPickerPopupPickingV8(mode){
  hbHostPickerPopupShowV7I(hbShowAnimHTMLV8(mode));
}

function hbHostPickerPopupResultV8(color, cat, mode){
  hbHostPickerPopupShowV7I(`<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8(mode)} koos:</div><div class="showResultColor">${esc(color.emoji || "")}</div><div class="showResultName">${esc(color.name || "")}</div><div class="showResultCat">${esc(cat || "Geen categorie")}</div><div class="hostPickerPopupSub">Maak je klaar om het nummer te starten</div></div>`);
}

startRoundVisual = function(room){
  document.getElementById("hostAnswerArea").innerHTML = "";
  document.getElementById("playBtn").disabled = true;
  document.getElementById("showAnswerBtn").disabled = true;
  document.getElementById("playBtn").textContent = "🎵 Speel verborgen nummer";

  const showMode = pick(HB_SHOW_ANIMS_V8);
  const pickerMarkup = hbShowAnimHTMLV8(showMode);
  document.getElementById("hostPickerArea").innerHTML = `<div class="pickerTitle">${hbAnimLabelV8(showMode)}</div>`;
  hbHostPickerPopupPickingV8(showMode);

  currentRoundId = "r_" + Date.now();

  db.ref("rooms/" + room + "/currentRound").set({
    id: currentRoundId, status: "picking", pickerMode: showMode, pickerMarkup: pickerMarkup,
    pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
    seconds: Number(document.getElementById("duration").value) || 20
  });

  setTimeout(() => {
    flash();
    const color = pick(COLORS);
    const cat = document.getElementById(color.input).value || "Geen categorie";

    document.getElementById("hostPickerArea").innerHTML =
      `<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;

    hbHostPickerPopupResultV8(color, cat, showMode);

    const round = {
      id: currentRoundId, status: "ready", pickerMode: showMode, pickerMarkup: pickerMarkup,
      colorKey: color.key, colorName: color.name, colorEmoji: color.emoji,
      category: cat, seconds: Number(document.getElementById("duration").value) || 20
    };

    db.ref("rooms/" + room + "/currentRound").set(round);
    document.getElementById("playBtn").disabled = false;
    document.getElementById("showAnswerBtn").disabled = false;
    document.getElementById("hostScorePanel").classList.remove("hidden");

    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Kleur bekend. Klik nu op Speel verborgen nummer.";

    setTimeout(hbHostPickerPopupHideV7I, 3000);
  }, 3500);
};

/* =========================
   V8C HOST + SPELER ZELFDE RANDOM ANIMATIES
   ========================= */

const HB_SHOW_ANIMS_V8C = ["disco","wheel","vinyl","box","dart","penalty","slot","dice","mic"];

function hbAnimLabelV8C(mode){
  return {
    disco:"🪩 Discobal",
    wheel:"🎡 Kleurenrad",
    vinyl:"💿 Vinyl Picker",
    box:"🎁 Mystery Box",
    dart:"🎯 Dartbord",
    penalty:"⚽ Strafschop",
    slot:"🎰 Slotmachine",
    dice:"🎲 Dobbelsteen",
    mic:"🎤 Microfoon Toss"
  }[mode] || "🎉 Showmoment";
}

function hbGoalGridV8C(){
  const keys = ["yellow","pink","purple","blue","green","purple","blue","yellow","green","pink","green","yellow","pink","purple","blue"];
  return `<div class="goalGrid">${keys.map(k=>`<div class="goalCell" style="background:${COLORS.find(c=>c.key===k)?.hex || "#fff"}"></div>`).join("")}<div class="goalBall">⚽</div></div>`;
}

function hbShowAnimHTMLV8C(mode, compact=false){
  const wrapStart = compact ? `<div class="playerShowAnim">` : `<div class="showAnimStage">`;
  const wrapEnd = `</div>`;
  if(mode==="wheel") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div><div class="showPointer"></div><div class="showWheel"></div><div class="showAnimSub">Het rad draait...</div>${wrapEnd}`;
  if(mode==="vinyl") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div><div class="showVinyl"></div><div class="showAnimSub">De plaat kiest...</div>${wrapEnd}`;
  if(mode==="box") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div><div class="showBox">🎁</div><div class="showAnimTitle">Wat zit erin?</div>${wrapEnd}`;
  if(mode==="dart") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div><div class="showDartBoard"></div><div class="showAnimSub">De pijl vliegt...</div>${wrapEnd}`;
  if(mode==="penalty") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div>${hbGoalGridV8C()}<div class="showAnimSub">Schiet in een kleurvak...</div>${wrapEnd}`;
  if(mode==="slot") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div><div class="slotMachine"><div class="slotReel">🟨</div><div class="slotReel">🟪</div><div class="slotReel">🟩</div></div><div class="showAnimSub">De rollen draaien...</div>${wrapEnd}`;
  if(mode==="dice") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div><div class="showDice">🎲</div><div class="showAnimTitle">Rollen maar...</div>${wrapEnd}`;
  if(mode==="mic") return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)}</div><div class="showMic">🎤</div><div class="showAnimTitle">Microfoon toss...</div>${wrapEnd}`;
  return `${wrapStart}<div class="hostPickerPopupTitle">${hbAnimLabelV8C("disco")}</div><div class="showDiscoBall">🪩</div><div class="showAnimTitle">Kleurenmixer start...</div>${wrapEnd}`;
}

function hbHostPickerPopupPickingV8C(mode){
  hbHostPickerPopupShowV7I(hbShowAnimHTMLV8C(mode, false));
}

function hbHostPickerPopupResultV8C(color, cat, mode){
  hbHostPickerPopupShowV7I(`<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV8C(mode)} koos:</div><div class="showResultColor">${esc(color.emoji || "")}</div><div class="showResultName">${esc(color.name || "")}</div><div class="showResultCat">${esc(cat || "Geen categorie")}</div><div class="hostPickerPopupSub">Maak je klaar om het nummer te starten</div></div>`);
}

// Speler rendering: picking gebruikt nu dezelfde animatie, compact in vak
renderPlayerPickerFixed = function(round){
  const area = document.getElementById("playerPickerArea");
  if(area){
    area.innerHTML = hbShowAnimHTMLV8C(round.pickerMode || "disco", true);
  }

  // Compact dashboard vak rechtsonder ook vullen
  const dash = document.getElementById("dashPickerArea");
  if(dash){
    dash.innerHTML = hbShowAnimHTMLV8C(round.pickerMode || "disco", true);
  }
};

renderPlayerPicker = renderPlayerPickerFixed;

// Compact dashboard picker ook overriden
if(typeof renderCompactPicker === "function"){
  renderCompactPicker = function(r){
    const area = document.getElementById("dashPickerArea");
    if(!area) return;

    if(!r || !r.id){
      area.innerHTML = `<div class="bbOldPickerRemoved">🪩</div><div class="dashCatText">Wachten op host...</div>`;
      return;
    }

    if(r.status === "picking"){
      area.innerHTML = hbShowAnimHTMLV8C(r.pickerMode || "disco", true);
      return;
    }

    area.innerHTML =
      `<div class="dashColorBig">${esc(r.colorEmoji || "🪩")}</div>
       <div class="dashColorText">${esc(r.colorName || "KLEUR")}</div>
       <div class="dashCatText">${esc(r.category || "Wachten...")}</div>`;
  };
}

// Start ronde: random animatie wordt in Firebase gezet zodat spelers dezelfde zien
startRoundVisual = function(room){
  document.getElementById("hostAnswerArea").innerHTML = "";
  document.getElementById("playBtn").disabled = true;
  document.getElementById("showAnswerBtn").disabled = true;
  document.getElementById("playBtn").textContent = "🎵 Speel verborgen nummer";

  const showMode = pick(HB_SHOW_ANIMS_V8C);
  const pickerMarkup = hbShowAnimHTMLV8C(showMode, true);

  document.getElementById("hostPickerArea").innerHTML = `<div class="pickerTitle">${hbAnimLabelV8C(showMode)}</div>`;
  hbHostPickerPopupPickingV8C(showMode);

  currentRoundId = "r_" + Date.now();

  db.ref("rooms/" + room + "/currentRound").set({
    id: currentRoundId,
    status: "picking",
    pickerMode: showMode,
    pickerMarkup: pickerMarkup,
    pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
    seconds: Number(document.getElementById("duration").value) || 20
  });

  setTimeout(() => {
    flash();

    const color = pick(COLORS);
    const cat = document.getElementById(color.input).value || "Geen categorie";

    document.getElementById("hostPickerArea").innerHTML =
      `<div class="colorDisplay">${color.emoji}<br>${color.name}</div>
       <div class="categoryDisplay">${esc(cat)}</div>`;

    hbHostPickerPopupResultV8C(color, cat, showMode);

    const round = {
      id: currentRoundId,
      status: "ready",
      pickerMode: showMode,
      pickerMarkup: pickerMarkup,
      colorKey: color.key,
      colorName: color.name,
      colorEmoji: color.emoji,
      category: cat,
      seconds: Number(document.getElementById("duration").value) || 20
    };

    db.ref("rooms/" + room + "/currentRound").set(round);

    document.getElementById("playBtn").disabled = false;
    document.getElementById("showAnswerBtn").disabled = false;
    document.getElementById("hostScorePanel").classList.remove("hidden");

    const st = document.getElementById("hostStatus");
    if(st) st.textContent = "Kleur bekend. Klik nu op Speel verborgen nummer.";

    setTimeout(hbHostPickerPopupHideV7I, 3000);
  }, 3500);
};

/* V9 speler Compact/Focus toggle */
function hbEnsurePlayerViewToggleV9(){
  if(!document.body.classList.contains("playerMode")) return;
  const header=document.querySelector("header");
  if(header&&!document.getElementById("playerViewToggle")){
    const btn=document.createElement("button");
    btn.id="playerViewToggle"; btn.className="playerViewToggle"; btn.type="button";
    btn.textContent=localStorage.getItem("hb_player_view")==="focus"?"Compact":"Focus";
    btn.addEventListener("click",hbTogglePlayerViewV9);
    header.appendChild(btn);
  }
  const dash=document.getElementById("screenDashboard");
  if(dash&&!document.getElementById("focusTabs")){
    const tabs=document.createElement("div");
    tabs.id="focusTabs"; tabs.className="focusTabs";
    tabs.innerHTML='<div class="focusTab">Antwoord</div><div class="focusTab">Score</div><div class="focusTab">Bingo</div><div class="focusTab">Kleur</div>';
    const top=dash.querySelector(".dashTop");
    if(top) top.insertAdjacentElement("afterend",tabs);
  }
  hbApplyPlayerViewV9();
}
function hbApplyPlayerViewV9(){
  const mode=localStorage.getItem("hb_player_view")||"compact";
  const btn=document.getElementById("playerViewToggle");
  if(mode==="focus"){document.body.classList.add("focusView"); if(btn)btn.textContent="Compact";}
  else{document.body.classList.remove("focusView"); if(btn)btn.textContent="Focus";}
}
function hbTogglePlayerViewV9(){
  const current=localStorage.getItem("hb_player_view")||"compact";
  localStorage.setItem("hb_player_view",current==="focus"?"compact":"focus");
  hbApplyPlayerViewV9();
  const grid=document.querySelector(".dashGrid");
  if(grid) grid.scrollTo({top:0,behavior:"smooth"});
}
setTimeout(hbEnsurePlayerViewToggleV9,300);
setTimeout(hbEnsurePlayerViewToggleV9,1000);
setInterval(hbEnsurePlayerViewToggleV9,2000);


/* =========================
   V9B FOCUS TABS WERKEND
   ========================= */

function hbFocusPanelsV9B(){
  return Array.from(document.querySelectorAll(".dashGrid > .dashPanel"));
}

function hbFocusTabsV9B(){
  return Array.from(document.querySelectorAll(".focusTab"));
}

function hbGoFocusPanelV9B(index){
  const grid = document.querySelector(".dashGrid");
  const panels = hbFocusPanelsV9B();
  if(!grid || !panels[index]) return;

  grid.scrollTo({
    top: panels[index].offsetTop - panels[0].offsetTop,
    behavior: "smooth"
  });

  hbSetActiveFocusTabV9B(index);
}

function hbSetActiveFocusTabV9B(index){
  hbFocusTabsV9B().forEach((tab,i) => {
    tab.classList.toggle("active", i === index);
  });
}

function hbUpdateActiveFocusTabV9B(){
  if(!document.body.classList.contains("focusView")) return;

  const grid = document.querySelector(".dashGrid");
  const panels = hbFocusPanelsV9B();
  if(!grid || !panels.length) return;

  const top = grid.scrollTop;
  let best = 0;
  let bestDist = Infinity;

  panels.forEach((p,i) => {
    const dist = Math.abs((p.offsetTop - panels[0].offsetTop) - top);
    if(dist < bestDist){
      bestDist = dist;
      best = i;
    }
  });

  hbSetActiveFocusTabV9B(best);
}

function hbBindFocusTabsV9B(){
  const tabs = hbFocusTabsV9B();
  if(!tabs.length) return;

  tabs.forEach((tab,i) => {
    if(tab.dataset.v9bBound === "1") return;
    tab.dataset.v9bBound = "1";
    tab.addEventListener("click", () => hbGoFocusPanelV9B(i));
  });

  const grid = document.querySelector(".dashGrid");
  if(grid && grid.dataset.v9bScrollBound !== "1"){
    grid.dataset.v9bScrollBound = "1";
    grid.addEventListener("scroll", () => {
      clearTimeout(grid._v9bScrollTimer);
      grid._v9bScrollTimer = setTimeout(hbUpdateActiveFocusTabV9B, 80);
    }, {passive:true});
  }

  hbUpdateActiveFocusTabV9B();
}

// bestaande toggle uitbreiden: na switch tabs opnieuw binden
if(typeof hbApplyPlayerViewV9 === "function" && !window.__hbApplyV9B){
  window.__hbApplyV9B = true;
  const oldApplyV9B = hbApplyPlayerViewV9;
  hbApplyPlayerViewV9 = function(){
    const res = oldApplyV9B.apply(this, arguments);
    setTimeout(hbBindFocusTabsV9B, 100);
    setTimeout(hbUpdateActiveFocusTabV9B, 250);
    return res;
  };
}

if(typeof hbTogglePlayerViewV9 === "function" && !window.__hbToggleV9B){
  window.__hbToggleV9B = true;
  const oldToggleV9B = hbTogglePlayerViewV9;
  hbTogglePlayerViewV9 = function(){
    const res = oldToggleV9B.apply(this, arguments);
    setTimeout(hbBindFocusTabsV9B, 120);
    setTimeout(() => hbSetActiveFocusTabV9B(0), 250);
    return res;
  };
}

setTimeout(hbBindFocusTabsV9B, 500);
setTimeout(hbBindFocusTabsV9B, 1200);
setInterval(hbBindFocusTabsV9B, 2500);

/* =========================
   V9C ALLE ANIMATIES HOST + SPELER, GEEN 2X DEZELFDE
   ========================= */

const HB_ANIMS_V9C = ["disco","wheel","vinyl","box","dart","penalty","slot","dice","mic"];

function hbAnimLabelV9C(mode){
  return {
    disco:"🪩 Discobal",wheel:"🎡 Kleurenrad",vinyl:"💿 Vinyl Picker",
    box:"🎁 Mystery Box",dart:"🎯 Dartbord",penalty:"⚽ Strafschop",
    slot:"🎰 Slotmachine",dice:"🎲 Dobbelsteen",mic:"🎤 Microfoon Toss"
  }[mode] || "🎉 Showmoment";
}

function hbPickAnimNoRepeatV9C(){
  const last = localStorage.getItem("hb_last_anim_v9c") || "";
  let options = HB_ANIMS_V9C.filter(x => x !== last);
  const chosen = pick(options.length ? options : HB_ANIMS_V9C);
  localStorage.setItem("hb_last_anim_v9c", chosen);
  return chosen;
}

function hbGoalGridV9C(){
  const keys=["yellow","pink","purple","blue","green","purple","blue","yellow","green","pink","green","yellow","pink","purple","blue"];
  return `<div class="goalGrid">${keys.map(k=>`<div class="goalCell" style="background:${COLORS.find(c=>c.key===k)?.hex || "#fff"}"></div>`).join("")}<div class="goalBall">⚽</div></div>`;
}

function hbAnimHTMLV9C(mode, compact=false){
  const wrap = compact ? "playerShowAnim" : "showAnimStage";
  if(mode==="wheel") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div><div class="showPointer"></div><div class="showWheel"></div><div class="showAnimSub">Het rad draait...</div></div>`;
  if(mode==="vinyl") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div><div class="showVinyl"></div><div class="showAnimSub">De plaat kiest...</div></div>`;
  if(mode==="box") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div><div class="showBox">🎁</div><div class="showAnimTitle">Wat zit erin?</div></div>`;
  if(mode==="dart") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div><div class="showDartBoard"></div><div class="showAnimSub">De pijl vliegt...</div></div>`;
  if(mode==="penalty") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div>${hbGoalGridV9C()}<div class="showAnimSub">Schiet in een kleurvak...</div></div>`;
  if(mode==="slot") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div><div class="slotMachine"><div class="slotReel">🟨</div><div class="slotReel">🟪</div><div class="slotReel">🟩</div></div><div class="showAnimSub">De rollen draaien...</div></div>`;
  if(mode==="dice") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div><div class="showDice">🎲</div><div class="showAnimTitle">Rollen maar...</div></div>`;
  if(mode==="mic") return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)}</div><div class="showMic">🎤</div><div class="showAnimTitle">Microfoon toss...</div></div>`;
  return `<div class="${wrap}"><div class="hostPickerPopupTitle">${hbAnimLabelV9C("disco")}</div><div class="showDiscoBall">🪩</div><div class="showAnimTitle">Kleurenmixer start...</div></div>`;
}

function hbShowHostPopupV9C(html){
  if(typeof hbHostPickerPopupShowV7I === "function") hbHostPickerPopupShowV7I(html);
}

function hbHideHostPopupV9C(){
  if(typeof hbHostPickerPopupHideV7I === "function") hbHostPickerPopupHideV7I();
}

// speler picker en compact dashboard
renderPlayerPickerFixed = function(round){
  const html = hbAnimHTMLV9C(round.pickerMode || "disco", true);
  const area = document.getElementById("playerPickerArea");
  if(area) area.innerHTML = html;
  const dash = document.getElementById("dashPickerArea");
  if(dash) dash.innerHTML = html;
};
renderPlayerPicker = renderPlayerPickerFixed;

if(typeof renderCompactPicker === "function"){
  renderCompactPicker = function(r){
    const area=document.getElementById("dashPickerArea");
    if(!area)return;
    if(!r||!r.id){area.innerHTML=`<div class="bbOldPickerRemoved">🪩</div><div class="dashCatText">Wachten op host...</div>`;return;}
    if(r.status==="picking"){area.innerHTML=hbAnimHTMLV9C(r.pickerMode||"disco",true);return;}
    area.innerHTML=`<div class="dashColorBig">${esc(r.colorEmoji||"🪩")}</div><div class="dashColorText">${esc(r.colorName||"KLEUR")}</div><div class="dashCatText">${esc(r.category||"Wachten...")}</div>`;
  };
}

// start ronde met animatie die nooit hetzelfde is als vorige ronde
startRoundVisual = function(room){
  document.getElementById("hostAnswerArea").innerHTML="";
  document.getElementById("playBtn").disabled=true;
  document.getElementById("showAnswerBtn").disabled=true;
  document.getElementById("playBtn").textContent="🎵 Speel verborgen nummer";

  const mode = hbPickAnimNoRepeatV9C();
  const playerMarkup = hbAnimHTMLV9C(mode,true);
  const hostMarkup = hbAnimHTMLV9C(mode,false);

  document.getElementById("hostPickerArea").innerHTML=`<div class="pickerTitle">${hbAnimLabelV9C(mode)}</div>`;
  hbShowHostPopupV9C(hostMarkup);

  currentRoundId="r_"+Date.now();

  db.ref("rooms/"+room+"/currentRound").set({
    id:currentRoundId,status:"picking",pickerMode:mode,pickerMarkup:playerMarkup,
    pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,
    seconds:Number(document.getElementById("duration").value)||20
  });

  setTimeout(()=>{
    flash();
    const color=pick(COLORS);
    const cat=document.getElementById(color.input).value||"Geen categorie";

    document.getElementById("hostPickerArea").innerHTML=
      `<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;

    hbShowHostPopupV9C(`<div class="showAnimStage"><div class="hostPickerPopupTitle">${hbAnimLabelV9C(mode)} koos:</div><div class="showResultColor">${esc(color.emoji||"")}</div><div class="showResultName">${esc(color.name||"")}</div><div class="showResultCat">${esc(cat||"Geen categorie")}</div><div class="hostPickerPopupSub">Maak je klaar om het nummer te starten</div></div>`);

    db.ref("rooms/"+room+"/currentRound").set({
      id:currentRoundId,status:"ready",pickerMode:mode,pickerMarkup:playerMarkup,
      colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,
      seconds:Number(document.getElementById("duration").value)||20
    });

    document.getElementById("playBtn").disabled=false;
    document.getElementById("showAnswerBtn").disabled=false;
    document.getElementById("hostScorePanel").classList.remove("hidden");

    const st=document.getElementById("hostStatus");
    if(st)st.textContent="Kleur bekend. Klik nu op Speel verborgen nummer.";
    setTimeout(hbHideHostPopupV9C,3000);
  },3500);
};

/* FULLSCREEN BINGO WINNAAR OVERLAY */
showWinner = function(name){
  const cleanName = name || "onbekend";

  let overlay = document.getElementById("bingoFullOverlay");
  if(!overlay){
    overlay = document.createElement("div");
    overlay.id = "bingoFullOverlay";
    overlay.className = "bingoFullOverlay hidden";
    overlay.innerHTML = '<div class="bingoFullCard"><div class="bingoFullCrown">🐵</div><div class="bingoFullTitle">BINGO!</div><div id="bingoFullName" class="bingoFullName">Speler</div><div class="bingoFullSub">HEEFT GEWONNEN</div><div class="bingoFullCup">🏆</div></div>';
    document.body.appendChild(overlay);
  }

  const nameEl = document.getElementById("bingoFullName");
  if(nameEl) nameEl.textContent = cleanName;

  overlay.classList.remove("hidden");

  if($("winnerPanel")){
    $("winnerPanel").classList.remove("hidden");
    $("winnerMessage").innerHTML = "🏆 BINGO!<br>Speler " + esc(cleanName) + " heeft gewonnen!";
  }
  if($("hostBingoPanel")){
    $("hostBingoPanel").classList.remove("hidden");
    $("hostBingoMessage").innerHTML = "🏆 BINGO!<br>Speler " + esc(cleanName) + " heeft gewonnen!";
  }

  confetti();
  tune();
  setTimeout(() => speak(cleanName), 700);

  clearTimeout(window.__bingoFullOverlayTimer);
  window.__bingoFullOverlayTimer = setTimeout(() => {
    overlay.classList.add("hidden");
  }, 5000);
};


/* ==================================================
   BINGO BEATS CLEAN FROM STABLE JS
   Belangrijk: originele pickCell blijft intact.
   ================================================== */

(function(){
  const BB_TARGETS={
    yellow:{target:"gold",left:"18%"},
    pink:{target:"aqua",left:"34%"},
    purple:{target:"orange",left:"50%"},
    blue:{target:"lime",left:"66%"},
    green:{target:"coral",left:"82%"}
  };
  const BB_ANIMALS=[
    {emoji:"🦜",name:"Papegaai",cls:"parrot"},
    {emoji:"🐒",name:"Aap",cls:"monkey"},
    {emoji:"🦩",name:"Flamingo",cls:""},
    {emoji:"🐢",name:"Schildpad",cls:""},
    {emoji:"🐬",name:"Dolfijn",cls:"dolphin"},
    {emoji:"🦁",name:"Leeuw",cls:""},
    {emoji:"🐯",name:"Tijger",cls:""},
    {emoji:"🦊",name:"Vos",cls:""}
  ];
  function byAnimal(e){return BB_ANIMALS.find(a=>a.emoji===e)||BB_ANIMALS[0]}
  function chooseAnimal(){
    const last=localStorage.getItem("bb_clean_stable_animal")||"";
    const opts=BB_ANIMALS.filter(a=>a.emoji!==last);
    const a=pick(opts.length?opts:BB_ANIMALS);
    localStorage.setItem("bb_clean_stable_animal",a.emoji);
    return a;
  }
  function applyLabels(){
    [["cat-yellow","🟡 Goud"],["cat-pink","🩵 Aqua"],["cat-purple","🟠 Oranje"],["cat-blue","🟢 Lime"],["cat-green","🔴 Koraal"]].forEach(([id,text])=>{
      const input=document.getElementById(id), label=input?.closest("label");
      if(label){label.setAttribute("data-bb-label",text);[...label.childNodes].forEach(n=>{if(n.nodeType===Node.TEXT_NODE&&n.textContent.trim())n.textContent=text})}
    });
    const h=document.querySelector("header h1"); if(h)h.textContent="🪩 Bingo Beats";
    document.title="Bingo Beats";
  }
  setTimeout(applyLabels,100);setTimeout(applyLabels,800);setInterval(applyLabels,2000);

  function pickerHTML2(animalEmoji,colorKey,compact=false,reveal=false){
    const a=byAnimal(animalEmoji||"🦜");
    const t=BB_TARGETS[colorKey]||BB_TARGETS.yellow;
    const targets=["yellow","pink","purple","blue","green"].map(k=>{
      const x=BB_TARGETS[k];
      return `<div class="bbTarget ${x.target} ${reveal&&k===colorKey?"reveal":""}"></div>`;
    }).join("");
    return `<div class="bbPicker ${compact?"compact":""}">
      <div class="bbPickerTitle">${reveal?`${a.emoji} ${a.name} koos de kleur!`:`${a.emoji} ${a.name} kiest een kleur...`}</div>
      <div class="bbStage" style="--bb-left:${reveal?t.left:"50%"}">
        <div class="bbSun"></div><div class="bbPalm">🌴</div><div class="bbTargets">${targets}</div>
        <div class="bbAnimal ${a.cls} ${reveal?"reveal":""}">${a.emoji}</div>
      </div>
      <div class="bbHint">${reveal?"Kleur gekozen!":"Nog even spannend..."}</div>
    </div>`;
  }

  window.renderPlayerPicker=function(r){
    const area=document.getElementById("playerPickerArea");
    if(area)area.innerHTML=pickerHTML2(r.animal||r.pickerMode||"🦜",r.colorKey||r.targetColorKey||"yellow",false,false);
    const dash=document.getElementById("dashPickerArea");
    if(dash)dash.innerHTML=pickerHTML2(r.animal||r.pickerMode||"🦜",r.colorKey||r.targetColorKey||"yellow",true,false);
  };
  window.renderPlayerPickerFixed=window.renderPlayerPicker;

  if(typeof renderCompactPicker==="function"){
    window.renderCompactPicker=function(r){
      const area=document.getElementById("dashPickerArea"); if(!area)return;
      if(!r||!r.id){area.innerHTML=`<div class="bbOldPickerRemoved">🌴</div><div class="dashCatText">Wachten op host...</div>`;return}
      if(r.status==="picking"){area.innerHTML=pickerHTML2(r.animal||r.pickerMode||"🦜",r.colorKey||r.targetColorKey||"yellow",true,false);return}
      area.innerHTML=`<div class="dashColorBig">${esc(r.colorEmoji||"🌴")}</div><div class="dashColorText">${esc(r.colorName||"KLEUR")}</div><div class="dashCatText">${esc(r.category||"Wachten...")}</div>`;
    };
  }

  // Override renderCard alleen om kleurclass toe te voegen, dezelfde click-flow als origineel.
  window.renderCard=function(id,card,marked,click=false,r=null){
    const el=document.getElementById(id); if(!el)return;
    el.innerHTML=(card||[]).map((c,i)=>{
      const m=marked&&marked[i], pickable=click&&r&&c===r.colorKey&&c!=="free"&&!m, blocked=click&&!pickable&&c!=="free"&&!m;
      return `<div class="bingoCell cell-${c} ${c==="free"?"free":""} ${m?"marked":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-i="${i}">${m?"🐵":emoji(c)}</div>`;
    }).join("");
    if(click)el.querySelectorAll(".pickableCell").forEach(x=>x.addEventListener("click",()=>pickCell(Number(x.dataset.i))));
  };

  // Compact kaart: alleen als bestaande renderer dit gebruikt.
  window.bbPaintCompactCard=function(el,card,marked,click=false,r=null){
    if(!el)return;
    el.innerHTML=(card||[]).map((c,i)=>{
      const m=marked&&marked[i], pickable=click&&r&&c===r.colorKey&&c!=="free"&&!m, blocked=click&&!pickable&&c!=="free"&&!m;
      return `<div class="compactCell cell-${c} ${c==="free"?"free":""} ${m?"marked":""} ${pickable?"pickable":""} ${blocked?"blockedCell":""}" data-i="${i}">${m?"🐵":emoji(c)}</div>`;
    }).join("");
    if(click)el.querySelectorAll(".pickable").forEach(x=>x.addEventListener("click",()=>pickCell(Number(x.dataset.i))));
  };

  window.startRoundVisual=function(room){
    document.getElementById("hostAnswerArea").innerHTML="";
    document.getElementById("playBtn").disabled=true;
    document.getElementById("showAnswerBtn").disabled=true;
    const animal=chooseAnimal();
    const color=pick(COLORS);
    const cat=document.getElementById(color.input).value||"Geen categorie";
    currentRoundId="r_"+Date.now();
    const hostMarkup=pickerHTML2(animal.emoji,color.key,false,false);
    const playerMarkup=pickerHTML2(animal.emoji,color.key,true,false);
    document.getElementById("hostPickerArea").innerHTML=hostMarkup;
    if(typeof hbHostPickerPopupShowV7I==="function")hbHostPickerPopupShowV7I(hostMarkup);
    db.ref("rooms/"+room+"/currentRound").set({
      id:currentRoundId,status:"picking",pickerMode:animal.emoji,animal:animal.emoji,animalName:animal.name,
      targetColorKey:color.key,colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,
      pickerMarkup:playerMarkup,pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,
      seconds:Number(document.getElementById("duration").value)||20
    });
    setTimeout(()=>{
      flash();
      document.getElementById("hostPickerArea").innerHTML=`<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;
      if(typeof hbHostPickerPopupShowV7I==="function")hbHostPickerPopupShowV7I(pickerHTML2(animal.emoji,color.key,false,true));
      db.ref("rooms/"+room+"/currentRound").set({
        id:currentRoundId,status:"ready",pickerMode:animal.emoji,animal:animal.emoji,animalName:animal.name,
        targetColorKey:color.key,colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,
        pickerMarkup:playerMarkup,seconds:Number(document.getElementById("duration").value)||20
      });
      document.getElementById("playBtn").disabled=false;
      document.getElementById("showAnswerBtn").disabled=false;
      document.getElementById("hostScorePanel").classList.remove("hidden");
      const st=document.getElementById("hostStatus"); if(st)st.textContent="Kleur bekend. Klik nu op Speel verborgen nummer.";
      if(typeof hbHostPickerPopupHideV7I==="function")setTimeout(hbHostPickerPopupHideV7I,3000);
    },5000);
  };

  // Als compacte dashboardkaart wordt gerenderd door andere functie: repaint met eventlisteners, maar alleen bij canPick.
  function repaintDashCard(){
    const room=currentRoomCode||localStorage.getItem("hb_player_room")||"";
    if(!room||!currentPlayerId||!db)return;
    db.ref("rooms/"+room).once("value").then(s=>{
      const data=s.val()||{}, r=data.currentRound||activeRound||{}, p=data.players?.[currentPlayerId]||{};
      if(!p.card||!p.card.length)return;
      const good=r.id&&data.correct?.[r.id]?.[currentPlayerId]===true;
      const picked=p.lastPickedRound===r.id;
      const canPick=r.status==="judged"&&good&&!picked;
      const el=document.getElementById("dashOwnCard");
      if(el)bbPaintCompactCard(el,p.card,p.marked||{},canPick,r);
      const hint=document.getElementById("dashCardHint"), status=document.getElementById("dashCardStatus");
      if(canPick){
        if(hint)hint.textContent=`Kies 1 ${r.colorEmoji} ${r.colorName} vakje.`;
        if(status)status.textContent="Tik op een geldig vakje.";
      }
    }).catch(()=>{});
  }
  setTimeout(repaintDashCard,800);setTimeout(repaintDashCard,1800);setInterval(repaintDashCard,2500);
})();


/* V30 ROOT CLICK FIX */
(function(){
  function bbBindCompactPick(){
    const box=document.getElementById("dashOwnCard");
    if(!box) return;

    box.querySelectorAll(".pickable").forEach(cell=>{
      if(cell.dataset.bbBound==="1") return;
      cell.dataset.bbBound="1";

      const fire=()=>{
        const i=Number(cell.dataset.i);
        if(Number.isFinite(i) && typeof pickCell==="function"){
          pickCell(i);
        }
      };

      cell.addEventListener("click",fire);
      cell.addEventListener("touchstart",function(e){e.preventDefault();fire();},{passive:false});
      cell.addEventListener("touchend",function(e){e.preventDefault();},{passive:false});
    });
  }

  const oldRenderCompactCard = window.renderCompactCard;
  if(typeof oldRenderCompactCard==="function"){
    window.renderCompactCard=function(room,r){
      oldRenderCompactCard(room,r);
      setTimeout(bbBindCompactPick,10);
    };
  }

  document.addEventListener("click",function(e){
    const cell=e.target.closest(".pickable");
    if(!cell) return;
    const i=Number(cell.dataset.i);
    if(Number.isFinite(i) && typeof pickCell==="function"){
      pickCell(i);
    }
  },true);
})();


/* ==================================================
   V31 NO OLD COLORS JS
   Laatste renderlaag: kaart wordt meteen met nieuwe kleuren gebouwd.
   Geen oude kleuren meer bij Firebase updates.
   ================================================== */

(function(){
  const BBV31 = {
    yellow:{hex:"#FFCC33",dark:"#D99A00",emoji:"🟡"},
    pink:{hex:"#00D4C7",dark:"#008E86",emoji:"🩵"},
    purple:{hex:"#FF8A1F",dark:"#C65400",emoji:"🟠"},
    blue:{hex:"#7ED957",dark:"#329E26",emoji:"🟢"},
    green:{hex:"#FF5A5F",dark:"#C52834",emoji:"🔴"},
    free:{hex:"#FFCC33",dark:"#fff7c8",emoji:"🐵"}
  };

  window.colorHexV5 = function(key){ return (BBV31[key]||BBV31.free).hex; };
  window.hbColor = function(key){ return (BBV31[key]||BBV31.free).hex; };
  window.playerColorByIndex = function(i){
    return ["#FFCC33","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#FFCC33"][i % 6];
  };

  function cellBg(key){
    const c = BBV31[key] || BBV31.free;
    if(key === "free") return "linear-gradient(135deg,#fff7c8,#FFCC33)";
    return `linear-gradient(145deg,${c.hex},${c.dark})`;
  }

  function cellIcon(key, marked){
    if(marked) return "🐵";
    return (BBV31[key]||BBV31.free).emoji;
  }

  function renderCompactCardV31(room,r){
    const box = document.getElementById("dashOwnCard");
    const hint = document.getElementById("dashCardHint");
    const status = document.getElementById("dashCardStatus");
    if(!box) return;

    const pid = (typeof hbSafePidV51 === "function" ? hbSafePidV51() : (currentPlayerId || localStorage.getItem("hb_player_id") || ""));
    const me = room.players && pid ? room.players[pid] || {} : {};
    const card = Array.isArray(me.card) ? me.card.slice(0,25) : [];
    const marked = me.marked || {};
    while(card.length < 25) card.push(["yellow","pink","purple","blue","green"][card.length % 5]);

    const good = r && r.id && room.correct && room.correct[r.id] ? room.correct[r.id][pid] === true : false;
    const picked = r && r.id && me.lastPickedRound === r.id;
    const canPick = r && r.status === "judged" && good && !picked;

    if(hint) hint.textContent = canPick ? `Kies ${r.colorEmoji || ""} ${r.colorName || ""}` : "Jouw bingokaart";
    if(status) status.textContent = canPick ? "Tik op een geldig vakje" : (me.ready ? "🐵 READY" : "Wachten");

    box.innerHTML = card.map((key,i)=>{
      const isMarked = !!marked[i] || key === "free";
      const pickable = canPick && key === r.colorKey && key !== "free" && !marked[i];
      return `<div class="compactCell cell-${key} ${key==="free"?"free":""} ${isMarked?"marked":""} ${pickable?"pickable":""}" data-i="${i}" data-color-key="${key}" style="background:${cellBg(key)}!important">${cellIcon(key,isMarked)}</div>`;
    }).join("");

    box.querySelectorAll(".pickable").forEach(cell=>{
      cell.addEventListener("click",()=>pickCell(Number(cell.dataset.i)));
      cell.addEventListener("touchstart",e=>{e.preventDefault();pickCell(Number(cell.dataset.i));},{passive:false});
    });
  }

  function miniCardV31(p){
    const card = p.card || [];
    const marked = p.marked || {};
    return `<div class="inlineMiniCard">` + card.map((key,i)=>{
      const mark = marked[i] || key === "free";
      return `<div class="inlineMiniCell cell-${key}" style="background:${cellBg(key)}!important;${mark ? "box-shadow:0 0 0 2px #fff inset" : ""}">${mark ? "🐵" : ""}</div>`;
    }).join("") + `</div>`;
  }

  // Override bekende renderfuncties zodat oude hbColor/colorHexV5 output niet meer zichtbaar komt.
  window.hbMiniCardV51 = miniCardV31;
  window.hbMiniCard = miniCardV31;
  window.renderInlineMiniCardV5 = miniCardV31;
  window.hbRenderCardV51 = renderCompactCardV31;
  window.hbRenderCard = renderCompactCardV31;
  window.renderCompactCard = renderCompactCardV31;

  // Als bestaande hbRenderAllV51 actief is, laat hem onze kaartfunctie gebruiken.
  const oldAll = window.hbRenderAllV51 || window.hbRenderAll || window.renderCompactDashboard;
  if(typeof oldAll === "function"){
    window.hbRenderAllV51 = function(room){
      oldAll(room);
      const r = (room||{}).currentRound || {};
      renderCompactCardV31(room||{}, r);
    };
    window.hbRenderAll = window.hbRenderAllV51;
    window.renderCompactDashboard = window.hbRenderAllV51;
  }

  function repaintV31(){
    const room = currentRoomCode || localStorage.getItem("hb_player_room") || new URLSearchParams(location.search).get("room") || "";
    if(!room || !db) return;
    db.ref("rooms/"+room).once("value").then(s=>{
      const data = s.val() || {};
      renderCompactCardV31(data, data.currentRound || {});
    }).catch(()=>{});
  }

  setTimeout(repaintV31,150);
  setTimeout(repaintV31,700);
  setTimeout(repaintV31,1500);
})();


/* ==================================================
   BINGO BEATS V32 MONKEYS ONLY
   Geen vinkjes en geen kroontjes meer in de bingokaart.
   Marked/free vakjes krijgen random 🐵 🙈 🙉 🙊.
   ================================================== */

const BB_MONKEYS_V32 = ["🐵","🙈","🙉","🙊"];

function bbMonkey(){
  return BB_MONKEYS_V32[Math.floor(Math.random() * BB_MONKEYS_V32.length)];
}

function bbMonkeyForCellV32(i, seed=""){
  const s = String(seed || "") + ":" + String(i);
  let h = 0;
  for(let n=0;n<s.length;n++) h = ((h << 5) - h + s.charCodeAt(n)) | 0;
  return BB_MONKEYS_V32[Math.abs(h) % BB_MONKEYS_V32.length];
}

function bbColorDataV32(k){
  return {
    yellow:{hex:"#FFCC33",dark:"#D99A00",emoji:"🟡"},
    pink:{hex:"#00D4C7",dark:"#008E86",emoji:"🩵"},
    purple:{hex:"#FF8A1F",dark:"#C65400",emoji:"🟠"},
    blue:{hex:"#7ED957",dark:"#329E26",emoji:"🟢"},
    green:{hex:"#FF5A5F",dark:"#C52834",emoji:"🔴"},
    free:{hex:"#FFCC33",dark:"#fff7c8",emoji:"🐵"}
  }[k] || {hex:"#333",dark:"#222",emoji:"⬜"};
}

function bbCellIconV32(k, marked, i, seed){
  if(marked || k === "free") return bbMonkeyForCellV32(i, seed);
  return bbColorDataV32(k).emoji;
}

function bbCellBgV32(k){
  const c = bbColorDataV32(k);
  if(k === "free") return "linear-gradient(135deg,#fff7c8,#FFCC33)";
  return `linear-gradient(145deg,${c.hex},${c.dark})`;
}

// Override oude emoji free-symbol
emoji = function(k){
  return ({yellow:"🟡",pink:"🩵",purple:"🟠",blue:"🟢",green:"🔴",free:bbMonkey()}[k] || "⬜");
};

// Klassieke kaart
renderCard = function(id,card,marked,click=false,r=null){
  const el=document.getElementById(id);
  if(!el) return;
  const seed = currentPlayerId || localStorage.getItem("hb_player_id") || "";
  el.innerHTML=(card||[]).map((c,i)=>{
    const m=!!(marked&&marked[i]);
    const pickable=click&&r&&c===r.colorKey&&c!=="free"&&!m;
    const blocked=click&&!pickable&&c!=="free"&&!m;
    return `<div class="bingoCell cell-${c} ${c==="free"?"free":""} ${m?"marked":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-i="${i}" data-color-key="${c}" style="background:${bbCellBgV32(c)}!important">${bbCellIconV32(c,m,i,seed)}</div>`;
  }).join("");
  if(click){
    el.querySelectorAll(".pickableCell").forEach(x=>x.addEventListener("click",()=>pickCell(Number(x.dataset.i))));
  }
};

// Compacte kaart
function bbRenderCompactMonkeyCardV32(el,card,marked,click=false,r=null){
  if(!el) return;
  const seed = currentPlayerId || localStorage.getItem("hb_player_id") || "";
  el.innerHTML=(card||[]).map((c,i)=>{
    const m=!!(marked&&marked[i]);
    const pickable=click&&r&&c===r.colorKey&&c!=="free"&&!m;
    const blocked=click&&!pickable&&c!=="free"&&!m;
    return `<div class="compactCell cell-${c} ${c==="free"?"free":""} ${m?"marked":""} ${pickable?"pickable":""} ${blocked?"blockedCell":""}" data-i="${i}" data-color-key="${c}" style="background:${bbCellBgV32(c)}!important">${bbCellIconV32(c,m,i,seed)}</div>`;
  }).join("");
  if(click){
    el.querySelectorAll(".pickable").forEach(x=>{
      x.addEventListener("click",()=>pickCell(Number(x.dataset.i)));
      x.addEventListener("touchstart",e=>{e.preventDefault();pickCell(Number(x.dataset.i));},{passive:false});
    });
  }
}

if(typeof renderCompactCard === "function"){
  renderCompactCard = function(room,r){
    const el=document.getElementById("dashOwnCard");
    if(!el || !room) return;
    const pid = currentPlayerId || localStorage.getItem("hb_player_id") || "";
    const me = room.players && pid ? (room.players[pid] || {}) : {};
    const card = me.card || [];
    const marked = me.marked || {};
    const good = r && r.id && room.correct && room.correct[r.id] ? room.correct[r.id][pid] === true : false;
    const picked = r && r.id && me.lastPickedRound === r.id;
    const canPick = r && r.status === "judged" && good && !picked;
    bbRenderCompactMonkeyCardV32(el,card,marked,canPick,r);
  };
}

// Mini kaarten in score/host
function hbMiniCardV51(p){
  const card = p.card || [];
  const marked = p.marked || {};
  const seed = p.name || "";
  return `<div class="inlineMiniCard">` + card.map((c,i)=>{
    const mark = marked[i] || c === "free";
    return `<div class="inlineMiniCell cell-${c}" style="background:${bbCellBgV32(c)}!important;${mark?"box-shadow:0 0 0 2px #fff inset":""}">${mark ? bbMonkeyForCellV32(i,seed) : ""}</div>`;
  }).join("") + `</div>`;
}
window.hbMiniCardV51 = hbMiniCardV51;
window.hbMiniCard = hbMiniCardV51;

// Final cleanup: als oude code toch nog tekens plaatst, direct vervangen.
function bbRemoveChecksCrownsV32(){
  document.querySelectorAll(".bingoCell,.compactCell,.inlineMiniCell").forEach((cell,i)=>{
    const txt=(cell.textContent||"").trim();
    if(txt === "✅" || txt === "👑"){
      cell.textContent = bbMonkeyForCellV32(i, currentPlayerId || "");
    }
  });
}

const bbMonkeyObserverV32 = new MutationObserver(bbRemoveChecksCrownsV32);
setTimeout(()=>bbMonkeyObserverV32.observe(document.body,{childList:true,subtree:true,characterData:true}),100);
setTimeout(bbRemoveChecksCrownsV32,200);
setInterval(bbRemoveChecksCrownsV32,1000);








/* ==================================================
   V35 CARTOON ANIMAL PICKER + REMOVE HOST SOUND
   ================================================== */

(function(){
  const BB_V35_COLORS = {
    yellow:{name:"GOUD",emoji:"🟡",cls:"gold",rot:"0deg"},
    pink:{name:"AQUA",emoji:"🩵",cls:"aqua",rot:"-72deg"},
    purple:{name:"ORANJE",emoji:"🟠",cls:"orange",rot:"-144deg"},
    blue:{name:"LIME",emoji:"🟢",cls:"lime",rot:"-216deg"},
    green:{name:"KORAAL",emoji:"🔴",cls:"coral",rot:"-288deg"}
  };

  const BB_V35_ANIMALS = [
    {key:"monkey",name:"Aap"},
    {key:"parrot",name:"Papegaai"},
    {key:"turtle",name:"Schildpad"}
  ];

  function hideHostSoundV35(){
    document.querySelectorAll("button,a").forEach(el=>{
      const txt=(el.textContent||"").toLowerCase();
      if(txt.includes("activeer host") || txt.includes("") || txt.includes("host geluid")){
        el.classList.add("bbHideHostSound");
        el.style.setProperty("display","none","important");
      }
    });
  }

  function pickAnimalV35(){
    const last=localStorage.getItem("bb_v35_last_animal")||"";
    const options=BB_V35_ANIMALS.filter(a=>a.key!==last);
    const a=pick(options.length?options:BB_V35_ANIMALS);
    localStorage.setItem("bb_v35_last_animal",a.key);
    return a;
  }

  function animalHTMLV35(key){
    if(key==="parrot"){
      return `<div class="bbAnimalCartoon bbParrot">
        <div class="bbAnimalShadow"></div>
        <div class="wingL"></div><div class="wingR"></div>
        <div class="tail"></div><div class="body"></div><div class="head"></div>
        <div class="beak"></div><div class="eye"></div>
      </div>`;
    }
    if(key==="turtle"){
      return `<div class="bbAnimalCartoon bbTurtle">
        <div class="bbAnimalShadow"></div>
        <div class="leg1"></div><div class="leg2"></div><div class="leg3"></div><div class="leg4"></div>
        <div class="tail"></div><div class="shell"></div><div class="head"></div><div class="eye"></div>
      </div>`;
    }
    return `<div class="bbAnimalCartoon bbMonkey">
      <div class="bbAnimalShadow"></div>
      <div class="tail"></div><div class="earL"></div><div class="earR"></div>
      <div class="armL"></div><div class="armR"></div>
      <div class="legL"></div><div class="legR"></div>
      <div class="body"></div><div class="belly"></div>
      <div class="head"></div><div class="face"></div>
      <div class="eyeL"></div><div class="eyeR"></div><div class="mouth"></div>
    </div>`;
  }

  function cartoonPickerHTMLV35(animalKey,colorKey,compact=false,reveal=false){
    const color = BB_V35_COLORS[colorKey] || BB_V35_COLORS.yellow;
    const animal = BB_V35_ANIMALS.find(a=>a.key===animalKey) || BB_V35_ANIMALS[0];
    const wheelClass = reveal ? "bbColorWheel reveal" : "bbColorWheel";
    const badge = reveal ? `<div class="bbRevealBadge">${color.emoji} ${color.name}</div>` : "";
    return `<div class="bbCartoonPicker ${compact?"compact":""}">
      <div class="bbCartoonTitle">${reveal ? `${animal.name} koos de kleur!` : `${animal.name} start de kleurenmixer...`}</div>
      <div class="bbCartoonStage">
        <div class="bbCartoonSun"></div>
        <div class="bbCartoonPalm">🌴</div>
        ${animalHTMLV35(animal.key)}
        <div class="bbLever"></div>
        <div class="bbWheelWrap">
          <div class="bbWheelPointer"></div>
          <div class="${wheelClass}" style="--bb-final-rot:${color.rot}"></div>
          <div class="bbWheelCenter"></div>
        </div>
        ${badge}
      </div>
      <div class="bbHint">${reveal ? "Kleur gekozen!" : "Nog even spannend..."}</div>
    </div>`;
  }

  // Picker renders: tijdens picking geheim houden
  window.renderPlayerPicker = function(round){
    const animalKey = round.animalKey || round.animal || round.pickerMode || "monkey";
    const key = round.colorKey || round.targetColorKey || "yellow";
    const area=document.getElementById("playerPickerArea");
    if(area) area.innerHTML = cartoonPickerHTMLV35(animalKey,key,false,false);
    const dash=document.getElementById("dashPickerArea");
    if(dash) dash.innerHTML = cartoonPickerHTMLV35(animalKey,key,true,false);
  };
  window.renderPlayerPickerFixed = window.renderPlayerPicker;

  window.renderCompactPicker = function(r){
    const area=document.getElementById("dashPickerArea");
    if(!area)return;
    if(!r||!r.id){
      area.innerHTML=`<div class="bbOldPickerRemoved">🌴</div><div class="dashCatText">Wachten op host...</div>`;
      return;
    }
    if(r.status==="picking"){
      area.innerHTML=cartoonPickerHTMLV35(r.animalKey||r.animal||r.pickerMode||"monkey",r.colorKey||r.targetColorKey||"yellow",true,false);
      return;
    }
    area.innerHTML=`<div class="dashColorBig">${esc(r.colorEmoji||"🌴")}</div><div class="dashColorText">${esc(r.colorName||"KLEUR")}</div><div class="dashCatText">${esc(r.category||"Wachten...")}</div>`;
  };

  // Start ronde: kleur intern gekozen, reveal pas na 5 sec
  window.startRoundVisual = function(room){
    document.getElementById("hostAnswerArea").innerHTML="";
    document.getElementById("playBtn").disabled=true;
    document.getElementById("showAnswerBtn").disabled=true;
    document.getElementById("playBtn").textContent="🎵 Speel verborgen nummer";

    const animal=pickAnimalV35();
    const color=pick(COLORS);
    const cat=document.getElementById(color.input).value||"Geen categorie";
    currentRoundId="r_"+Date.now();

    const hostMarkup=cartoonPickerHTMLV35(animal.key,color.key,false,false);
    const playerMarkup=cartoonPickerHTMLV35(animal.key,color.key,true,false);

    document.getElementById("hostPickerArea").innerHTML=hostMarkup;
    if(typeof hbHostPickerPopupShowV7I==="function") hbHostPickerPopupShowV7I(hostMarkup);

    db.ref("rooms/"+room+"/currentRound").set({
      id:currentRoundId,
      status:"picking",
      pickerMode:animal.key,
      animal:animal.key,
      animalKey:animal.key,
      animalName:animal.name,
      targetColorKey:color.key,
      colorKey:color.key,
      colorName:color.name,
      colorEmoji:color.emoji,
      category:cat,
      pickerMarkup:playerMarkup,
      pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,
      seconds:Number(document.getElementById("duration").value)||20
    });

    setTimeout(()=>{
      flash();

      document.getElementById("hostPickerArea").innerHTML=
        `<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;

      if(typeof hbHostPickerPopupShowV7I==="function"){
        hbHostPickerPopupShowV7I(cartoonPickerHTMLV35(animal.key,color.key,false,true));
      }

      db.ref("rooms/"+room+"/currentRound").set({
        id:currentRoundId,
        status:"ready",
        pickerMode:animal.key,
        animal:animal.key,
        animalKey:animal.key,
        animalName:animal.name,
        targetColorKey:color.key,
        colorKey:color.key,
        colorName:color.name,
        colorEmoji:color.emoji,
        category:cat,
        pickerMarkup:playerMarkup,
        seconds:Number(document.getElementById("duration").value)||20
      });

      document.getElementById("playBtn").disabled=false;
      document.getElementById("showAnswerBtn").disabled=false;
      document.getElementById("hostScorePanel").classList.remove("hidden");

      const st=document.getElementById("hostStatus");
      if(st) st.textContent="Kleur bekend. Klik nu op Speel verborgen nummer.";

      if(typeof hbHostPickerPopupHideV7I==="function") setTimeout(hbHostPickerPopupHideV7I,3000);
    },5000);
  };

  hideHostSoundV35();
  setTimeout(hideHostSoundV35,300);
  setTimeout(hideHostSoundV35,1200);
  setInterval(hideHostSoundV35,2500);
})();


/* ==================================================
   V36 HARD FORCE CARTOON PICKER + REMOVE SOUND UI
   ================================================== */

(function(){
  const BB36_COLORS = {
    yellow:{name:"GOUD",emoji:"🟡",cls:"gold",rot:"0deg"},
    pink:{name:"AQUA",emoji:"🩵",cls:"aqua",rot:"-72deg"},
    purple:{name:"ORANJE",emoji:"🟠",cls:"orange",rot:"-144deg"},
    blue:{name:"LIME",emoji:"🟢",cls:"lime",rot:"-216deg"},
    green:{name:"KORAAL",emoji:"🔴",cls:"coral",rot:"-288deg"}
  };

  const BB36_ANIMALS=[
    {key:"monkey",name:"Aap"},
    {key:"parrot",name:"Papegaai"},
    {key:"turtle",name:"Schildpad"}
  ];

  function bb36Pick(arr){ return typeof pick==="function" ? pick(arr) : arr[Math.floor(Math.random()*arr.length)]; }

  function bb36HideSound(){
    document.querySelectorAll("button,a,div,p,span").forEach(el=>{
      const txt=(el.textContent||"").toLowerCase().trim();
      const id=(el.id||"").toLowerCase();
      const cls=(el.className||"").toString().toLowerCase();
      const isSound =
        txt.includes("activeer ") ||
        txt.includes("activeer host geluid") ||
        txt.includes("geluid nog niet geactiveerd") ||
        id.includes("sound") ||
        id.includes("audio") ||
        cls.includes("sound") ||
        cls.includes("audio");

      if(isSound){
        // Als het een knop/status is: verberg alleen dat element.
        // Als het een lege wrapper met alleen die inhoud is: verberg wrapper ook.
        el.style.setProperty("display","none","important");
        el.style.setProperty("visibility","hidden","important");
        el.style.setProperty("height","0","important");
        el.style.setProperty("min-height","0","important");
        el.style.setProperty("padding","0","important");
        el.style.setProperty("margin","0","important");
        el.style.setProperty("border","0","important");

        const parent=el.parentElement;
        if(parent && parent.children.length<=2 && (parent.textContent||"").toLowerCase().includes("geluid")){
          parent.style.setProperty("display","none","important");
        }
      }
    });

    // Verberg lege turquoise balken na verwijderen tekst
    document.querySelectorAll("button").forEach(btn=>{
      const txt=(btn.textContent||"").trim();
      if(!txt && btn.offsetHeight < 40){
        btn.style.setProperty("display","none","important");
      }
    });
  }

  function bb36AnimalHTML(key){
    if(key==="parrot"){
      return `<div class="bbAnimalCartoon bbParrot">
        <div class="bbAnimalShadow"></div>
        <div class="wingL"></div><div class="wingR"></div>
        <div class="tail"></div><div class="body"></div><div class="head"></div>
        <div class="beak"></div><div class="eye"></div>
      </div>`;
    }
    if(key==="turtle"){
      return `<div class="bbAnimalCartoon bbTurtle">
        <div class="bbAnimalShadow"></div>
        <div class="leg1"></div><div class="leg2"></div><div class="leg3"></div><div class="leg4"></div>
        <div class="tail"></div><div class="shell"></div><div class="head"></div><div class="eye"></div>
      </div>`;
    }
    return `<div class="bbAnimalCartoon bbMonkey">
      <div class="bbAnimalShadow"></div>
      <div class="tail"></div><div class="earL"></div><div class="earR"></div>
      <div class="armL"></div><div class="armR"></div>
      <div class="legL"></div><div class="legR"></div>
      <div class="body"></div><div class="belly"></div>
      <div class="head"></div><div class="face"></div>
      <div class="eyeL"></div><div class="eyeR"></div><div class="mouth"></div>
    </div>`;
  }

  function bb36PickerHTML(animalKey,colorKey,compact=false,reveal=false){
    const color=BB36_COLORS[colorKey]||BB36_COLORS.yellow;
    const animal=BB36_ANIMALS.find(a=>a.key===animalKey)||BB36_ANIMALS[0];
    return `<div class="bbCartoonPicker ${compact?"compact":""}" data-bb36="1">
      <div class="bbCartoonTitle">${reveal ? `${animal.name} koos de kleur!` : `${animal.name} start de kleurenmixer...`}</div>
      <div class="bbCartoonStage">
        <div class="bbCartoonSun"></div>
        <div class="bbCartoonPalm">🌴</div>
        ${bb36AnimalHTML(animal.key)}
        <div class="bbLever"></div>
        <div class="bbWheelWrap">
          <div class="bbWheelPointer"></div>
          <div class="bbColorWheel ${reveal?"reveal":""}" style="--bb-final-rot:${color.rot}"></div>
          <div class="bbWheelCenter"></div>
        </div>
        ${reveal ? `<div class="bbRevealBadge">${color.emoji} ${color.name}</div>` : ""}
      </div>
      <div class="bbHint">${reveal ? "Kleur gekozen!" : "Nog even spannend..."}</div>
    </div>`;
  }

  function bb36PickAnimal(){
    const last=localStorage.getItem("bb36_last_animal")||"";
    const opts=BB36_ANIMALS.filter(a=>a.key!==last);
    const a=bb36Pick(opts.length?opts:BB36_ANIMALS);
    localStorage.setItem("bb36_last_animal",a.key);
    return a;
  }

  // Overschrijf ALLE bekende oude picker functies
  window.pickerHTML=function(mode){ return bb36PickerHTML(mode||"monkey","yellow",false,false); };
  window.sharedPickerHTML=function(mode){ return bb36PickerHTML(mode||"monkey","yellow",true,false); };
  window.renderPlayerPicker=function(round){
    const a=round.animalKey||round.animal||round.pickerMode||"monkey";
    const k=round.colorKey||round.targetColorKey||"yellow";
    const p=document.getElementById("playerPickerArea");
    if(p) p.innerHTML=bb36PickerHTML(a,k,false,false);
    const d=document.getElementById("dashPickerArea");
    if(d) d.innerHTML=bb36PickerHTML(a,k,true,false);
  };
  window.renderPlayerPickerFixed=window.renderPlayerPicker;

  window.renderCompactPicker=function(r){
    const area=document.getElementById("dashPickerArea");
    if(!area)return;
    if(!r||!r.id){
      area.innerHTML=`<div class="dashCatText">Wachten op host...</div>`;
      return;
    }
    if(r.status==="picking"){
      area.innerHTML=bb36PickerHTML(r.animalKey||r.animal||r.pickerMode||"monkey",r.colorKey||r.targetColorKey||"yellow",true,false);
      return;
    }
    area.innerHTML=`<div class="dashColorBig">${esc(r.colorEmoji||"")}</div><div class="dashColorText">${esc(r.colorName||"KLEUR")}</div><div class="dashCatText">${esc(r.category||"Wachten...")}</div>`;
  };

  window.startRoundVisual=function(room){
    document.getElementById("hostAnswerArea").innerHTML="";
    document.getElementById("playBtn").disabled=true;
    document.getElementById("showAnswerBtn").disabled=true;
    document.getElementById("playBtn").textContent="🎵 Speel verborgen nummer";

    const animal=bb36PickAnimal();
    const color=bb36Pick(COLORS);
    const cat=document.getElementById(color.input).value||"Geen categorie";
    currentRoundId="r_"+Date.now();

    const hostMarkup=bb36PickerHTML(animal.key,color.key,false,false);
    const playerMarkup=bb36PickerHTML(animal.key,color.key,true,false);

    const hostArea=document.getElementById("hostPickerArea");
    if(hostArea) hostArea.innerHTML=hostMarkup;
    if(typeof hbHostPickerPopupShowV7I==="function") hbHostPickerPopupShowV7I(hostMarkup);

    db.ref("rooms/"+room+"/currentRound").set({
      id:currentRoundId,
      status:"picking",
      pickerMode:animal.key,
      animal:animal.key,
      animalKey:animal.key,
      animalName:animal.name,
      targetColorKey:color.key,
      colorKey:color.key,
      colorName:color.name,
      colorEmoji:color.emoji,
      category:cat,
      pickerMarkup:playerMarkup,
      pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,
      seconds:Number(document.getElementById("duration").value)||20
    });

    setTimeout(()=>{
      flash();
      if(hostArea){
        hostArea.innerHTML=`<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;
      }
      if(typeof hbHostPickerPopupShowV7I==="function"){
        hbHostPickerPopupShowV7I(bb36PickerHTML(animal.key,color.key,false,true));
      }

      db.ref("rooms/"+room+"/currentRound").set({
        id:currentRoundId,
        status:"ready",
        pickerMode:animal.key,
        animal:animal.key,
        animalKey:animal.key,
        animalName:animal.name,
        targetColorKey:color.key,
        colorKey:color.key,
        colorName:color.name,
        colorEmoji:color.emoji,
        category:cat,
        pickerMarkup:playerMarkup,
        seconds:Number(document.getElementById("duration").value)||20
      });

      document.getElementById("playBtn").disabled=false;
      document.getElementById("showAnswerBtn").disabled=false;
      document.getElementById("hostScorePanel").classList.remove("hidden");

      const st=document.getElementById("hostStatus");
      if(st)st.textContent="Kleur bekend. Klik nu op Speel verborgen nummer.";
      if(typeof hbHostPickerPopupHideV7I==="function")setTimeout(hbHostPickerPopupHideV7I,3000);
    },5000);
  };

  // Als oude code na onze override toch het oude picker scherm terugzet, vervangen we het direct.
  function bb36ForceReplaceOldPicker(){
    ["hostPickerArea","dashPickerArea","playerPickerArea"].forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      const html=el.innerHTML||"";
      const looksOld = html.includes("dashDisco") || html.includes("discoIcon") || html.includes("Disco") || html.includes("Kleurenmixer start") || html.includes("Vos kiest een kleur") || html.includes("kiest een kleur...");
      if(looksOld && !html.includes("data-bb36")){
        el.innerHTML=bb36PickerHTML("monkey","yellow",id!=="hostPickerArea",false);
      }
    });
  }

  bb36HideSound();
  setTimeout(bb36HideSound,100);
  setTimeout(bb36HideSound,700);
  setTimeout(bb36ForceReplaceOldPicker,700);
  setInterval(()=>{bb36HideSound();bb36ForceReplaceOldPicker();},1500);
})();








/* removed old category patch */




/* removed old category patch */



/* removed old category storage block */




/* removed old category save block */




/* removed old category save block */




/* removed old category save block */



/* ==================================================
   V50 WERKENDE CATEGORIE OPSLAAN KNOP
   - Knop slaat direct lokaal op
   - Probeert ook Firebase
   - Bij Spotify-login/startpopup/reload worden opgeslagen categorieën teruggezet
   - Oude opslagkeys worden niet gebruikt
   ================================================== */
(function(){
  const IDS = ["cat-yellow","cat-pink","cat-purple","cat-blue","cat-green"];
  const KEY = id => "bb_v50_saved_" + id;
  const FIREBASE_PATH = "globalSettings/categories";

  let applying = false;

  function get(id){ return document.getElementById(id); }

  function setStatus(text){
    const st = document.getElementById("saveCategoriesStatus");
    if(st) st.textContent = text;
  }

  function readFields(){
    const data = {};
    IDS.forEach(id=>{
      const el = get(id);
      data[id] = el ? (el.value || "") : "";
    });
    return data;
  }

  function writeFields(data){
    applying = true;
    IDS.forEach(id=>{
      const el = get(id);
      if(!el) return;
      const value = Object.prototype.hasOwnProperty.call(data,id) ? (data[id] || "") : "";
      el.value = value;
      el.defaultValue = value;
      el.setAttribute("value", value);
    });
    applying = false;
  }

  function saveLocal(data){
    IDS.forEach(id=>{
      localStorage.setItem(KEY(id), data[id] || "");
    });
    localStorage.setItem("bb_v50_categories_saved", "1");
  }

  function loadLocal(){
    if(localStorage.getItem("bb_v50_categories_saved") !== "1") return false;
    const data = {};
    IDS.forEach(id=>{
      data[id] = localStorage.getItem(KEY(id)) || "";
    });
    writeFields(data);
    return true;
  }

  function saveFirebase(data){
    if(typeof db === "undefined" || !db || !db.ref){
      return Promise.reject(new Error("Firebase niet beschikbaar"));
    }
    return db.ref(FIREBASE_PATH).set(data);
  }

  function loadFirebase(){
    if(typeof db === "undefined" || !db || !db.ref) return;
    if(localStorage.getItem("bb_v50_categories_saved") === "1") return;

    db.ref(FIREBASE_PATH).once("value").then(snap=>{
      const data = snap.val();
      if(data){
        writeFields(data);
        saveLocal(data);
        setStatus("Categorieën geladen ✅");
      }
    }).catch(()=>{});
  }

  function saveCategories(){
    const data = readFields();
    saveLocal(data);
    writeFields(data);
    setStatus("Categorieën opgeslagen ✅");

    saveFirebase(data).then(()=>{
      setStatus("Categorieën opgeslagen ✅");
    }).catch(()=>{
      setStatus("Lokaal opgeslagen ✅");
    });
  }

  function bindButton(){
    const btn = document.getElementById("saveCategoriesBtn");
    if(btn && btn.dataset.v50Bound !== "1"){
      btn.dataset.v50Bound = "1";
      btn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();
        saveCategories();
      }, true);
    }
  }

  function protectAfterButtons(){
    document.querySelectorAll("button,a").forEach(btn=>{
      if(btn.dataset.v50CatProtect === "1") return;
      btn.dataset.v50CatProtect = "1";
      ["click","pointerdown","touchstart","mousedown"].forEach(ev=>{
        btn.addEventListener(ev,()=>{
          if(btn.id === "saveCategoriesBtn") return;
          setTimeout(loadLocal,0);
          setTimeout(loadLocal,100);
          setTimeout(loadLocal,400);
          setTimeout(loadLocal,1000);
        },true);
      });
    });
  }

  function init(){
    bindButton();
    protectAfterButtons();
    if(loadLocal()){
      setStatus("Categorieën geladen ✅");
    }else{
      loadFirebase();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("pageshow", ()=>setTimeout(init,50));
  window.addEventListener("focus", ()=>setTimeout(init,50));
  document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "visible") setTimeout(init,50);
  });

  const obs = new MutationObserver(()=>setTimeout(init,20));
  setTimeout(()=>{
    if(document.body && !window.__bbV50CatObserver){
      window.__bbV50CatObserver = true;
      obs.observe(document.body,{childList:true,subtree:true});
    }
    init();
  },100);

  setTimeout(init,300);
  setTimeout(init,1000);
})();
