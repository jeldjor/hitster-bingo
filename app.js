
/* Bingo Beats V83 CLEAN CORE */
const CLIENT_ID="4765b89201b44558a7d5141f9b93c178",REDIRECT_URI=location.origin+location.pathname,SCOPES=["streaming","user-read-email","user-read-private","user-read-playback-state","user-modify-playback-state"].join(" ");
const firebaseConfig={apiKey:"AIzaSyCcquz1mpz3FsmFFBKgJLgpbkHCajTUpzY",authDomain:"hitster-bingo-cb792.firebaseapp.com",databaseURL:"https://hitster-bingo-cb792-default-rtdb.europe-west1.firebasedatabase.app",projectId:"hitster-bingo-cb792",storageBucket:"hitster-bingo-cb792.firebasestorage.app",messagingSenderId:"98696776977",appId:"1:98696776977:web:e797e555e2d9b38bcc99b0"};
const COLORS=[{key:"yellow",name:"GOUD",emoji:"🟡",input:"cat-yellow",hex:"#FFCC33"},{key:"pink",name:"AQUA",emoji:"🩵",input:"cat-pink",hex:"#00D4C7"},{key:"purple",name:"ORANJE",emoji:"🟠",input:"cat-purple",hex:"#FF8A1F"},{key:"blue",name:"LIME",emoji:"🟢",input:"cat-blue",hex:"#7ED957"},{key:"green",name:"KORAAL",emoji:"🔴",input:"cat-green",hex:"#FF5A5F"}];
const TEST_LICENSE_CODE="TEST-2026",$=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])),pick=a=>a[Math.floor(Math.random()*a.length)];
let db,player,deviceId="",accessToken=localStorage.spotify_access_token||"",refreshToken=localStorage.spotify_refresh_token||"",expiresAt=Number(localStorage.spotify_expires_at||0),tracks=JSON.parse(localStorage.hb_csv_tracks||"[]"),currentTrack=null,currentRoomCode="",currentRoundId="",currentPlayerId=localStorage.hb_player_id||"",currentPlayerName=localStorage.hb_player_name||"",activeRound=null,stopTimer=null,lockTimer=null,dashTimer=null,audioCtx=null,bingoSeenKey=localStorage.hb_last_bingo_key||"";
const feedbackSeen={};
function isPlayerPage(){return !!new URLSearchParams(location.search).get("room")}
document.addEventListener("DOMContentLoaded",init);
function init(){wireLicense();checkLicenseGate()}
function wireLicense(){$("licenseBtn")?.addEventListener("click",activateLicense);$("licenseInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")activateLicense()})}
function checkLicenseGate(){let l=JSON.parse(localStorage.getItem("bb_license")||"null");(!l||l.code!==TEST_LICENSE_CODE||l.active!==true)?showLicenseScreen("Voer een geldige licentiecode in."):unlockApp()}
function activateLicense(){let c=($("licenseInput")?.value||"").trim().toUpperCase();if(c!==TEST_LICENSE_CODE)return showLicenseScreen("Ongeldige licentiecode.");localStorage.setItem("bb_license",JSON.stringify({code:TEST_LICENSE_CODE,active:true,type:"test",activatedAt:new Date().toISOString()}));if($("licenseStatus")){$("licenseStatus").textContent="Licentie geactiveerd.";$("licenseStatus").className="small licenseSuccess"}setTimeout(unlockApp,350)}
function showLicenseScreen(m){$("licenseScreen")?.classList.remove("hidden");$("mainHeader")?.classList.add("hidden");$("hostApp")?.classList.add("hidden");$("playerApp")?.classList.add("hidden");if($("licenseStatus")){$("licenseStatus").textContent=m||"";$("licenseStatus").className="small licenseError"}}
function unlockApp(){$("licenseScreen")?.classList.add("hidden");$("mainHeader")?.classList.remove("hidden");if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);db=firebase.database();wireApp();handleRedirect().then(updateStatus).catch(console.error);isPlayerPage()?setupPlayerMode():setupHostMode()}
function wireApp(){[["loginBtn",login],["logoutBtn",logout],["activateBtn",activatePlayer],["newRoomBtn",createRoom],["soundBtn",activateSound],["startRoundBtn",startRound],["playBtn",playHidden],["stopBtn",stopPlayback],["showAnswerBtn",showAnswer],["lockBtn",lockRound],["publishBtn",publishResults],["joinBtn",joinPlayer],["newGameBtn",openNewGameModal],["cancelNewGameBtn",closeNewGameModal],["confirmNewGameBtn",bbStartNewGameSameRoom]].forEach(([i,f])=>$(i)?.addEventListener("click",f));$("csvFile")?.addEventListener("change",handleCsv);$("resetUsedBtn")?.addEventListener("click",()=>{localStorage.removeItem("hb_used");updateStatus()});$("hostScoreboard")?.addEventListener("click",scoreboardClick);document.addEventListener("click",e=>{if(e.target?.id==="copyRoomLinkBtn"){e.preventDefault();copyRoomLink()}})}
function setModeLabel(t){if($("modeText"))$("modeText").textContent=t}
async function login(){let v=rand(96);localStorage.spotify_code_verifier=v;location.href="https://accounts.spotify.com/authorize?"+new URLSearchParams({response_type:"code",client_id:CLIENT_ID,scope:SCOPES,code_challenge_method:"S256",code_challenge:b64(await sha(v)),redirect_uri:REDIRECT_URI})}
function rand(l){let c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~",o="",b=new Uint8Array(l);crypto.getRandomValues(b);b.forEach(x=>o+=c[x%c.length]);return o}async function sha(s){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))}function b64(b){return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
async function handleRedirect(){let code=new URLSearchParams(location.search).get("code");if(!code)return;let r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:CLIENT_ID,grant_type:"authorization_code",code,redirect_uri:REDIRECT_URI,code_verifier:localStorage.spotify_code_verifier||""})}),d=await r.json();if(d.access_token){saveTokens(d);history.replaceState({},document.title,REDIRECT_URI)}else alert("Spotify login fout.")}
function saveTokens(d){accessToken=d.access_token;if(d.refresh_token)refreshToken=d.refresh_token;expiresAt=Date.now()+d.expires_in*1000-60000;localStorage.spotify_access_token=accessToken;if(refreshToken)localStorage.spotify_refresh_token=refreshToken;localStorage.spotify_expires_at=expiresAt}
async function getToken(){if(accessToken&&Date.now()<expiresAt)return accessToken;if(!refreshToken)return"";let r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken,client_id:CLIENT_ID})}),d=await r.json();if(d.access_token){saveTokens(d);return accessToken}return""}
async function api(u,o={}){let t=await getToken();if(!t)throw Error("Niet ingelogd.");let r=await fetch(u,{...o,headers:{...(o.headers||{}),Authorization:"Bearer "+t,"Content-Type":"application/json"}});if(r.status===204)return{};let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error?.message||"Spotify fout.");return d}
function logout(){["spotify_access_token","spotify_refresh_token","spotify_expires_at"].forEach(k=>localStorage.removeItem(k));accessToken=refreshToken="";expiresAt=0;updateStatus()}window.onSpotifyWebPlaybackSDKReady=()=>{};
async function activatePlayer(){let t=await getToken();if(!t)return alert("Login eerst met Spotify.");if(!window.Spotify)return alert("Spotify speler nog niet geladen.");if(player){await player.connect();return}player=new Spotify.Player({name:"Bingo Beats",getOAuthToken:async cb=>cb(await getToken()),volume:.8});player.addListener("ready",({device_id})=>{deviceId=device_id;if($("loginStatus"))$("loginStatus").textContent+=" — speler actief."});await player.connect()}
async function updateStatus(){if($("csvStatus"))$("csvStatus").textContent=tracks.length?`${tracks.length} nummers geladen.`:"Nog geen CSV geladen.";if(!$("loginStatus"))return;if(await getToken()){try{let me=await api("https://api.spotify.com/v1/me");$("loginStatus").textContent="Ingelogd als: "+(me.display_name||me.email||"Spotify gebruiker");if($("activateBtn"))$("activateBtn").disabled=false}catch(e){$("loginStatus").textContent="Ingelogd."}}else{$("loginStatus").textContent="Nog niet ingelogd.";if($("activateBtn"))$("activateBtn").disabled=true}}
function parseCSV(t){let rows=[],r=[],c="",q=false;for(let i=0;i<t.length;i++){let ch=t[i],n=t[i+1];if(ch=='"'&&q&&n=='"'){c+='"';i++}else if(ch=='"')q=!q;else if(ch==","&&!q){r.push(c);c=""}else if((ch=="\n"||ch=="\r")&&!q){if(ch=="\r"&&n=="\n")i++;r.push(c);c="";if(r.some(v=>v.trim()))rows.push(r);r=[]}else c+=ch}r.push(c);if(r.some(v=>v.trim()))rows.push(r);return rows}function norm(h){return String(h||"").toLowerCase().replace(/[^a-z0-9]/g,"")}function findI(h,n){let a=h.map(norm);for(let x of n){let i=a.indexOf(norm(x));if(i>=0)return i}return-1}function tid(u){let s=String(u||"").trim(),m=s.match(/spotify:track:([a-zA-Z0-9]+)/)||s.match(/track\/([a-zA-Z0-9]+)/);return m?m[1]:(/^[a-zA-Z0-9]{15,}$/.test(s)?s:"")}
function handleCsv(e){let f=e.target.files?.[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{loadCsv(r.result)}catch(err){alert(err.message)}};r.readAsText(f)}
function loadCsv(text){let rows=parseCSV(text),h=rows[0]||[],ui=findI(h,["Track URI","Spotify URI","URI"]),ti=findI(h,["Track Name","Name","Title"]),ai=findI(h,["Artist Name(s)","Artist Names","Artists","Artist"]),al=findI(h,["Album Name","Album"]),ri=findI(h,["Release Date","Release"]),di=findI(h,["Duration (ms)","Duration"]);if(ui<0||ti<0||ai<0)throw Error("CSV mist Track URI, Track Name of Artist Name(s).");let out=[],seen=new Set();for(let i=1;i<rows.length;i++){let row=rows[i],id=tid(row[ui]);if(!id||seen.has(id))continue;seen.add(id);out.push({id,uri:"spotify:track:"+id,name:row[ti]||"Onbekend",artists:row[ai]||"Onbekend",album:al>=0?row[al]||"":"",release_date:ri>=0?row[ri]||"":"",duration_ms:Number(row[di])||180000})}tracks=out;localStorage.hb_csv_tracks=JSON.stringify(tracks);updateStatus()}
function chooseTrack(){if(!tracks.length)return null;let u=new Set(JSON.parse(localStorage.hb_used||"[]")),a=$("noRepeat")?.checked?tracks.filter(t=>!u.has(t.id)):tracks;if(!a.length){u=new Set();a=tracks}let t=pick(a);u.add(t.id);localStorage.hb_used=JSON.stringify([...u]);updateStatus();return t}
function setupHostMode(){setModeLabel("🎤 Host");document.body.classList.remove("playerMode");$("hostApp")?.classList.remove("hidden");$("playerApp")?.classList.add("hidden");restoreHost();showStartPopup()}
function getCats(){return{yellow:$("cat-yellow")?.value||"Voor of na 2001",pink:$("cat-pink")?.value||"Naam van artiest",purple:$("cat-purple")?.value||"Decennium",blue:$("cat-blue")?.value||"Jaartal +/- 2",green:$("cat-green")?.value||"Titel van track"}}function roomCode(){let c="",ch="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";for(let i=0;i<4;i++)c+=ch[Math.floor(Math.random()*ch.length)];return c}
function createRoom(){currentRoomCode=roomCode();db.ref("rooms/"+currentRoomCode).set({createdAt:firebase.database.ServerValue.TIMESTAMP,categories:getCats()}).then(()=>{localStorage.hb_host_room=currentRoomCode;localStorage.hb_last_stable_room=currentRoomCode;renderRoomBox(currentRoomCode);listenHost(currentRoomCode);listenBingo(currentRoomCode)})}
function restoreHost(){let s=localStorage.hb_host_room||localStorage.hb_last_stable_room||"";if(s&&!isPlayerPage()){currentRoomCode=s;renderRoomBox(s);listenHost(s);listenBingo(s)}}
function qrUrl(t){return"https://api.qrserver.com/v1/create-qr-code/?size=220x220&data="+encodeURIComponent(t||"")}function renderRoomBox(code){if(!code||!$("roomBox"))return;let link=location.origin+location.pathname+"?room="+code;$("roomBox").classList.remove("hidden");$("roomBox").innerHTML=`<div class="hostRoomGridClean"><div class="hostRoomCodeClean"><div class="roomLabelClean">SPELCODE</div><div class="roomCodeClean">${esc(code)}</div></div><div class="hostRoomLinkClean"><div class="roomLabelClean">DEEL DE LINK</div><input id="joinLink" readonly value="${esc(link)}"><button id="copyRoomLinkBtn" type="button" class="copyRoomLinkBtn">📋 Kopieer link</button></div><img class="hostQrClean" alt="QR code" src="${qrUrl(link)}"></div>`}
function copyRoomLink(){let input=$("joinLink"),btn=$("copyRoomLinkBtn"),code=currentRoomCode||localStorage.hb_host_room||"",link=input?.value||(code?location.origin+location.pathname+"?room="+code:"");if(!link)return;let done=()=>{if(btn){btn.textContent="✅ Gekopieerd";setTimeout(()=>btn.textContent="📋 Kopieer link",1500)}};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(link).then(done).catch(()=>{input?.select?.();document.execCommand("copy");done()});else{input?.select?.();document.execCommand("copy");done()}}
function listenHost(room){db.ref("rooms/"+room).off();db.ref("rooms/"+room).on("value",s=>{let d=s.val()||{};renderHostPlayers(d);renderHostScore(d);hostReadyState(d)})}
function renderHostPlayers(room){let ps=room.players||{},list=Object.values(ps);if(!$("hostPlayers"))return;$("hostPlayers").innerHTML=list.length?list.map(p=>`<div class="playerRow ${p.ready?"ready":""}"><strong>${esc(p.name||"Speler")}</strong><span>${p.ready?"🐵 READY":"⏳ wacht"}</span></div>`).join(""):"Nog geen spelers."}function allReady(room){let ps=Object.values(room.players||{});return ps.length>0&&ps.every(p=>p.ready)}
function hostReadyState(room){let r=room.currentRound||{},b=$("startRoundBtn");if(!b)return;if(["picking","ready","answering","locked"].includes(r.status))return;if(allReady(room)){b.disabled=false;b.textContent="🎲 START RONDE";if($("hostStatus"))$("hostStatus").textContent="Iedereen is READY."}else{b.disabled=true;b.textContent="⏳ Wachten op READY";let n=Object.values(room.players||{}).filter(p=>!p.ready).map(p=>p.name).join(", ");if($("hostStatus"))$("hostStatus").textContent=n?"Nog niet ready: "+n:"Wachten op spelers."}}
function pickerHTML(){return`<div class="bbPickerClean"><img src="bb_logo_purple.png" class="bbPickerLogoClean" alt="Bingo Beats"><div class="bbPickerTitleClean">🐵 BB-aap kiest een kleur...</div><div class="bbPickerDotsClean"><span style="--c:#FFCC33"></span><span style="--c:#00D4C7"></span><span style="--c:#FF8A1F"></span><span style="--c:#7ED957"></span><span style="--c:#FF5A5F"></span></div><div class="bbPickerSmallClean">Nog even spannend...</div></div>`}
function startRound(){if(!currentRoomCode)return alert("Maak eerst een kamer.");db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{};if(!allReady(room))return alert("Nog niet iedereen is READY.");currentTrack=chooseTrack();if(!currentTrack)return alert("Upload eerst CSV.");let up={};Object.keys(room.players||{}).forEach(pid=>up[`rooms/${currentRoomCode}/players/${pid}/ready`]=false);return db.ref().update(up).then(()=>startRoundVisual(currentRoomCode))})}
function startRoundVisual(room){if($("hostAnswerArea"))$("hostAnswerArea").innerHTML="";if($("playBtn")){$("playBtn").disabled=true;$("playBtn").textContent="🎵 Speel verborgen nummer"}if($("showAnswerBtn"))$("showAnswerBtn").disabled=true;if($("hostPickerArea"))$("hostPickerArea").innerHTML=pickerHTML();currentRoundId="r_"+Date.now();db.ref("rooms/"+room+"/currentRound").set({id:currentRoundId,status:"picking",pickerMode:"bb",pickerMarkup:pickerHTML(),pickerStartedAt:firebase.database.ServerValue.TIMESTAMP,seconds:Number($("duration")?.value)||20});setTimeout(()=>{flash();let color=pick(COLORS),cat=$(color.input)?.value||"Geen categorie";if($("hostPickerArea"))$("hostPickerArea").innerHTML=`<div class="colorDisplay">${color.emoji}<br>${color.name}</div><div class="categoryDisplay">${esc(cat)}</div>`;db.ref("rooms/"+room+"/currentRound").set({id:currentRoundId,status:"ready",pickerMode:"bb",pickerMarkup:pickerHTML(),colorKey:color.key,colorName:color.name,colorEmoji:color.emoji,category:cat,seconds:Number($("duration")?.value)||20});if($("playBtn"))$("playBtn").disabled=false;if($("showAnswerBtn"))$("showAnswerBtn").disabled=false;$("hostScorePanel")?.classList.remove("hidden");if($("hostStatus"))$("hostStatus").textContent="Kleur bekend. Klik nu op Speel verborgen nummer."},3000)}
async function playHidden(){try{if(!currentTrack)return alert("Geen nummer gekozen. Druk eerst op START RONDE.");if($("playBtn")){$("playBtn").disabled=true;$("playBtn").textContent="🎵 Nummer speelt..."}if(!deviceId){await activatePlayer();await new Promise(r=>setTimeout(r,1200))}if(!deviceId){alert("Geen Spotify-speler actief. Klik eerst op Activeer Spotify-speler.");if($("playBtn")){$("playBtn").disabled=false;$("playBtn").textContent="🎵 Speel verborgen nummer"}return}let dur=(Number($("duration")?.value)||20)*1000,pos=0;if($("randomStart")?.checked&&currentTrack.duration_ms>dur+40000){let max=Math.max(0,currentTrack.duration_ms-dur-5000);pos=Math.floor(20000+Math.random()*Math.max(1,max-20000))}await api(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{method:"PUT",body:JSON.stringify({uris:[currentTrack.uri],position_ms:pos})});let deadline=Date.now()+dur;await db.ref("rooms/"+currentRoomCode+"/currentRound").update({status:"answering",deadlineMs:deadline,musicStartedAt:firebase.database.ServerValue.TIMESTAMP});if($("stopBtn"))$("stopBtn").disabled=false;clearTimeout(lockTimer);lockTimer=setTimeout(lockRound,dur);clearTimeout(stopTimer);stopTimer=setTimeout(stopPlayback,dur);if($("hostStatus"))$("hostStatus").textContent="Muziek speelt. Spelers kunnen nu antwoorden."}catch(e){alert("Afspelen mislukt: "+e.message);if($("playBtn")){$("playBtn").disabled=false;$("playBtn").textContent="🎵 Speel verborgen nummer"}}}
async function stopPlayback(){try{await api("https://api.spotify.com/v1/me/player/pause",{method:"PUT",body:"{}"})}catch(e){}if($("stopBtn"))$("stopBtn").disabled=true}function answerObject(){return currentTrack?{track:currentTrack.name||"",artist:currentTrack.artists||"",album:currentTrack.album||"",year:(currentTrack.release_date||"").slice(0,4)||""}:null}function showHostAnswer(a){if(!$("hostAnswerArea")||!a)return;$("hostAnswerArea").innerHTML=`<div class="correctBox"><h3>${esc(a.track||"-")}</h3><p>${esc(a.artist||"-")}</p><p>${esc(a.album||"-")} — ${esc(a.year||"-")}</p></div>`}function publishAnswer(){let a=answerObject();if(!currentRoomCode||!a)return Promise.resolve();showHostAnswer(a);return db.ref("rooms/"+currentRoomCode+"/currentRound").update({correctAnswer:a,correctAnswerShown:true})}function lockRound(){if(!currentRoomCode)return;publishAnswer().then(()=>db.ref("rooms/"+currentRoomCode+"/currentRound").update({status:"locked"})).then(()=>{if($("hostStatus"))$("hostStatus").textContent="Tijd voorbij. Antwoord automatisch zichtbaar bij spelers."}).catch(e=>alert("Timer/antwoord fout: "+e.message))}function showAnswer(){publishAnswer().catch(e=>alert("Antwoord tonen mislukt: "+e.message))}
function renderHostScore(room){let r=room.currentRound||{};if(!r.id||!$("hostScoreboard"))return;$("hostScorePanel")?.classList.remove("hidden");if($("hostRoundInfo"))$("hostRoundInfo").textContent=`${r.colorEmoji||""} ${r.colorName||""} — ${r.category||""} — ${r.status||""}`;let ps=room.players||{},ans=room.answers?.[r.id]||{},cor=room.correct?.[r.id]||{};$("hostScoreboard").innerHTML=Object.entries(ps).map(([pid,p])=>{let st=cor[pid],cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending";return`<div class="scoreCard ${cls}"><div>${esc(p.name||"Speler")}</div><div>${esc(ans[pid]?.answer||"Geen antwoord")}</div><div><button type="button" class="goodBtn ${st===true?"goodSelected":""}" data-pid="${pid}" data-good="true">✅</button><button type="button" class="badBtn ${st===false?"badSelected":""}" data-pid="${pid}" data-good="false">❌</button></div></div>`}).join("")}
function scoreboardClick(e){let btn=e.target.closest("button[data-pid]");if(!btn)return;e.preventDefault();let pid=btn.dataset.pid,good=btn.dataset.good==="true";db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{let r=s.val()||{};if(!r.id)throw Error("Geen actieve ronde.");return db.ref("rooms/"+currentRoomCode+"/correct/"+r.id+"/"+pid).set(good)}).then(()=>{if($("hostStatus"))$("hostStatus").textContent="🐵 Beoordeling opgeslagen."}).catch(e=>alert(e.message))}
function publishResults(){db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{},r=room.currentRound||{},up={};up[`rooms/${currentRoomCode}/currentRound/status`]="judged";Object.entries(room.players||{}).forEach(([pid,p])=>{let good=room.correct?.[r.id]?.[pid]===true;if(!good)up[`rooms/${currentRoomCode}/players/${pid}/ready`]=true});return db.ref().update(up)}).then(()=>{if($("hostStatus"))$("hostStatus").textContent="Resultaten verzonden."})}
function openNewGameModal(){if(!currentRoomCode)return alert("Maak eerst een kamer.");let m=$("newGameModal");if(m){m.classList.remove("hidden");m.style.display="flex"}}function closeNewGameModal(){let m=$("newGameModal");if(m){m.classList.add("hidden");m.style.display="none"}}function bbStartNewGameSameRoom(){if(!currentRoomCode){closeNewGameModal();return}db.ref("rooms/"+currentRoomCode).once("value").then(s=>{let room=s.val()||{},up={};Object.keys(room.players||{}).forEach(pid=>{up[`rooms/${currentRoomCode}/players/${pid}/card`]=genCard();up[`rooms/${currentRoomCode}/players/${pid}/marked`]={};up[`rooms/${currentRoomCode}/players/${pid}/bingo`]=false;up[`rooms/${currentRoomCode}/players/${pid}/ready`]=false;up[`rooms/${currentRoomCode}/players/${pid}/lastPickedRound`]=null});up[`rooms/${currentRoomCode}/currentRound`]=null;up[`rooms/${currentRoomCode}/answers`]=null;up[`rooms/${currentRoomCode}/correct`]=null;up[`rooms/${currentRoomCode}/bingos`]=null;return db.ref().update(up)}).then(()=>{closeNewGameModal();$("hostBingoPanel")?.classList.add("hidden");if($("hostStatus"))$("hostStatus").textContent="Nieuw spel gestart in dezelfde kamer."})}
function showStartPopup(){let o=$("hbHostStartOverlay");if(!o)return;let s=localStorage.hb_host_room||localStorage.hb_last_stable_room||"";if(s){$("hbLastRoomLine")?.classList.remove("hidden");if($("hbLastRoomCode"))$("hbLastRoomCode").textContent=s;if($("hbResumeRoomBtn")){$("hbResumeRoomBtn").disabled=false;$("hbResumeRoomBtn").textContent="🔄 Hervat "+s}renderRoomBox(s)}else{$("hbLastRoomLine")?.classList.add("hidden");if($("hbResumeRoomBtn")){$("hbResumeRoomBtn").disabled=true;$("hbResumeRoomBtn").textContent="🔄 Hervat kamer"}}o.classList.remove("hidden");$("hbResumeRoomBtn")?.addEventListener("click",()=>{let r=localStorage.hb_host_room||localStorage.hb_last_stable_room||"";if(r){currentRoomCode=r;renderRoomBox(r);listenHost(r);listenBingo(r)}o.classList.add("hidden")},{once:true});$("hbNewRoomModalBtn")?.addEventListener("click",()=>{localStorage.removeItem("hb_host_room");localStorage.removeItem("hb_last_stable_room");currentRoomCode="";o.classList.add("hidden");createRoom()},{once:true});$("hbCloseModalBtn")?.addEventListener("click",()=>o.classList.add("hidden"),{once:true})}
function setupPlayerMode(){document.body.classList.add("playerMode");setModeLabel("🎮 Speler");$("hostApp")?.classList.add("hidden");$("playerApp")?.classList.remove("hidden");currentRoomCode=(new URLSearchParams(location.search).get("room")||"").toUpperCase();if($("playerRoomCode"))$("playerRoomCode").textContent=currentRoomCode;if(currentPlayerName&&$("playerNameInput"))$("playerNameInput").value=currentPlayerName;if(currentPlayerId&&currentPlayerName){listenPlayer();showDashboard()}}
function genCard(){let colors=["yellow","pink","purple","blue","green"],pool=[];for(let i=0;i<24;i++)pool.push(colors[i%5]);for(let i=pool.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}let card=[],k=0;for(let i=0;i<25;i++)card.push(i===12?"free":pool[k++]);return card}
function joinPlayer(){let name=($("playerNameInput")?.value||"").trim();if(!name)return alert("Vul je naam in.");currentPlayerName=name;if(!currentPlayerId)currentPlayerId="p_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);localStorage.hb_player_id=currentPlayerId;localStorage.hb_player_name=currentPlayerName;localStorage.hb_player_room=currentRoomCode;let ref=db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId);ref.once("value").then(s=>{let ex=s.val()||{};return ref.update({name,online:true,ready:true,joinedAt:ex.joinedAt||firebase.database.ServerValue.TIMESTAMP,lastSeen:firebase.database.ServerValue.TIMESTAMP,card:ex.card||genCard(),marked:ex.marked||{},bingo:!!ex.bingo})}).then(()=>{ref.child("online").onDisconnect().set(false);listenPlayer();showDashboard()})}
function showDashboard(){$("screenJoin")?.classList.add("hidden");$("screenDashboard")?.classList.remove("hidden")}function listenPlayer(){db.ref("rooms/"+currentRoomCode).off();db.ref("rooms/"+currentRoomCode).on("value",s=>{let room=s.val()||{},r=room.currentRound||{};activeRound=r;showDashboard();renderCompactDashboard(room,r)});listenBingo(currentRoomCode)}
function colorHex(k){return{yellow:"#FFCC33",pink:"#00D4C7",purple:"#FF8A1F",blue:"#7ED957",green:"#FF5A5F",free:"#FFCC33"}[k]||"rgba(255,255,255,.18)"}function colorEmoji(k){return{yellow:"🟡",pink:"🩵",purple:"🟠",blue:"🟢",green:"🔴",free:"🐵"}[k]||""}
function renderCompactDashboard(room,r){renderCompactTop(room,r);renderCompactAnswer(room,r);renderCompactScore(room,r);renderCompactCard(room,r);renderCompactPicker(room,r)}
function renderCompactTop(room,r){if($("dashRoundNo"))$("dashRoundNo").textContent=currentPlayerName||"Speler";if($("dashPlayerCount"))$("dashPlayerCount").textContent=Object.keys(room.players||{}).length;clearInterval(dashTimer);dashTimer=setInterval(()=>{let el=$("dashTimer");if(!el)return;if(r?.status==="answering"&&r.deadlineMs){let left=Math.max(0,Math.ceil((r.deadlineMs-Date.now())/1000));el.textContent="00:"+String(left).padStart(2,"0");if(left<=0)clearInterval(dashTimer)}else if(r?.status==="locked"||r?.status==="judged")el.textContent="00:00";else el.textContent="--"},300)}
function renderCompactAnswer(room,r){let b=$("dashAnswerBlock");if(!b)return;if(!r?.id){b.innerHTML=`<h3>🎮 Wachten</h3><p class="small">Wachten op de host...</p>`;return}let own=room.answers?.[r.id]?.[currentPlayerId],ans=r.correctAnswer;if((r.status==="locked"||r.status==="judged")&&ans){b.innerHTML=`<h3>🐵 Juiste antwoord</h3><p>🎵 <strong>${esc(ans.track||"-")}</strong></p><p>🎤 ${esc(ans.artist||"-")}</p><p>📅 ${esc(ans.year||"-")}</p>`;return}if(r.status==="answering"){if(own){b.innerHTML=`<h3>🔒 Antwoord ingeleverd</h3><p>${esc(own.answer||"Leeg antwoord")}</p><p class="small">Wachten tot de tijd voorbij is...</p>`;return}b.innerHTML=`<h3>✍️ Vul je antwoord in</h3><p class="small">${esc(r.colorEmoji||"")} ${esc(r.colorName||"")} — ${esc(r.category||"")}</p><div class="compactInputRow"><input id="scoreAnswerInput" placeholder="Typ je antwoord"><button id="scoreSubmitAnswerBtn">Verstuur</button></div>`;$("scoreSubmitAnswerBtn")?.addEventListener("click",()=>submitAnswerValue($("scoreAnswerInput")?.value||""));return}if(r.status==="picking"){b.innerHTML=`<h3>🐵 Kleurkiezer</h3><p class="small">De BB-aap kiest een kleur...</p>`;return}if(r.status==="ready"){b.innerHTML=`<h3>🎵 Klaar voor muziek</h3><p class="small">${esc(r.colorEmoji||"")} ${esc(r.colorName||"")} — ${esc(r.category||"")}</p>`;return}b.innerHTML=`<h3>🎮 Wachten</h3><p class="small">Wachten op beoordeling...</p>`}
function submitAnswerValue(v){if(!activeRound?.id)return;db.ref("rooms/"+currentRoomCode+"/answers/"+activeRound.id+"/"+currentPlayerId).set({answer:v||"",submittedAt:firebase.database.ServerValue.TIMESTAMP})}
function renderCompactScore(room,r){let el=$("dashScoreboard");if(!el)return;let ps=room.players||{},ans=r?.id?room.answers?.[r.id]||{}:{},cor=r?.id?room.correct?.[r.id]||{}:{};el.innerHTML=Object.entries(ps).map(([pid,p])=>{let has=ans[pid]&&typeof ans[pid].answer!=="undefined",a=has?(String(ans[pid].answer).trim()||"Leeg antwoord"):"Nog niet ingevuld",st=r?.status==="judged"?cor[pid]:undefined,cls=st===true?"scoreGood":st===false?"scoreBad":"scorePending",ic=st===true?"🐵":st===false?"❌":has?"📝":"⏳";return`<div class="scoreCard ${cls}"><div class="scoreName">${esc(p.name||"Speler")}${pid===currentPlayerId?" (jij)":""}</div><div>${esc(a)}</div><div>${ic}</div></div>`}).join("")||"Nog geen spelers."}
function renderCompactCard(room,r){let me=room.players?.[currentPlayerId]||{},card=me.card||[],marked=me.marked||{},box=$("dashOwnCard");if(!box)return;let goodValue=r?.id&&room.correct?.[r.id]?room.correct[r.id][currentPlayerId]:undefined,good=goodValue===true,bad=goodValue===false,picked=r?.id&&me.lastPickedRound===r.id,canPick=r?.status==="judged"&&good&&!picked;if(r?.status==="judged")maybeShowFeedback(room,r,goodValue,picked);if($("dashCardHint"))$("dashCardHint").textContent=canPick?`Kies een ${r.colorEmoji||""} ${r.colorName||""} vakje`:picked?"🐵 Vakje gekozen":bad?"Helaas, geen vakje deze ronde":"Jouw bingokaart";if($("dashCardStatus"))$("dashCardStatus").textContent=canPick?"Tik op een geldig kleurvakje":me.ready?"🐵 READY voor volgende ronde":"Wachten op ronde";box.innerHTML=card.map((c,i)=>{let isMarked=!!marked[i]||i===12,pickable=canPick&&c===r.colorKey&&c!=="free"&&!marked[i];return`<div class="compactCell ${c==="free"?"free":""} ${isMarked?"marked":""} ${pickable?"pickable":""}" data-i="${i}" style="background:${colorHex(c)}">${isMarked?"🐵":""}</div>`}).join("");box.querySelectorAll(".pickable").forEach(cell=>cell.addEventListener("click",()=>pickCell(Number(cell.dataset.i))))}
function renderCompactPicker(room,r){let area=$("dashPickerArea");if(!area)return;if(!r?.id){area.innerHTML=`<div class="dashCatText">Wachten op host</div>`;return}if(r.status==="picking"){area.innerHTML=pickerHTML();return}area.innerHTML=`<div class="dashColorBig">${esc(r.colorEmoji||"🎮")}</div><div class="dashColorText">${esc(r.colorName||"KLEUR")}</div><div class="dashCatText">${esc(r.category||"Wachten...")}</div>`}
function overlay(){let o=$("bbFeedbackOverlay");if(!o){o=document.createElement("div");o.id="bbFeedbackOverlay";o.className="bbFeedbackOverlay";document.body.appendChild(o)}return o}function closeOverlay(){$("bbFeedbackOverlay")?.classList.remove("show")}function maybeShowFeedback(room,r,good,picked){if(!r?.id||r.status!=="judged")return;if(good===true&&!picked){let k=`${r.id}_good_${currentPlayerId}`;if(feedbackSeen[k])return;feedbackSeen[k]=true;setTimeout(()=>showGoodOverlay(room,r),80)}if(good===false){let k=`${r.id}_bad_${currentPlayerId}`;if(feedbackSeen[k])return;feedbackSeen[k]=true;setTimeout(()=>showBadOverlay(room,r),80)}}
function showGoodOverlay(room,r){let me=room.players?.[currentPlayerId]||{},card=me.card||[],marked=me.marked||{},cells=card.map((c,i)=>{let isMarked=!!marked[i]||i===12,pickable=c===r.colorKey&&c!=="free"&&!marked[i];return`<button type="button" class="bbOverlayCell ${isMarked?"marked":""} ${pickable?"pickable":"blocked"}" data-i="${i}" style="background:${colorHex(c)}" ${pickable?"":"disabled"}>${isMarked?"🐵":colorEmoji(c)}</button>`}).join(""),o=overlay();o.innerHTML=`<div class="bbOverlayCard good"><div class="bbMonkeyFace">🐵😎</div><img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="BB-aap"><div class="bbOverlayTitle">😎 GOED ANTWOORD!</div><div class="bbOverlayText">Kies één ${r.colorEmoji||""} ${r.colorName||""} vakje</div><div class="bbOverlayBingo">${cells}</div><div class="bbOverlayHint">Tik op een opgelicht vakje</div></div>`;o.classList.add("show");o.querySelectorAll(".bbOverlayCell.pickable").forEach(btn=>btn.addEventListener("click",()=>{let i=Number(btn.dataset.i);btn.textContent="🐵";btn.classList.add("chosen");pickCell(i);setTimeout(closeOverlay,650)}))}
function showBadOverlay(room,r){let ans=r.correctAnswer||{},answer=ans.track?`🎵 ${esc(ans.track||"-")}<br>🎤 ${esc(ans.artist||"-")}`:"Volgende ronde beter!",o=overlay();o.innerHTML=`<div class="bbOverlayCard bad"><div class="bbMonkeyFace">🐵🙈</div><img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="BB-aap"><div class="bbOverlayTitle">🙈 HELAAS!</div><div class="bbOverlayText">Deze was lastig...</div><div class="bbOverlayAnswer">${answer}</div><button type="button" class="bbOverlayContinue">Verder</button></div>`;o.classList.add("show");o.querySelector(".bbOverlayContinue")?.addEventListener("click",closeOverlay);db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId+"/ready").set(true);setTimeout(closeOverlay,4500)}
function checkBingo(marked){let lines=[[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];return lines.some(line=>line.every(i=>i===12||marked?.[i]))}
function pickCell(i){db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).once("value").then(s=>{let p=s.val()||{},marked=p.marked||{},card=p.card||[];if(!activeRound?.id)return;if(card[i]!==activeRound.colorKey||marked[i])return;marked[i]=true;let bingo=checkBingo(marked);return db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId).update({marked,bingo,lastPickedRound:activeRound.id,ready:true}).then(()=>{if(bingo)return db.ref("rooms/"+currentRoomCode+"/bingos").push({name:currentPlayerName,roundId:activeRound.id,at:firebase.database.ServerValue.TIMESTAMP})})})}
function activateSound(){try{let C=window.AudioContext||window.webkitAudioContext;if(C&&!audioCtx)audioCtx=new C();if(audioCtx?.state==="suspended")audioCtx.resume();if($("soundStatus"))$("soundStatus").textContent="🐵 actief."}catch(e){}}function flash(){let f=document.createElement("div");f.className="flash";document.body.appendChild(f);setTimeout(()=>f.remove(),700)}function tune(){try{let C=window.AudioContext||window.webkitAudioContext;if(!audioCtx&&C)audioCtx=new C();if(!audioCtx)return;[523,659,784,1046].forEach((freq,i)=>{let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.connect(g);g.connect(audioCtx.destination);let t=audioCtx.currentTime+i*.18;g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.3,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+.16);o.start(t);o.stop(t+.18)})}catch(e){}}function confetti(){let cs=["#FFCC33","#00D4C7","#FF8A1F","#7ED957","#FF5A5F","#fff"];for(let i=0;i<90;i++){let p=document.createElement("div");p.className="confetti";p.style.left=Math.random()*100+"vw";p.style.background=pick(cs);document.body.appendChild(p);setTimeout(()=>p.remove(),3500)}}function showWinner(name){if($("winnerPanel")){$("winnerPanel").classList.remove("hidden");$("winnerMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}if($("hostBingoPanel")){$("hostBingoPanel").classList.remove("hidden");$("hostBingoMessage").innerHTML="🏆 BINGO!<br>Speler "+esc(name)+" heeft gewonnen!"}if($("bingoFullOverlay")){$("bingoFullOverlay").classList.remove("hidden");if($("bingoFullName"))$("bingoFullName").textContent=name||"Speler";setTimeout(()=>$("bingoFullOverlay")?.classList.add("hidden"),5500)}confetti();tune()}
function listenBingo(room){if(!room)return;db.ref("rooms/"+room+"/bingos").off();db.ref("rooms/"+room+"/bingos").on("child_added",s=>{let b=s.val()||{},key=s.key+"_"+(b.roundId||"");if(key===bingoSeenKey)return;bingoSeenKey=key;localStorage.hb_last_bingo_key=key;showWinner(b.name||"onbekend")})}



/* =========================
   V84 - SPELER MOET EERST NAAM INVULLEN
   ========================= */
(function(){
  function q(id){ return document.getElementById(id); }
  function getRoom(){ return (new URLSearchParams(location.search).get("room") || "").toUpperCase(); }

  function forceNameFirstV84(){
    const room = getRoom();
    if(!room) return;

    document.body.classList.add("playerMode");
    q("hostApp")?.classList.add("hidden");
    q("playerApp")?.classList.remove("hidden");

    const mode = q("modeText");
    if(mode) mode.textContent = "🎮 Speler";

    const roomLabel = q("playerRoomCode");
    if(roomLabel) roomLabel.textContent = room;

    const savedRoom = localStorage.hb_player_room || "";
    const savedName = localStorage.hb_player_name || "";
    const savedId = localStorage.hb_player_id || "";
    const mayResume = savedRoom === room && savedName && savedId;

    if(!mayResume){
      localStorage.removeItem("hb_player_room");
      localStorage.removeItem("hb_player_name");
      localStorage.removeItem("hb_player_id");

      if(typeof currentPlayerId !== "undefined") currentPlayerId = "";
      if(typeof currentPlayerName !== "undefined") currentPlayerName = "";
      if(typeof currentRoomCode !== "undefined") currentRoomCode = room;

      q("screenJoin")?.classList.remove("hidden");
      q("screenDashboard")?.classList.add("hidden");

      const input = q("playerNameInput");
      if(input){
        input.value = "";
        setTimeout(() => input.focus(), 300);
      }
    }
  }

  if(typeof setupPlayerMode === "function" && !window.__setupPlayerModeV84Wrapped){
    window.__setupPlayerModeV84Wrapped = true;
    const oldSetupPlayerMode = setupPlayerMode;
    setupPlayerMode = function(){
      const room = getRoom();
      if(typeof currentRoomCode !== "undefined") currentRoomCode = room;

      const savedRoom = localStorage.hb_player_room || "";
      const savedName = localStorage.hb_player_name || "";
      const savedId = localStorage.hb_player_id || "";

      if(savedRoom === room && savedName && savedId){
        return oldSetupPlayerMode.apply(this, arguments);
      }
      forceNameFirstV84();
    };
  }

  if(typeof joinPlayer === "function" && !window.__joinPlayerV84Wrapped){
    window.__joinPlayerV84Wrapped = true;
    const oldJoinPlayer = joinPlayer;
    joinPlayer = function(){
      const room = getRoom();
      if(room) localStorage.hb_player_room = room;
      return oldJoinPlayer.apply(this, arguments);
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(forceNameFirstV84, 500));
})();



/* =========================
   V85 - BB AAP ALTIJD ZICHTBAAR IN OVERLAY
   ========================= */
(function(){
  const obs = new MutationObserver(() => {
    document.querySelectorAll(".bbOverlayCard").forEach(card => {
      if(!card.querySelector(".bbMonkeyFace")){
        const face = document.createElement("div");
        face.className = "bbMonkeyFace";
        face.textContent = card.classList.contains("bad") ? "🐵🙈" : "🐵😎";
        card.insertBefore(face, card.firstChild);
      }
      const img = card.querySelector(".bbOverlayLogo");
      if(img){
        img.src = "bb_mascot_dj.png";
        img.classList.add("bbMascotVisible");
      }
    });
  });
  document.addEventListener("DOMContentLoaded", () => {
    obs.observe(document.body, {childList:true, subtree:true});
  });
})();


/* =========================
   V89 - App polish fixes Georgio
   - startpopup alleen bij normaal openen, niet na Spotify login/redirect
   - host room compacter met grotere QR + glow
   - antwoord nooit tonen voor timer voorbij is
   - foutscherm zonder losse aap-emojis
   - goedscherm: vakjes volledig gekleurd, geen kleine kleur-emoji
   ========================= */
(function(){
  const q = (id) => document.getElementById(id);
  const hasSpotifyCallback = () => new URLSearchParams(location.search).has("code");
  const roomLink = (code) => location.origin + location.pathname + "?room=" + code;

  // Popup alleen bij openen van de host-app. Niet na terugkomst van Spotify OAuth.
  if (typeof setupHostMode === "function" && !window.__setupHostModeV89Wrapped) {
    window.__setupHostModeV89Wrapped = true;
    setupHostMode = function(){
      setModeLabel("🎤 Host");
      document.body.classList.remove("playerMode");
      q("hostApp")?.classList.remove("hidden");
      q("playerApp")?.classList.add("hidden");
      restoreHost();

      if (hasSpotifyCallback()) {
        sessionStorage.setItem("bb_start_popup_seen", "1");
        return;
      }
      if (sessionStorage.getItem("bb_start_popup_seen") !== "1") {
        sessionStorage.setItem("bb_start_popup_seen", "1");
        showStartPopup();
      }
    };
  }

  // Compacter hostscherm: grote QR, geen "Deel de link" blok, wel Kopieer link.
  if (typeof renderRoomBox === "function" && !window.__renderRoomBoxV89Wrapped) {
    window.__renderRoomBoxV89Wrapped = true;
    renderRoomBox = function(code){
      const box = q("roomBox");
      if(!code || !box) return;
      const link = roomLink(code);
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="hostRoomGridV89">
          <div class="hostRoomCodeV89">
            <div class="roomLabelV89">SPELCODE</div>
            <div class="roomCodeV89">${esc(code)}</div>
          </div>
          <div class="hostRoomQrWrapV89">
            <img class="hostQrV89" alt="QR code" src="${qrUrl(link)}">
          </div>
          <div class="hostRoomCopyV89">
            <input id="joinLink" class="joinLinkHiddenV89" readonly value="${esc(link)}" aria-label="Kamerlink">
            <button id="copyRoomLinkBtn" type="button" class="copyRoomLinkBtnV89">📋 Kopieer link</button>
          </div>
        </div>`;
    };
  }

  function updateShowAnswerButtonV89(room){
    const btn = q("showAnswerBtn");
    if(!btn) return;
    const r = room?.currentRound || activeRound || {};
    const timerPast = r.deadlineMs && Date.now() >= Number(r.deadlineMs);
    const mayShow = r.status === "locked" || r.status === "judged" || timerPast;
    btn.disabled = !mayShow;
    btn.title = mayShow ? "Antwoord tonen" : "Antwoord pas beschikbaar na de timer";
  }

  // Buttonstatus steeds goedzetten.
  if (typeof renderHostScore === "function" && !window.__renderHostScoreV89Wrapped) {
    window.__renderHostScoreV89Wrapped = true;
    const oldRenderHostScore = renderHostScore;
    renderHostScore = function(room){
      const res = oldRenderHostScore.apply(this, arguments);
      updateShowAnswerButtonV89(room || {});
      return res;
    };
  }

  // Antwoord mag nooit zichtbaar worden vóór timer voorbij is.
  if (typeof showAnswer === "function" && !window.__showAnswerV89Wrapped) {
    window.__showAnswerV89Wrapped = true;
    showAnswer = function(){
      if(!currentRoomCode) return;
      db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{
        const r = s.val() || {};
        const timerPast = r.deadlineMs && Date.now() >= Number(r.deadlineMs);
        if(!(r.status === "locked" || r.status === "judged" || timerPast)) {
          alert("Het antwoord is pas zichtbaar nadat de timer voorbij is.");
          return;
        }
        return publishAnswer();
      }).catch(e=>alert("Antwoord tonen mislukt: "+e.message));
    };
  }

  // Maak lockRound expliciet: pas na timer publishen, daarna status locked.
  if (typeof lockRound === "function" && !window.__lockRoundV89Wrapped) {
    window.__lockRoundV89Wrapped = true;
    lockRound = function(){
      if(!currentRoomCode) return;
      db.ref("rooms/"+currentRoomCode+"/currentRound").once("value").then(s=>{
        const r = s.val() || {};
        const timerPast = !r.deadlineMs || Date.now() >= Number(r.deadlineMs) - 250;
        if(!timerPast) return; // beveiliging: nooit te vroeg tonen
        return publishAnswer()
          .then(()=>db.ref("rooms/"+currentRoomCode+"/currentRound").update({status:"locked"}))
          .then(()=>{ if(q("hostStatus")) q("hostStatus").textContent="Tijd voorbij. Antwoord automatisch zichtbaar bij spelers."; });
      }).catch(e=>alert("Timer/antwoord fout: "+e.message));
    };
  }

  // Goed antwoord overlay: grote vakjes volledig in kleur, geen kleine kleur-emoji's.
  if (typeof showGoodOverlay === "function" && !window.__showGoodOverlayV89Wrapped) {
    window.__showGoodOverlayV89Wrapped = true;
    showGoodOverlay = function(room,r){
      const me = room.players?.[currentPlayerId] || {}, card = me.card || [], marked = me.marked || {};
      const cells = card.map((c,i)=>{
        const isMarked = !!marked[i] || i === 12;
        const pickable = c === r.colorKey && c !== "free" && !marked[i];
        const label = isMarked ? "✓" : "";
        return `<button type="button" class="bbOverlayCell ${isMarked?"marked":""} ${pickable?"pickable":"blocked"}" data-i="${i}" style="background:${colorHex(c)}" ${pickable?"":"disabled"}>${label}</button>`;
      }).join("");
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard good">
        <div class="bbMonkeyFace">🐵😎</div>
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="BB-aap">
        <div class="bbOverlayTitle">😎 GOED ANTWOORD!</div>
        <div class="bbOverlayText">Kies één ${r.colorEmoji||""} ${r.colorName||""} vakje</div>
        <div class="bbOverlayBingo">${cells}</div>
        <div class="bbOverlayHint">Tik op een opgelicht vakje</div>
      </div>`;
      o.classList.add("show");
      o.querySelectorAll(".bbOverlayCell.pickable").forEach(btn=>btn.addEventListener("click",()=>{
        const i = Number(btn.dataset.i);
        btn.textContent = "✓";
        btn.classList.add("chosen");
        pickCell(i);
        setTimeout(closeOverlay,650);
      }));
    };
  }

  // Fout antwoord overlay: geen losse aap-emojis, alleen het echte BB-logo/mascottebeeld.
  if (typeof showBadOverlay === "function" && !window.__showBadOverlayV89Wrapped) {
    window.__showBadOverlayV89Wrapped = true;
    showBadOverlay = function(room,r){
      const ans = r.correctAnswer || {};
      const answer = ans.track ? `🎵 ${esc(ans.track||"-")}<br>🎤 ${esc(ans.artist||"-")}` : "Volgende ronde beter!";
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard bad">
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="Bingo Beats">
        <div class="bbOverlayTitle">HELAAS!</div>
        <div class="bbOverlayText">Deze was lastig...</div>
        <div class="bbOverlayAnswer">${answer}</div>
        <button type="button" class="bbOverlayContinue">Verder</button>
      </div>`;
      o.classList.add("show");
      o.querySelector(".bbOverlayContinue")?.addEventListener("click",closeOverlay);
      db.ref("rooms/"+currentRoomCode+"/players/"+currentPlayerId+"/ready").set(true);
      setTimeout(closeOverlay,4500);
    };
  }
})();

/* =========================
   V90 - Fixes Georgio
   - Goed/fout overlays zonder losse emoji's
   - Goed antwoord kaart: echte grote kleuren per vakje
   - Antwoord nooit publiceren vóór timer voorbij is
   ========================= */
(function(){
  const q = (id)=>document.getElementById(id);
  const COLOR_HEX_V90 = {yellow:'#FFCC33', pink:'#00D4C7', purple:'#FF8A1F', blue:'#7ED957', green:'#FF5A5F', free:'#FFCC33'};
  const colorClassV90 = (c)=>['yellow','pink','purple','blue','green','free'].includes(c) ? 'cell-' + c : '';

  // Extra beveiliging: publishAnswer zelf mag nooit te vroeg tonen, ook niet via oude code.
  if (typeof publishAnswer === 'function' && !window.__publishAnswerV90Wrapped) {
    window.__publishAnswerV90Wrapped = true;
    const oldPublishAnswerV90 = publishAnswer;
    publishAnswer = function(){
      if(!currentRoomCode) return Promise.resolve();
      return db.ref('rooms/'+currentRoomCode+'/currentRound').once('value').then(s=>{
        const r = s.val() || {};
        const timerPast = r.deadlineMs && Date.now() >= Number(r.deadlineMs) - 250;
        const allowed = r.status === 'locked' || r.status === 'judged' || timerPast;
        if(!allowed){
          if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
          if(q('hostStatus')) q('hostStatus').textContent = 'Muziek speelt. Antwoord blijft verborgen tot de timer voorbij is.';
          return Promise.resolve();
        }
        return oldPublishAnswerV90.apply(this, arguments);
      });
    };
  }

  // Show-answer knop pas na timer bruikbaar.
  if (typeof startRoundVisual === 'function' && !window.__startRoundVisualV90Wrapped) {
    window.__startRoundVisualV90Wrapped = true;
    const oldStartRoundVisualV90 = startRoundVisual;
    startRoundVisual = function(){
      const res = oldStartRoundVisualV90.apply(this, arguments);
      setTimeout(()=>{
        if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;
        if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      }, 0);
      setTimeout(()=>{
        if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;
        if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      }, 3100);
      return res;
    };
  }

  if (typeof playHidden === 'function' && !window.__playHiddenV90Wrapped) {
    window.__playHiddenV90Wrapped = true;
    const oldPlayHiddenV90 = playHidden;
    playHidden = async function(){
      if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;
      if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      const res = await oldPlayHiddenV90.apply(this, arguments);
      const dur = (Number(q('duration')?.value)||20)*1000;
      setTimeout(()=>{ if(q('showAnswerBtn')) q('showAnswerBtn').disabled = false; }, dur + 350);
      return res;
    };
  }

  // Goed antwoord overlay: geen losse emoji's, alle vakjes zijn grote kleuren.
  if (typeof showGoodOverlay === 'function') {
    showGoodOverlay = function(room,r){
      const me = room.players?.[currentPlayerId] || {}, card = me.card || [], marked = me.marked || {};
      const cells = card.map((c,i)=>{
        const isMarked = !!marked[i] || i === 12;
        const pickable = c === r.colorKey && c !== 'free' && !marked[i];
        const cls = colorClassV90(c);
        return `<button type="button" class="bbOverlayCell ${cls} ${isMarked?'marked':''} ${pickable?'pickable':'blocked'}" data-i="${i}" style="--cellColor:${COLOR_HEX_V90[c]||'rgba(255,255,255,.18)'}" ${pickable?'':'disabled'}></button>`;
      }).join('');
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard good">
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="Bingo Beats">
        <div class="bbOverlayTitle">GOED ANTWOORD!</div>
        <div class="bbOverlayText">Kies één ${esc(r.colorName||'kleur')} vakje</div>
        <div class="bbOverlayBingo">${cells}</div>
        <div class="bbOverlayHint">Tik op een opgelicht vakje</div>
      </div>`;
      o.classList.add('show');
      o.querySelectorAll('.bbOverlayCell.pickable').forEach(btn=>btn.addEventListener('click',()=>{
        const i = Number(btn.dataset.i);
        btn.classList.add('chosen');
        pickCell(i);
        setTimeout(closeOverlay,650);
      }));
    };
  }

  // Fout antwoord overlay: ook geen muziek/microfoon emoji's in antwoordblok.
  if (typeof showBadOverlay === 'function') {
    showBadOverlay = function(room,r){
      const ans = r.correctAnswer || {};
      const answer = ans.track ? `${esc(ans.track||'-')}<br>${esc(ans.artist||'-')}` : 'Volgende ronde beter!';
      const o = overlay();
      o.innerHTML = `<div class="bbOverlayCard bad">
        <img src="bb_mascot_dj.png" class="bbOverlayLogo bbMascotVisible" alt="Bingo Beats">
        <div class="bbOverlayTitle">HELAAS!</div>
        <div class="bbOverlayText">Deze was lastig...</div>
        <div class="bbOverlayAnswer">${answer}</div>
        <button type="button" class="bbOverlayContinue">Verder</button>
      </div>`;
      o.classList.add('show');
      o.querySelector('.bbOverlayContinue')?.addEventListener('click',closeOverlay);
      db.ref('rooms/'+currentRoomCode+'/players/'+currentPlayerId+'/ready').set(true);
      setTimeout(closeOverlay,4500);
    };
  }
})();


/* =========================
   V91 - PORTRAIT ONLY + REALISTISCH KLEURENRAD + COMPACTE QR
   ========================= */
(function(){
  const q = (id)=>document.getElementById(id);
  const WHEEL_ORDER = ["yellow","pink","purple","blue","green"];
  const WHEEL_NAMES = {yellow:"GOUD",pink:"AQUA",purple:"ORANJE",blue:"LIME",green:"KORAAL"};
  const WHEEL_HEX = {yellow:"#FFCC33",pink:"#00D4C7",purple:"#FF8A1F",blue:"#7ED957",green:"#FF5A5F"};

  function wheelStopDeg(key){
    const idx = Math.max(0, WHEEL_ORDER.indexOf(key));
    return -idx * 72;
  }
  function colorByKey(key){
    return (typeof COLORS !== 'undefined' ? COLORS.find(c=>c.key===key) : null) || {key,name:WHEEL_NAMES[key]||"KLEUR",hex:WHEEL_HEX[key]||"#FFCC33",emoji:""};
  }
  function categoryForColor(color){
    try { return q(color.input)?.value || "Geen categorie"; } catch(e){ return "Geen categorie"; }
  }
  function wheelHTMLV91(selectedKey){
    const stop = wheelStopDeg(selectedKey || "yellow");
    return `<div class="bbWheelPickerV91">
      <div class="bbWheelTopV91">Kleur wordt gekozen...</div>
      <div class="bbWheelPointerV91"></div>
      <div class="bbWheelV91" style="--stop:${stop}deg">
        <div class="bbWheelCenterV91"><img src="bb_logo.png" alt="Bingo Beats"></div>
      </div>
      <div class="bbWheelLabelsV91">
        <span style="--c:#FFCC33">GOUD</span><span style="--c:#00D4C7">AQUA</span><span style="--c:#FF8A1F">ORANJE</span><span style="--c:#7ED957">LIME</span><span style="--c:#FF5A5F">KORAAL</span>
      </div>
      <div class="bbWheelHintV91">Het rad draait en stopt vanzelf...</div>
    </div>`;
  }
  function wheelResultHTMLV91(color, cat){
    return `<div class="bbWheelResultV91" style="--result:${color.hex||WHEEL_HEX[color.key]||'#FFCC33'}">
      <div class="bbResultDotV91"></div>
      <div class="bbResultColorV91">${esc(color.name||WHEEL_NAMES[color.key]||'KLEUR')}</div>
      <div class="bbResultCatV91">${esc(cat||'')}</div>
    </div>`;
  }

  // Compact host room: QR groter met glow, Deel-de-link-blok eruit, spelcode compacter.
  if (typeof renderRoomBox === 'function') {
    renderRoomBox = function(code){
      if(!code || !q('roomBox')) return;
      const link = location.origin + location.pathname + '?room=' + code;
      q('roomBox').classList.remove('hidden');
      q('roomBox').innerHTML = `<div class="hostRoomGridV91">
        <div class="hostRoomCodeV91"><div class="roomLabelV91">SPELCODE</div><div class="roomCodeV91">${esc(code)}</div></div>
        <div class="hostQrWrapV91"><img class="hostQrV91" alt="QR code" src="${qrUrl(link)}"></div>
        <div class="hostCopyV91"><input id="joinLink" readonly value="${esc(link)}"><button id="copyRoomLinkBtn" type="button" class="copyRoomLinkBtn">📋 Kopieer link</button></div>
      </div>`;
    };
  }

  // Realistisch kleurenrad op host en spelers, met echte stop op gekozen kleur.
  if (typeof pickerHTML === 'function') {
    pickerHTML = function(){ return wheelHTMLV91('yellow'); };
  }
  if (typeof startRoundVisual === 'function') {
    startRoundVisual = function(room){
      if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      if(q('playBtn')) { q('playBtn').disabled = true; q('playBtn').textContent = '🎵 Speel verborgen nummer'; }
      if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;

      const color = pick(COLORS);
      const cat = categoryForColor(color);
      currentRoundId = 'r_' + Date.now();
      if(q('hostPickerArea')) q('hostPickerArea').innerHTML = wheelHTMLV91(color.key);

      db.ref('rooms/'+room+'/currentRound').set({
        id: currentRoundId,
        status: 'picking',
        pickerMode: 'wheelV91',
        pendingColorKey: color.key,
        pendingColorName: color.name,
        pendingCategory: cat,
        pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
        seconds: Number(q('duration')?.value)||20
      });

      setTimeout(()=>{
        flash();
        if(q('hostPickerArea')) q('hostPickerArea').innerHTML = wheelResultHTMLV91(color, cat);
        db.ref('rooms/'+room+'/currentRound').set({
          id: currentRoundId,
          status: 'ready',
          pickerMode: 'wheelV91',
          colorKey: color.key,
          colorName: color.name,
          colorEmoji: color.emoji,
          category: cat,
          seconds: Number(q('duration')?.value)||20
        });
        if(q('playBtn')) q('playBtn').disabled = false;
        if(q('showAnswerBtn')) q('showAnswerBtn').disabled = false;
        q('hostScorePanel')?.classList.remove('hidden');
        if(q('hostStatus')) q('hostStatus').textContent = 'Kleur bekend. Klik nu op Speel verborgen nummer.';
      }, 4300);
    };
  }
  if (typeof renderCompactPicker === 'function') {
    renderCompactPicker = function(room,r){
      const area=q('dashPickerArea');
      if(!area) return;
      if(!r?.id){ area.innerHTML='<div class="dashCatText">Wachten op host</div>'; return; }
      if(r.status==='picking'){
        area.innerHTML = wheelHTMLV91(r.pendingColorKey || 'yellow');
        return;
      }
      area.innerHTML = `<div class="dashColorBig">${esc(r.colorEmoji||'')}</div><div class="dashColorText">${esc(r.colorName||'KLEUR')}</div><div class="dashCatText">${esc(r.category||'Wachten...')}</div>`;
    };
  }

  // Portrait-only: in browser blokkeren we landscape; als PWA het ondersteunt proberen we portrait-lock.
  function installPortraitOnly(){
    let o=document.getElementById('bbPortraitOnlyOverlay');
    if(!o){
      o=document.createElement('div');
      o.id='bbPortraitOnlyOverlay';
      o.innerHTML='<div class="bbPortraitCard"><img src="bb_logo.png" alt="Bingo Beats"><h2>Draai je telefoon rechtop</h2><p>Bingo Beats werkt het beste staand.</p></div>';
      document.body.appendChild(o);
    }
    const update=()=>{
      const landscape = window.innerWidth > window.innerHeight;
      document.body.classList.toggle('bbLandscapeBlocked', landscape);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', ()=>setTimeout(update,250));
    const tryLock=()=>{ try{ screen.orientation?.lock?.('portrait').catch(()=>{}); }catch(e){} };
    document.addEventListener('click', tryLock, {once:false, passive:true});
    document.addEventListener('touchstart', tryLock, {once:false, passive:true});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPortraitOnly);
  else installPortraitOnly();
})();

/* =========================
   V92 - FULLSCREEN KLEURENRAD HOST + SPELER
   ========================= */
(function(){
  const q = (id)=>document.getElementById(id);
  const ORDER = ['yellow','pink','purple','blue','green'];
  const NAME = {yellow:'GOUD',pink:'AQUA',purple:'ORANJE',blue:'LIME',green:'KORAAL'};
  const HEX = {yellow:'#FFCC33',pink:'#00D4C7',purple:'#FF8A1F',blue:'#7ED957',green:'#FF5A5F'};

  function stopDeg(key){
    // Segmenten zijn 72 graden. Pijl staat boven. We draaien naar exact midden van het gekozen segment.
    const idx = Math.max(0, ORDER.indexOf(key || 'yellow'));
    return (-idx * 72);
  }
  function colorByKey(key){
    return (typeof COLORS !== 'undefined' ? COLORS.find(c=>c.key===key) : null) || {key:key||'yellow', name:NAME[key]||'GOUD', hex:HEX[key]||'#FFCC33'};
  }
  function getOverlay(){
    let o = q('bbWheelFullOverlayV92');
    if(!o){
      o = document.createElement('div');
      o.id = 'bbWheelFullOverlayV92';
      o.className = 'bbWheelFullOverlayV92 hidden';
      document.body.appendChild(o);
    }
    return o;
  }
  function wheelFullHTML(key){
    const c = colorByKey(key);
    const deg = stopDeg(c.key);
    return `<div class="bbWheelFullCardV92">
      <img src="bb_logo.png" class="bbWheelFullLogoV92" alt="Bingo Beats">
      <div class="bbWheelFullTitleV92">KIES EEN CATEGORIE</div>
      <div class="bbWheelFullSubV92">Het rad draait...</div>
      <div class="bbWheelFullPointerV92"></div>
      <div class="bbWheelFullDiscV92" style="--stop:${deg}deg">
        <div class="bbWheelFullCenterV92">BB</div>
        <span class="seg seg1">GOUD</span>
        <span class="seg seg2">AQUA</span>
        <span class="seg seg3">ORANJE</span>
        <span class="seg seg4">LIME</span>
        <span class="seg seg5">KORAAL</span>
      </div>
      <div class="bbWheelFullWaitV92">Even geduld… het rad stopt vanzelf</div>
    </div>`;
  }
  function resultFullHTML(color, cat){
    return `<div class="bbWheelFullCardV92 result" style="--result:${color.hex||HEX[color.key]||'#FFCC33'}">
      <img src="bb_logo.png" class="bbWheelFullLogoV92" alt="Bingo Beats">
      <div class="bbWheelFullSubV92">De categorie is</div>
      <div class="bbWheelFullResultDotV92"></div>
      <div class="bbWheelFullResultNameV92">${esc(color.name||NAME[color.key]||'KLEUR')}</div>
      <div class="bbWheelFullResultCatV92">${esc(cat||'')}</div>
    </div>`;
  }
  function showWheelFull(key){
    const o = getOverlay();
    o.innerHTML = wheelFullHTML(key || 'yellow');
    o.classList.remove('hidden');
    o.classList.add('show');
  }
  function showWheelResult(color, cat){
    const o = getOverlay();
    o.innerHTML = resultFullHTML(color, cat);
    o.classList.remove('hidden');
    o.classList.add('show');
  }
  function hideWheelFull(delay=0){
    setTimeout(()=>{
      const o = q('bbWheelFullOverlayV92');
      if(o){ o.classList.remove('show'); o.classList.add('hidden'); }
    }, delay);
  }

  // Host: toon groot rad zodra ronde start, resultaat kort zichtbaar, daarna pas naar ready.
  if(typeof startRoundVisual === 'function'){
    startRoundVisual = function(room){
      if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      if(q('playBtn')){ q('playBtn').disabled = true; q('playBtn').textContent = '🎵 Speel verborgen nummer'; }
      if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;

      const color = pick(COLORS);
      let cat = 'Geen categorie';
      try{ cat = q(color.input)?.value || 'Geen categorie'; }catch(e){}
      currentRoundId = 'r_' + Date.now();

      showWheelFull(color.key);
      if(q('hostPickerArea')) q('hostPickerArea').innerHTML = wheelHTMLV91 ? wheelHTMLV91(color.key) : '';

      db.ref('rooms/'+room+'/currentRound').set({
        id: currentRoundId,
        status: 'picking',
        pickerMode: 'wheelV92',
        pendingColorKey: color.key,
        pendingColorName: color.name,
        pendingCategory: cat,
        pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
        seconds: Number(q('duration')?.value)||20
      });

      setTimeout(()=>{
        flash();
        showWheelResult(color, cat);
        if(q('hostPickerArea')) q('hostPickerArea').innerHTML = wheelResultHTMLV91 ? wheelResultHTMLV91(color, cat) : `<div class="colorDisplay">${esc(color.name)}</div>`;
        db.ref('rooms/'+room+'/currentRound').set({
          id: currentRoundId,
          status: 'ready',
          pickerMode: 'wheelV92',
          colorKey: color.key,
          colorName: color.name,
          colorEmoji: color.emoji,
          category: cat,
          seconds: Number(q('duration')?.value)||20
        });
        hideWheelFull(1200);
        if(q('playBtn')) q('playBtn').disabled = false;
        if(q('showAnswerBtn')) q('showAnswerBtn').disabled = false;
        q('hostScorePanel')?.classList.remove('hidden');
        if(q('hostStatus')) q('hostStatus').textContent = 'Kleur bekend. Klik nu op Speel verborgen nummer.';
      }, 4300);
    };
  }

  // Host listener: als pagina later binnenkomt tijdens picking, ook fullscreen rad tonen.
  if(typeof listenHost === 'function' && !window.__listenHostV92Wrapped){
    window.__listenHostV92Wrapped = true;
    const oldListenHost = listenHost;
    listenHost = function(room){
      db.ref('rooms/'+room).off();
      db.ref('rooms/'+room).on('value',s=>{
        let d=s.val()||{}, r=d.currentRound||{};
        renderHostPlayers(d); renderHostScore(d); hostReadyState(d);
        if(r.status === 'picking') showWheelFull(r.pendingColorKey || 'yellow');
        else if(r.status !== 'picking') hideWheelFull(0);
      });
    };
  }

  // Speler: rad komt ook groot in beeld wanneer host kiest.
  if(typeof listenPlayer === 'function' && !window.__listenPlayerV92Wrapped){
    window.__listenPlayerV92Wrapped = true;
    listenPlayer = function(){
      db.ref('rooms/'+currentRoomCode).off();
      db.ref('rooms/'+currentRoomCode).on('value',s=>{
        let room=s.val()||{}, r=room.currentRound||{};
        activeRound=r;
        showDashboard();
        renderCompactDashboard(room,r);
        if(r.status === 'picking') showWheelFull(r.pendingColorKey || 'yellow');
        else hideWheelFull(0);
      });
      listenBingo(currentRoomCode);
    };
  }

  // Betere portrait blokkade: altijd bij liggend, ook op iPad/Safari.
  function updatePortraitBlockV92(){
    const isLandscape = window.matchMedia('(orientation: landscape)').matches || window.innerWidth > window.innerHeight;
    document.documentElement.classList.toggle('bbLandscapeBlocked', isLandscape);
    document.body.classList.toggle('bbLandscapeBlocked', isLandscape);
  }
  window.addEventListener('resize', updatePortraitBlockV92);
  window.addEventListener('orientationchange', ()=>setTimeout(updatePortraitBlockV92,150));
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updatePortraitBlockV92); else updatePortraitBlockV92();

  window.__bbWheelV92 = {showWheelFull, hideWheelFull};
})();

/* =========================
   V93 - SPELERSCHERM LIVE FLOW
   - Kleurenrad 5 sec + resultaat 0.5 sec, daarna direct muziek starten
   - Na eigen antwoord: live antwoorden van anderen zien
   - Antwoord-animatie alleen t/m 5 spelers
   - Lobby toont ready-status + eigen bingokaart
   ========================= */
(function(){
  const q = id => document.getElementById(id);
  const answerSeen = new Set();
  const ORDER = ['yellow','pink','purple','blue','green'];
  const HEX = {yellow:'#FFCC33',pink:'#00D4C7',purple:'#FF8A1F',blue:'#7ED957',green:'#FF5A5F',free:'#FFCC33'};
  const NAME = {yellow:'GOUD',pink:'AQUA',purple:'ORANJE',blue:'LIME',green:'KORAAL'};
  const E = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const colorByKey = key => (typeof COLORS !== 'undefined' ? COLORS.find(c=>c.key===key) : null) || {key:key||'yellow', name:NAME[key]||'GOUD', hex:HEX[key]||'#FFCC33'};
  const categoryFor = color => { try { return q(color.input)?.value || 'Geen categorie'; } catch(e) { return 'Geen categorie'; } };

  function secondsLeft(r){
    if(!r?.deadlineMs) return null;
    return Math.max(0, Math.ceil((Number(r.deadlineMs) - Date.now()) / 1000));
  }
  function playerCount(room){ return Object.keys(room.players || {}).length; }
  function currentAnswer(room,r,pid){ return r?.id ? room.answers?.[r.id]?.[pid] : null; }
  function isTimerPast(r){ return !!(r?.deadlineMs && Date.now() >= Number(r.deadlineMs)); }
  function safeInitial(name){ return String(name || '?').trim().slice(0,1).toUpperCase() || '?'; }

  // 5 seconden rad, 0.5 seconden resultaat, daarna automatisch Spotify starten.
  if(typeof startRoundVisual === 'function'){
    startRoundVisual = function(room){
      if(q('hostAnswerArea')) q('hostAnswerArea').innerHTML = '';
      if(q('playBtn')){ q('playBtn').disabled = true; q('playBtn').textContent = '🎵 Nummer start zo...'; }
      if(q('showAnswerBtn')) q('showAnswerBtn').disabled = true;

      const color = pick(COLORS);
      const cat = categoryFor(color);
      currentRoundId = 'r_' + Date.now();

      if(window.__bbWheelV92?.showWheelFull) window.__bbWheelV92.showWheelFull(color.key);
      if(q('hostPickerArea') && typeof wheelHTMLV91 === 'function') q('hostPickerArea').innerHTML = wheelHTMLV91(color.key);

      db.ref('rooms/'+room+'/currentRound').set({
        id: currentRoundId,
        status: 'picking',
        pickerMode: 'wheelV93',
        pendingColorKey: color.key,
        pendingColorName: color.name,
        pendingCategory: cat,
        pickerStartedAt: firebase.database.ServerValue.TIMESTAMP,
        seconds: Number(q('duration')?.value)||20
      });

      setTimeout(()=>{
        try{ flash(); }catch(e){}
        // Toon gekozen kleur kort.
        if(window.__bbWheelV92?.showWheelResult) window.__bbWheelV92.showWheelResult(color, cat);
        if(q('hostPickerArea') && typeof wheelResultHTMLV91 === 'function') q('hostPickerArea').innerHTML = wheelResultHTMLV91(color, cat);
        db.ref('rooms/'+room+'/currentRound').set({
          id: currentRoundId,
          status: 'ready',
          pickerMode: 'wheelV93',
          colorKey: color.key,
          colorName: color.name,
          colorEmoji: color.emoji,
          category: cat,
          seconds: Number(q('duration')?.value)||20
        }).then(()=>{
          if(q('hostScorePanel')) q('hostScorePanel').classList.remove('hidden');
          if(q('hostStatus')) q('hostStatus').textContent = 'Categorie gekozen. Nummer start direct...';
          setTimeout(()=>{
            if(window.__bbWheelV92?.hideWheelFull) window.__bbWheelV92.hideWheelFull(0);
            // Start direct het liedje zodra categorie klaar is.
            if(typeof playHidden === 'function') playHidden();
          }, 500);
        });
      }, 5000);
    };
  }

  // Speler dashboard: zet schermmodus per ronde voor betere verhoudingen.
  if(typeof renderCompactDashboard === 'function'){
    renderCompactDashboard = function(room,r){
      const own = currentAnswer(room,r,currentPlayerId);
      document.body.classList.toggle('bbLiveScoreMode', !!(r?.status === 'answering' && own));
      document.body.classList.toggle('bbAnswerMode', !!(r?.status === 'answering' && !own));
      document.body.classList.toggle('bbLobbyMode', !r?.id);
      document.body.classList.toggle('bbResultMode', !!(r?.status === 'locked' || r?.status === 'judged'));
      renderCompactTop(room,r);
      renderCompactAnswer(room,r);
      renderCompactScore(room,r);
      renderCompactCard(room,r);
      renderCompactPicker(room,r);
    };
  }

  // Timer bovenin blijft lopen en vraag/antwoordveld verschijnt direct bij muziek.
  if(typeof renderCompactAnswer === 'function'){
    renderCompactAnswer = function(room,r){
      const b = q('dashAnswerBlock');
      if(!b) return;
      if(!r?.id){
        b.innerHTML = `<div class="bbPlayerWait"><h3>Wachten op de host...</h3><p class="small">Je bingokaart staat alvast klaar.</p></div>`;
        return;
      }
      const own = currentAnswer(room,r,currentPlayerId);
      const ans = r.correctAnswer;
      const left = secondsLeft(r);

      if((r.status === 'locked' || r.status === 'judged' || isTimerPast(r)) && ans){
        b.innerHTML = `<div class="bbCorrectReveal">
          <div class="bbAnswerLabel">Juiste antwoord</div>
          <h3>${E(ans.track || '-')}</h3>
          <p>${E(ans.artist || '-')}</p>
          <p class="small">${E(ans.year || '')}</p>
        </div>`;
        return;
      }

      if(r.status === 'answering'){
        if(own){
          b.innerHTML = `<div class="bbOwnAnswerBox">
            <div class="bbAnswerLabel">Jouw antwoord</div>
            <h3>${E(String(own.answer || '').trim() || 'Leeg antwoord')}</h3>
            <p class="small">Wacht op de andere spelers...</p>
          </div>`;
          return;
        }
        const pct = left === null ? 100 : Math.max(0, Math.min(100, (left / Math.max(1, Number(r.seconds)||20)) * 100));
        b.innerHTML = `<div class="bbAnswerLiveBox">
          <div class="bbCountdownRing" style="--pct:${pct}"><span>${left ?? ''}</span></div>
          <h3>${E(questionForCategoryV93(r.category))}</h3>
          <input id="scoreAnswerInput" class="compactAnswerInput" autocomplete="off" placeholder="Typ je antwoord...">
          <button id="scoreSubmitAnswerBtn" class="compactSubmit">VERSTUREN</button>
        </div>`;
        q('scoreSubmitAnswerBtn')?.addEventListener('click',()=>submitAnswerValue(q('scoreAnswerInput')?.value||''));
        q('scoreAnswerInput')?.addEventListener('keydown',e=>{ if(e.key === 'Enter') submitAnswerValue(q('scoreAnswerInput')?.value||''); });
        setTimeout(()=>q('scoreAnswerInput')?.focus(),40);
        return;
      }

      if(r.status === 'picking'){
        b.innerHTML = `<div class="bbPlayerWait"><h3>Kleurenrad draait...</h3><p class="small">De categorie wordt gekozen.</p></div>`;
        return;
      }
      if(r.status === 'ready'){
        b.innerHTML = `<div class="bbPlayerWait"><h3>${E(r.colorName||'Kleur')} gekozen</h3><p class="small">${E(r.category||'')}<br>Het nummer start direct...</p></div>`;
        return;
      }
      b.innerHTML = `<div class="bbPlayerWait"><h3>Wachten...</h3><p class="small">De host controleert de ronde.</p></div>`;
    };
  }

  function questionForCategoryV93(cat){
    const c = String(cat || '').toLowerCase();
    if(c.includes('jaar') || c.includes('decennium') || c.includes('voor') || c.includes('na')) return 'Uit welk jaar of decennium komt deze track?';
    if(c.includes('artiest')) return 'Welke artiest hoor je?';
    if(c.includes('titel') || c.includes('track') || c.includes('lied')) return 'Hoe heet deze track?';
    return 'Hoe heet deze track?';
  }

  // Antwoord opslaan en direct vastzetten. Na versturen zie je live antwoorden van anderen.
  if(typeof submitAnswerValue === 'function'){
    submitAnswerValue = function(v){
      if(!activeRound?.id) return;
      const val = String(v || '').trim();
      if(!val) return alert('Vul eerst je antwoord in.');
      return db.ref('rooms/'+currentRoomCode+'/answers/'+activeRound.id+'/'+currentPlayerId).set({
        answer: val,
        submittedAt: firebase.database.ServerValue.TIMESTAMP
      });
    };
  }

  // Scorebord: voor eigen inzending alleen status. Na eigen antwoord: live ingestuurde antwoorden zien.
  if(typeof renderCompactScore === 'function'){
    renderCompactScore = function(room,r){
      const el = q('dashScoreboard');
      if(!el) return;
      const ps = room.players || {};
      const ids = Object.keys(ps);
      const ans = r?.id ? (room.answers?.[r.id] || {}) : {};
      const cor = r?.id ? (room.correct?.[r.id] || {}) : {};
      const ownSubmitted = !!(r?.id && ans[currentPlayerId]);
      const afterReveal = !!(r?.status === 'locked' || r?.status === 'judged' || (r?.correctAnswer && isTimerPast(r)));
      const animate = ids.length > 1 && ids.length <= 5;

      if(!r?.id){
        el.innerHTML = `<div class="bbReadyList">${ids.map(pid=>{
          const p = ps[pid] || {};
          return `<div class="compactScoreRow ${p.ready?'scoreGood':'scorePending'}"><div class="compactInitial">${E(safeInitial(p.name))}</div><div class="compactName">${E(p.name||'Speler')}${pid===currentPlayerId?' (jij)':''}</div><div class="compactAns">${p.ready?'Klaar':'Verbindt...'}</div><div class="compactIcon">${p.ready?'✓':'...'}</div></div>`;
        }).join('') || '<p class="small">Nog geen spelers.</p>'}</div>`;
        return;
      }

      el.innerHTML = ids.map(pid=>{
        const p = ps[pid] || {};
        const has = ans[pid] && typeof ans[pid].answer !== 'undefined';
        const key = `${r.id}:${pid}:${has ? ans[pid].answer : ''}`;
        const isNew = has && !answerSeen.has(key);
        if(has) answerSeen.add(key);
        let answerText;
        if(has && (ownSubmitted || afterReveal || pid === currentPlayerId)) answerText = String(ans[pid].answer || '').trim() || 'Leeg antwoord';
        else if(has) answerText = 'Ingezonden';
        else answerText = ownSubmitted ? 'Typt nog...' : 'Nog niet verzonden';
        const st = r.status === 'judged' ? cor[pid] : undefined;
        const cls = st === true ? 'scoreGood' : st === false ? 'scoreBad' : (has ? 'scoreSubmitted' : 'scorePending');
        const icon = st === true ? '✓' : st === false ? '×' : (has ? '✓' : '…');
        const animCls = (animate && isNew && ownSubmitted) ? ' bbScoreNewV93' : '';
        return `<div class="compactScoreRow ${cls}${animCls}"><div class="compactInitial">${E(safeInitial(p.name))}</div><div class="compactName">${E(p.name||'Speler')}${pid===currentPlayerId?' (jij)':''}</div><div class="compactAns">${E(answerText)}</div><div class="compactIcon">${icon}</div></div>`;
      }).join('') || '<p class="small">Nog geen spelers.</p>';
    };
  }

  // Lobby: bingokaart altijd zichtbaar, zonder emoji als vakje nog niet gekozen is.
  if(typeof renderCompactCard === 'function'){
    const oldRenderCardV93 = renderCompactCard;
    renderCompactCard = function(room,r){
      oldRenderCardV93(room,r);
      const box = q('dashOwnCard');
      if(box){
        box.querySelectorAll('.compactCell').forEach((cell, idx)=>{
          const me = room.players?.[currentPlayerId] || {};
          const card = me.card || [];
          const key = card[idx] || '';
          cell.dataset.colorKey = key;
          cell.classList.add('cell-' + key);
        });
      }
    };
  }

  // Player listener: fullscreen rad blijft 5 sec zichtbaar en verdwijnt bij antwoordfase.
  if(typeof listenPlayer === 'function'){
    listenPlayer = function(){
      db.ref('rooms/'+currentRoomCode).off();
      db.ref('rooms/'+currentRoomCode).on('value',s=>{
        const room = s.val() || {}, r = room.currentRound || {};
        activeRound = r;
        showDashboard();
        renderCompactDashboard(room,r);
        if(r.status === 'picking') window.__bbWheelV92?.showWheelFull?.(r.pendingColorKey || 'yellow');
        else window.__bbWheelV92?.hideWheelFull?.(0);
      });
      listenBingo(currentRoomCode);
    };
  }

  // Host scorebord mag live alle ingestuurde antwoorden zien, maar juiste antwoord pas na timer/lock.
  if(typeof renderHostScore === 'function'){
    renderHostScore = function(room){
      const r = room.currentRound || {};
      if(!r.id || !q('hostScoreboard')) return;
      q('hostScorePanel')?.classList.remove('hidden');
      if(q('hostRoundInfo')) q('hostRoundInfo').textContent = `${r.colorEmoji||''} ${r.colorName||''} — ${r.category||''} — ${r.status||''}`;
      const ps = room.players || {}, ans = room.answers?.[r.id] || {}, cor = room.correct?.[r.id] || {};
      q('hostScoreboard').innerHTML = Object.entries(ps).map(([pid,p])=>{
        const has = ans[pid] && typeof ans[pid].answer !== 'undefined';
        const st = cor[pid];
        const cls = st===true?'scoreGood':st===false?'scoreBad':has?'scoreSubmitted':'scorePending';
        return `<div class="scoreCard ${cls}"><div>${E(p.name||'Speler')}</div><div>${E(has ? (String(ans[pid].answer).trim() || 'Leeg antwoord') : 'Nog geen antwoord')}</div><div><button type="button" class="goodBtn ${st===true?'goodSelected':''}" data-pid="${pid}" data-good="true">✅</button><button type="button" class="badBtn ${st===false?'badSelected':''}" data-pid="${pid}" data-good="false">❌</button></div></div>`;
      }).join('');
    };
  }
})();
