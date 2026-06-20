const CLIENT_ID="4765b89201b44558a7d5141f9b93c178";
const REDIRECT_URI=location.origin+location.pathname;
const SCOPES=["streaming","user-read-email","user-read-private","user-read-playback-state","user-modify-playback-state"].join(" ");
const firebaseConfig={apiKey:"AIzaSyCcquz1mpz3FsmFFBKgJLgpbkHCajTUpzY",authDomain:"hitster-bingo-cb792.firebaseapp.com",databaseURL:"https://hitster-bingo-cb792-default-rtdb.europe-west1.firebasedatabase.app",projectId:"hitster-bingo-cb792",storageBucket:"hitster-bingo-cb792.firebasestorage.app",messagingSenderId:"98696776977",appId:"1:98696776977:web:e797e555e2d9b38bcc99b0"};
const COLORS=[{key:"yellow",name:"GEEL",emoji:"🟨",input:"cat-yellow",hex:"#ffd21f"},{key:"pink",name:"ROZE",emoji:"🩷",input:"cat-pink",hex:"#ff4f93"},{key:"purple",name:"PAARS",emoji:"🟪",input:"cat-purple",hex:"#8d35ff"},{key:"blue",name:"BLAUW",emoji:"🟦",input:"cat-blue",hex:"#19a8ff"},{key:"green",name:"GROEN",emoji:"🟩",input:"cat-green",hex:"#62d321"}];
let db, player, deviceId="", accessToken=localStorage.spotify_access_token||"", refreshToken=localStorage.spotify_refresh_token||"", expiresAt=Number(localStorage.spotify_expires_at||0);
let tracks=JSON.parse(localStorage.hb_csv_tracks||"[]"), currentTrack=null, currentRoomCode="", currentRoundId="", currentPlayerId=localStorage.hb_player_id||"", currentPlayerName=localStorage.hb_player_name||"", activeRound=null;
let stopTimer=null, lockTimer=null, screenTimer=null, audioCtx=null, lastBingoKey=localStorage.hb_last_bingo_key||"";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const emoji=k=>({yellow:"🟨",pink:"🩷",purple:"🟪",blue:"🟦",green:"🟩",free:"⭐"}[k]||"⬜");

function init(){if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);db=firebase.database();wire();handleRedirect().then(updateStatus);setupPlayerMode();restoreHost();}
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
async function activatePlayer(){let t=await getToken();if(!t){alert("Login eerst.");return}if(!window.Spotify){alert("Spotify speler nog niet geladen.");return}if(player){await player.connect();return}player=new Spotify.Player({name:"Hitster Bingo",getOAuthToken:async cb=>cb(await getToken()),volume:.8});player.addListener("ready",({device_id})=>{deviceId=device_id;$("loginStatus").textContent+=" — speler actief."});await player.connect()}

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
function renderHostPlayers(room){let ps=room.players||{};$("hostPlayers").innerHTML=Object.values(ps).length?Object.values(ps).map(p=>`<div class="playerRow ${p.ready?"ready":""}"><strong>${esc(p.name)}</strong><span>${p.ready?"✅ READY":"⏳ wacht"}</span></div>`).join(""):"Nog geen spelers."}
function allReady(room){let ps=Object.values(room.players||{});return ps.length>0&&ps.every(p=>p.ready)}
function hostReadyState(room){let r=room.currentRound||{},btn=$("startRoundBtn");if(["picking","ready","answering","locked"].includes(r.status))return;if(allReady(room)){btn.disabled=false;btn.textContent="🎲 START RONDE";$("hostStatus").textContent="Iedereen is READY."}else{btn.disabled=true;btn.textContent="⏳ Wachten op READY";let not=Object.values(room.players||{}).filter(p=>!p.ready).map(p=>p.name).join(", ");$("hostStatus").textContent=not?"Nog niet ready: "+not:"Wachten op spelers."}}

// Round host
function flash(){let f=document.createElement("div");f.className="flash";document.body.appendChild(f);setTimeout(()=>f.remove(),700)}
function pickerHTML(mode){return mode==="wheel"?`<div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div><div class="pickerTitle">Draairad draait...</div>`:`<div class="discoIcon">🪩</div><div class="pickerTitle">Discobal kiest...</div>`}
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
function renderHostScore(room){let r=room.currentRound||{};if(!r.id)return;$("hostScorePanel").classList.remove("hidden");$("hostRoundInfo").textContent=`${r.colorEmoji||""} ${r.colorName||""} — ${r.category||""} — ${r.status||""}`;let ps=room.players||{},ans=room.answers?.[r.id]||{},cor=room.correct?.[r.id]||{};$("hostScoreboard").innerHTML=Object.entries(ps).map(([pid,p])=>{let st=cor[pid],cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending";return `<div class="scoreCard ${cls}"><div>${esc(p.name)}</div><div>${esc(ans[pid]?.answer||"Geen antwoord")}</div><div><button type="button" class="goodBtn ${st===true?"goodSelected":""}" data-pid="${pid}" data-good="true">✅</button><button type="button" class="badBtn ${st===false?"badSelected":""}" data-pid="${pid}" data-good="false">❌</button></div></div>`}).join("")}
function scoreboardClick(e){let btn=e.target.closest("button[data-pid]");if(!btn)return;e.preventDefault();let pid=btn.dataset.pid,good=btn.dataset.good==="true";db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{let r=s.val()||{};if(!r.id)throw Error("Geen actieve ronde.");return db.ref("rooms/"+currentRoomCode+"/correct/"+r.id+"/"+pid).set(good)}).then(()=>{$("hostStatus").textContent="✅ Beoordeling opgeslagen."}).catch(err=>alert(err.message))}
function publishResults(){db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{},up={};up["rooms/"+currentRoomCode+"/currentRound/status"]="judged";Object.keys(room.players||{}).forEach(pid=>up["rooms/"+currentRoomCode+"/players/"+pid+"/ready"]=false);return db.ref().update(up)}).then(()=>{$("hostStatus").textContent="Resultaten verzonden. Goede spelers mogen kiezen."})}

// Player listen/render
function listenPlayer(){db.ref("rooms/"+currentRoomCode).on("value",s=>{let room=s.val()||{},r=room.currentRound||{};activeRound=r;renderLobby(room);if(!r.id){showScreen("screenLobby");return}if(r.status==="picking"){renderPlayerPicker(r);showScreen("screenPicker");return}if(r.status==="ready"){renderColor(r);showScreen("screenColor");return}if(r.status==="answering"){renderAnswer(room,r);showScreen("screenAnswer");return}if(r.status==="locked"){renderScore(room);showScreen("screenScore");return}if(r.status==="judged"){renderScore(room);let me=room.players?.[currentPlayerId]||{},good=room.correct?.[r.id]?.[currentPlayerId]===true,picked=me.lastPickedRound===r.id;if(good&&!picked){renderPick(room,r);showScreen("screenPick")}else showScreen("screenScore")}});listenBingo(currentRoomCode)}
function renderLobby(room){let ps=room.players||{},me=ps[currentPlayerId]||{};$("playerList").innerHTML=Object.entries(ps).map(([pid,p])=>`<div class="playerRow ${p.ready?"ready":""}" onclick="showOther('${pid}')"><strong>${esc(p.name)}${pid===currentPlayerId?" (jij)":""}</strong><span>${p.ready?"✅ READY":"⏳ wacht"}</span></div>`).join("");let total=Object.keys(ps).length,ready=Object.values(ps).filter(p=>p.ready).length;$("lobbyInfo").textContent=`${ready}/${total} spelers ready`;renderCard("ownCard",me.card||[],me.marked||{});$("readyBtn").disabled=!!me.ready}
function showOther(pid){db.ref("rooms/"+currentRoomCode+"/players/"+pid).once("value").then(s=>{let p=s.val();if(!p)return;$("otherCardBox").classList.remove("hidden");$("otherCardTitle").textContent="Kaart van "+p.name;renderCard("otherCard",p.card||[],p.marked||{})})}
window.showOther=showOther;
function renderCard(id,card,marked,click=false,r=null){let el=$(id);if(!el)return;el.innerHTML=(card||[]).map((c,i)=>{let m=marked&&marked[i],pickable=click&&r&&c===r.colorKey&&c!=="free"&&!m,blocked=click&&!pickable&&c!=="free"&&!m;return `<div class="bingoCell ${c==="free"?"free":""} ${pickable?"pickableCell":""} ${blocked?"blockedCell":""}" data-i="${i}">${m?"✅":emoji(c)}</div>`}).join("");if(click)el.querySelectorAll(".pickableCell").forEach(x=>x.addEventListener("click",()=>pickCell(Number(x.dataset.i))))}
function renderPlayerPicker(r){$("playerPickerArea").innerHTML=pickerHTML(r.pickerMode||"disco")}
function renderColor(r){$("colorDisplay").innerHTML=`${r.colorEmoji}<br>${r.colorName}`;$("categoryDisplay").textContent=r.category}
function renderAnswer(room,r){$("answerRoundInfo").textContent=`${r.colorEmoji} ${r.colorName} — ${r.category}`;let ex=room.answers?.[r.id]?.[currentPlayerId];if(ex){$("answerInput").value=ex.answer;$("answerInput").disabled=true;$("submitAnswerBtn").disabled=true;$("answerStatus").textContent="🔒 Antwoord ingeleverd."}else{$("answerInput").disabled=false;$("submitAnswerBtn").disabled=false;$("answerStatus").textContent="Typ je antwoord."}clearInterval(screenTimer);screenTimer=setInterval(()=>{let left=Math.max(0,Math.ceil(((r.deadlineMs||0)-Date.now())/1000));$("timerBox").textContent="⏱️ "+left+" sec";if(left<=0){clearInterval(screenTimer);$("answerInput").disabled=true;$("submitAnswerBtn").disabled=true}},300)}
function submitAnswer(){if(!activeRound?.id)return;db.ref("rooms/"+currentRoomCode+"/answers/"+activeRound.id+"/"+currentPlayerId).set({answer:$("answerInput").value||"",submittedAt:firebase.database.ServerValue.TIMESTAMP}).then(()=>showScreen("screenScore"))}
function renderScore(room){let r=room.currentRound||{},box=$("correctAnswerBox"),ans=r.correctAnswer;if(ans){box.classList.remove("hidden");box.innerHTML=`<h3>✅ Juiste antwoord</h3><p>🎵 ${esc(ans.track||"-")}</p><p>👤 ${esc(ans.artist||"-")}</p><p>📅 ${esc(ans.year||"-")}</p><p>💿 ${esc(ans.album||"-")}</p>`}else box.classList.add("hidden");let ps=room.players||{},answers=room.answers?.[r.id]||{},cor=room.correct?.[r.id]||{};$("playerScoreboard").innerHTML=Object.entries(ps).map(([pid,p])=>{let st=r.status==="judged"?cor[pid]:undefined,cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending",icon=st===true?"✅":st===false?"❌":"⏳";return `<div class="scoreCard ${cls}"><div class="scoreName" onclick="showOther('${pid}')">${esc(p.name)}${pid===currentPlayerId?" (jij)":""}</div><div>${esc(answers[pid]?.answer||"Geen antwoord")}</div><div>${icon}</div></div>`}).join("")}
function renderPick(room,r){let me=room.players?.[currentPlayerId]||{};$("pickInfo").textContent=`Kies 1 ${r.colorEmoji} ${r.colorName} vakje.`;renderCard("pickCard",me.card||[],me.marked||{},true,r)}
function checkBingo(marked){let lines=[[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];return lines.some(line=>line.every(i=>i===12||(marked&&marked[i])))}
function pickCell(i){db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).once("value").then(s=>{let p=s.val()||{},marked=p.marked||{},card=p.card||[];if(card[i]!==activeRound.colorKey||marked[i])return;marked[i]=true;let bingo=checkBingo(marked);db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).update({marked,bingo,lastPickedRound:activeRound.id,ready:true}).then(()=>{if(bingo)db.ref("rooms/"+currentRoomCode+"/bingos").push({name:currentPlayerName,roundId:activeRound.id,at:firebase.database.ServerValue.TIMESTAMP});showScreen("screenLobby")})})}

// Audio/winner
function activateSound(){try{let C=window.AudioContext||window.webkitAudioContext;if(C&&!audioCtx)audioCtx=new C();if(audioCtx&&audioCtx.state==="suspended")audioCtx.resume();$("soundStatus").textContent="✅ Host-geluid actief."}catch(e){}}
function tune(){try{let C=window.AudioContext||window.webkitAudioContext;if(!audioCtx&&C)audioCtx=new C();if(!audioCtx)return;[523,659,784,1046].forEach((f,i)=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f;o.connect(g);g.connect(audioCtx.destination);let t=audioCtx.currentTime+i*.18;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.3,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.start(t);o.stop(t+.18)})}catch(e){}}
function speak(name){try{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance("Aiiii mi hende. Speler "+name+" heeft bingo!");u.lang="nl-NL";u.rate=.9;speechSynthesis.speak(u)}catch(e){}}
function confetti(){let cs=["#ffd21f","#ff4f93","#8d35ff","#19a8ff","#62d321","#fff"];for(let i=0;i<90;i++){let p=document.createElement("div");p.className="confetti";p.style.left=Math.random()*100+"vw";p.style.background=pick(cs);document.body.appendChild(p);setTimeout(()=>p.remove(),3500)}}
function showWinner(name){if($("winnerPanel")){$("winnerPanel").classList.remove("hidden");$("winnerMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}if($("hostBingoPanel")){$("hostBingoPanel").classList.remove("hidden");$("hostBingoMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}confetti();tune();setTimeout(()=>speak(name),700)}
function listenBingo(room){db.ref("rooms/"+room+"/bingos").on("child_added",s=>{let b=s.val()||{},key=s.key+"_"+(b.roundId||"");if(key===lastBingoKey)return;lastBingoKey=key;localStorage.hb_last_bingo_key=key;showWinner(b.name||"onbekend")})}

init();


/* =========================
   V4 PICKER FIX
   Spelers zien dezelfde discobal/draairad animatie als host
   ========================= */

function sharedPickerHTML(mode){
  if(mode === "wheel"){
    return `<div class="playerPickerBig">
      <div class="wheelWrap"><div class="pointer"></div><div class="wheel"></div></div>
      <div class="pickerTitle">Draairad draait...</div>
    </div>`;
  }

  return `<div class="playerPickerBig">
    <div class="discoIcon">🪩</div>
    <div class="pickerTitle">Discobal kiest...</div>
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
        `<h3>✅ Juiste antwoord</h3>
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
    const icon = st === true ? "✅" : st === false ? "❌" : (hasAnswer ? "📝" : "⏳");

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
      `<h3>✅ Juiste antwoord</h3>
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
    const icon = st === true ? "✅" : st === false ? "❌" : (hasAnswer ? "📝" : "⏳");

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

function colorHexV5(key){
  return {
    yellow:"#ffd21f",
    pink:"#ff4f93",
    purple:"#8d35ff",
    blue:"#19a8ff",
    green:"#62d321",
    free:"#ffcf42"
  }[key] || "rgba(255,255,255,.18)";
}

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
        <h3>✅ Juiste antwoord</h3>
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

function playerColorByIndex(i){
  const colors = ["#8d35ff","#ff4f93","#ff7a00","#19a8ff","#62d321","#ffd21f"];
  return colors[i % colors.length];
}

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
    const icon = st === true ? "✅" : st === false ? "❌" : (hasAnswer ? "📝" : "⏳");
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
    else if(picked) hint.textContent = "✅ Vakje gekozen";
    else hint.textContent = "Jouw bingokaart";
  }
  if(status){
    if(canPick) status.textContent = "Tik op een geldig kleurvakje";
    else if(me.ready) status.textContent = "✅ READY voor volgende ronde";
    else status.textContent = "Wachten op ronde";
  }

  box.innerHTML = card.map((c,i) => {
    const bg = colorHexV5(c);
    const isMarked = marked[i] || i === 12;
    const pickable = canPick && c === r.colorKey && c !== "free" && !marked[i];
    return `<div class="compactCell ${c==="free" ? "free" : ""} ${isMarked ? "marked" : ""} ${pickable ? "pickable" : ""}" data-i="${i}" style="background:${bg}">
      ${isMarked ? "👑" : ""}
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
    area.innerHTML = `<div class="dashDisco">🪩</div><div class="dashCatText">Wachten op host</div>`;
    return;
  }

  if(r.status === "picking"){
    if(r.pickerMode === "wheel"){
      area.innerHTML = `<div class="dashWheel"></div><div class="dashCatText">Draairad draait...</div>`;
    }else{
      area.innerHTML = `<div class="dashDisco">🪩</div><div class="dashCatText">Discobal kiest...</div>`;
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

function hbColor(k){
  return {yellow:"#ffd21f",pink:"#ff4f93",purple:"#8d35ff",blue:"#19a8ff",green:"#62d321",free:"#ffcf42"}[k] || "#333";
}

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
      <h3>✅ Juiste antwoord</h3>
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
  const colors = ["#8d35ff","#ff4f93","#ff7a00","#19a8ff","#62d321","#ffd21f"];

  box.innerHTML = Object.entries(players).map(([pid,p],idx)=>{
    const has = answers[pid] && typeof answers[pid].answer !== "undefined";
    const ans = has && String(answers[pid].answer).trim() ? answers[pid].answer : (has ? "leeg" : "...");
    const st = r && r.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "good" : st === false ? "bad" : "";
    const icon = st === true ? "✅" : st === false ? "❌" : (has ? "📝" : "⏳");
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
  if(status) status.textContent = canPick ? "Tik op een geldig vakje" : (me.ready ? "✅ READY" : "Wachten");

  box.innerHTML = card.map((c,i)=>{
    const isMarked = marked[i] || i === 12;
    const pickable = canPick && c === r.colorKey && c !== "free" && !marked[i];
    return `<div class="compactCell ${c==="free"?"free":""} ${isMarked?"marked":""} ${pickable?"pickable":""}" data-i="${i}" style="background:${hbColor(c)}">${isMarked ? "👑" : ""}</div>`;
  }).join("");

  box.querySelectorAll(".pickable").forEach(cell => {
    cell.addEventListener("click", () => pickCell(Number(cell.dataset.i)));
  });
}

function hbRenderPicker(r){
  const area = document.getElementById("dashPickerArea");
  if(!area) return;

  if(!r || !r.id){
    area.innerHTML = `<div class="dashDisco">🪩</div><div class="dashCatText">Wachten op host...</div>`;
    return;
  }

  if(r.status === "picking"){
    if(r.pickerMode === "wheel"){
      area.innerHTML = `<div class="dashWheel"></div><div class="dashCatText">Draairad draait...</div>`;
    }else{
      area.innerHTML = `<div class="dashDisco">🪩</div><div class="dashCatText">Discobal kiest...</div>`;
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
  const colors = ["#8d35ff","#ff4f93","#ff7a00","#19a8ff","#62d321","#ffd21f"];

  box.innerHTML = Object.entries(players).map(([pid,p],idx)=>{
    const has = answers[pid] && typeof answers[pid].answer !== "undefined";
    const ans = has && String(answers[pid].answer).trim() ? answers[pid].answer : (has ? "Leeg antwoord" : "Nog niet ingevuld");
    const st = r && r.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "good" : st === false ? "bad" : "";
    const icon = st === true ? "✅" : st === false ? "❌" : (has ? "📝" : "⏳");
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
  return "👑";
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
  if(status) status.textContent = canPick ? "Tik op een geldig vakje" : (me.ready ? "✅ READY" : "Wachten");

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
  const colors = ["#8d35ff","#ff4f93","#ff7a00","#19a8ff","#62d321","#ffd21f"];
  const pidMe = hbSafePidV51();

  box.innerHTML = Object.entries(players).map(([pid,p],idx)=>{
    const has = answers[pid] && typeof answers[pid].answer !== "undefined";
    const ans = has && String(answers[pid].answer).trim() ? answers[pid].answer : (has ? "Leeg antwoord" : "Nog niet ingevuld");
    const st = r && r.status === "judged" ? correct[pid] : undefined;
    const cls = st === true ? "good" : st === false ? "bad" : "";
    const icon = st === true ? "✅" : st === false ? "❌" : (has ? "📝" : "⏳");
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

function hbSetNameTopV52(){
  const rn = document.getElementById("dashRoundNo");
  if(rn) rn.textContent = hbPlayerNameV52();
}

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

function forceNameOnlyTop(){
  const pill = document.querySelector(".dashTop .dashPill:first-child");
  const name =
    (currentPlayerName ||
     localStorage.getItem("hb_player_name") ||
     document.getElementById("playerNameInput")?.value ||
     "Speler").trim();

  if(pill){
    pill.innerHTML = `<span id="dashRoundNo">${name}</span>`;
  }

  const rn = document.getElementById("dashRoundNo");
  if(rn) rn.textContent = name;
}

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
setInterval(forceNameOnlyTop, 500);
setTimeout(forceNameOnlyTop, 100);
setTimeout(forceNameOnlyTop, 1000);
setTimeout(forceNameOnlyTop, 2500);


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


/* AUTO RESUME ROOM - no Spotify changes */
setInterval(function(){
  try{
    if(typeof currentRoomCode !== "undefined" && currentRoomCode){
      localStorage.setItem("hb_last_room_auto", currentRoomCode);
    }
  }catch(e){}
},2000);

window.addEventListener("load", function(){
  try{
    if(new URLSearchParams(location.search).get("room")) return;

    const saved = localStorage.getItem("hb_last_room_auto");
    if(!saved) return;

    setTimeout(function(){
      if(typeof currentRoomCode !== "undefined" && !currentRoomCode){
        currentRoomCode = saved;

        try{ if(typeof showRoom==="function") showRoom(); }catch(e){}
        try{ if(typeof listenHost==="function") listenHost(saved); }catch(e){}
        try{ if(typeof listenBingo==="function") listenBingo(saved); }catch(e){}

        const st=document.getElementById("hostStatus");
        if(st) st.textContent="Kamer automatisch hervat. Klaar voor nieuwe ronde.";
      }
    },2500);
  }catch(e){}
});
