/* AlpenManager – Supabase Mehrspieler-Modus.
   Einmal supabase_setup.sql ausführen. Der Publishable Key ist für Browser vorgesehen.
   Keine geheimen Supabase-Schlüssel werden an den Browser ausgegeben. */
(function () {
  "use strict";
  const API = "https://xvgbisxwptnfupibcbpg.supabase.co/rest/v1/rpc/";
  const KEY = "sb_publishable_WF742ZbvUE8BzCTT2MZw2w_K2wFvYyt";
  const STORAGE_KEY = "alpenmanager_online_session_v1";
  const PROJECTOR_KEY = "alpenmanager_beamer_session_v1";
  let session = null, room = null, polling = false, working = false, refreshPending = false;
  let lastTouchAttempt = 0;
  let teacherPin = ""; // Nur im Arbeitsspeicher, nicht dauerhaft speichern.
  let previewActive = false;
  let lastView = "", lastVersion = -1, reportSlot = 1, message = "", lastFinishAttempt = 0;
  const app = () => document.getElementById("app");
  const get = id => document.getElementById(id);
  const text = v => String(v == null ? "" : v);
  const html = v => text(v).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const num = v => Math.round(Number(v)||0).toLocaleString("de-CH");
  const phaseNames = {lobby:"Warteraum",intro:"Saisonereignis",decision:"Strategiephase",report:"Saisonbericht",finished:"Schlussrangliste"};
  const teamBySlot = (slot) => (room?.teams||[]).find(x => x.slot === Number(slot));
  const own = () => teamBySlot(session?.slot);
  const isHost = () => session && session.role === "host";
  const isProjector = () => session && session.role === "projector";
  const stateFor = t => (t && t.state && Object.keys(t.state).length ? t.state : clone(START));
  const stored = () => { try { return JSON.parse(sessionStorage.getItem(PROJECTOR_KEY))||JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } };
  function saveSession(s) {
    session=s;
    lastTouchAttempt=0;
    if(s.role==="projector"){sessionStorage.setItem(PROJECTOR_KEY,JSON.stringify(s));}
    else{sessionStorage.removeItem(PROJECTOR_KEY);localStorage.setItem(STORAGE_KEY,JSON.stringify(s));}
  }
  function clearSession(){
    if(session?.role==="projector")sessionStorage.removeItem(PROJECTOR_KEY);
    else{localStorage.removeItem(STORAGE_KEY);sessionStorage.removeItem(PROJECTOR_KEY);}
    session=null;room=null;lastView="";lastVersion=-1;lastTouchAttempt=0;
  }
  function status(messageText, error) {
    message = messageText || "";
    const el = get("netMessage");
    if (el) { el.textContent = message; el.style.color = error ? "#a92b32" : "#21556b"; }
  }
  async function rpc(name, body) {
    let response;
    try {
      response = await fetch(API+name, {
        method:"POST", headers:{"apikey":KEY,"Content-Type":"application/json"},
        body:JSON.stringify(body||{}),cache:"no-store"
      });
    } catch (e) { throw new Error("Supabase ist nicht erreichbar. Bitte Internetverbindung prüfen."); }
    const raw = await response.text();
    let data; try { data=raw?JSON.parse(raw):null; } catch { data=null; }
    if (!response.ok) {
      if (response.status===404 || (data && data.code==="PGRST202"))
        throw new Error("Supabase-Funktionen fehlen oder sind veraltet. Bitte UPDATE_5_MIN_INAKTIVITAET.sql im Supabase SQL Editor ausführen (bei Neuinstallation: supabase_setup.sql).");
      throw new Error((data && (data.message || data.error_description)) || "Supabase-Fehler ("+response.status+")");
    }
    return data;
  }
  function installStyle() {
    if(get("netStyles"))return;
    const el=document.createElement("style");el.id="netStyles";
    el.textContent=".net-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:17px}.net-tag{background:#e8f2f8;color:#174e6e;border:1px solid #c7dce9;border-radius:9px;padding:7px 12px;font-size:13px;font-weight:650}.net-code{font-size:35px;letter-spacing:5px;font-weight:800;color:#0c4870}.net-item{padding:13px;border:1px solid #dce8ef;border-radius:10px;margin-bottom:9px;background:#fbfdff}.net-item strong{display:block}.net-muted{color:#607589;font-size:13px}.net-action{margin-top:13px}.net-flex{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.net-input{width:100%;border:1px solid #cadbe6;border-radius:9px;padding:12px;margin:7px 0 13px;background:#fff;color:#172e42}.net-flag{display:inline-block;padding:4px 9px;border-radius:8px;font-size:12px;background:#e7f4ef;color:#236748}.net-flag.wait{background:#fff3e0;color:#815000}.net-error{min-height:18px;margin-top:13px;font-size:14px}.net-ranking{display:grid;gap:10px}.net-rank{border:1px solid #dce8ef;background:#fbfdff;border-radius:12px;padding:16px}.net-rank.winner{border-color:#78aaa0;background:#f1faf7}.net-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.net-timer{font-size:35px;font-weight:800;color:#12668b;letter-spacing:1px}.net-short{font-size:13px;color:#657f91}.net-locked{opacity:.6}.net-note{background:#eff6fa;border-radius:10px;padding:12px 14px;color:#33576a}.net-bad{color:#ad2834}.net-team-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px}@media(max-width:560px){.net-code{font-size:26px}.net-timer{font-size:27px}}";
    el.textContent += ".net-role-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;align-items:stretch}.net-role-grid .panel{height:100%}.projector{max-width:1480px;margin:auto}.projector .net-code{font-size:46px}.projector h2{font-size:clamp(25px,3vw,43px)}.projector h3{font-size:23px}.projector .net-stat{border:1px solid #d5e5ee;background:#fff;border-radius:16px;padding:19px;min-width:0}.projector .net-big{font-size:clamp(24px,3vw,43px);font-weight:850;line-height:1.1;color:#0d415c}.projector .net-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.projector .net-team{display:grid;grid-template-columns:minmax(135px,1fr) auto;gap:12px;align-items:center;border:1px solid #d5e5ee;border-radius:13px;padding:16px;background:#fff}.projector .net-score-row{display:grid;grid-template-columns:65px minmax(120px,1fr) 85px 120px;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #dce9f1}.projector .net-bartrack{height:14px;background:#e8f0f4;border-radius:8px;overflow:hidden}.projector .net-barfill{height:100%;border-radius:8px;background:#237b98}.projector .net-hero{background:linear-gradient(115deg,#11354f,#196281);border-radius:20px;color:white;padding:28px 32px;margin-bottom:20px}.projector .net-hero h2,.projector .net-hero .net-big{color:#fff}.projector .net-event{padding:20px 0}.projector .net-event img{max-height:360px;object-fit:cover}.projector .net-project-timer{font-size:clamp(64px,12vw,150px);font-weight:900;letter-spacing:5px;line-height:1.2;color:#0d526d;text-align:center}.projector .net-sub{font-size:16px;color:#5a7588}.projector .net-history{width:100%;height:auto;max-height:270px}.projector .net-legend{display:flex;gap:16px;flex-wrap:wrap}.projector .net-dot{width:12px;height:12px;display:inline-block;border-radius:100%;margin-right:5px}@media(max-width:670px){.projector .net-score-row{grid-template-columns:45px 1fr 60px}.projector .net-score-row .net-extracol{display:none}.projector .net-code{font-size:30px}}";
    el.textContent += ".projector .net-host-controls{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:18px;border:1px solid #b4d6e6;background:linear-gradient(110deg,#f0f8fc,#fff)}.projector .net-host-controls h3{margin:4px 0;font-size:19px}.projector .net-host-controls p{margin:3px 0}.projector .net-host-eyebrow{font-size:11px;color:#18739a;font-weight:850;letter-spacing:.07em}.projector .net-host-actions .btn{padding:13px 17px;min-width:190px}.projector .net-host-actions .btn:disabled{opacity:.46;cursor:not-allowed}@media(max-width:670px){.projector .net-host-controls{display:block}.projector .net-host-actions .btn{width:100%;margin-top:12px}}";
    document.head.appendChild(el);
  }
  function pageTop(title) {
    const phase=room?phaseNames[room.phase]:"Online";
    const head=get("headState"); if(head)head.textContent=room?"Saison "+room.season+"/5 · "+phase:"Online-Spiel";
    return '<div class="net-top"><div><h2>'+html(title)+'</h2><span class="net-muted">'+(previewActive?'AlpenManager · Lokale Demo ohne Supabase':'AlpenManager · Online-Spiel über Supabase')+'</span></div><span class="net-tag">'+html(phase||"Online")+'</span></div>';
  }
  function msgBox(){return '<p id="netMessage" class="net-error" role="status">'+html(message)+'</p>';}
  function leaveButton(){return '<button class="btn alt" id="netLeave">Verbindung verlassen</button>';}
  function bindLeave(){const el=get("netLeave");if(el)el.onclick=()=>{const warning=isHost()?"Spielleitungszugang auf diesem Gerät verlassen? Der Zugangstoken wird gelöscht. Ohne ihn können Sie diese Runde nicht weiter steuern.":"Diese Ansicht verlassen? Die Spielrunde bleibt gespeichert.";if(confirm(warning)){clearSession();homepage();}};}

  // Neue Spielrunden öffnen direkt das kombinierte Beamer- und Steuerungsdashboard.
  // Echte Nutzerinteraktionen aktualisieren die Frist, automatische Abfragen niemals.
  function formatIdleTime(){
    if(!room?.last_activity)return "5:00";
    const left=Math.max(0,Math.ceil((Date.parse(room.last_activity)+300000-Date.now())/1000));
    return Math.floor(left/60)+":"+String(left%60).padStart(2,"0");
  }
  function refreshIdleDisplay(){
    const el=get("netIdleCountdown");
    if(el)el.textContent="Automatische Löschung nach fünf Minuten ohne Bedienung · "+formatIdleTime()+" verbleibend";
  }
  function returnAfterExpiry(note){
    clearSession();
    message=note||"Die Spielrunde ist nicht mehr verfügbar. Nach fünf Minuten Inaktivität werden Spiele automatisch gelöscht.";
    homepage();
    status(message,true);
  }
  function recordRealActivity(event){
    if(!event.isTrusted||!session?.token||!room||previewActive||isProjector())return;
    if(!app()?.contains(event.target)||event.target?.closest?.("#netLeave"))return;
    if(event.type==="keydown"&&["Shift","Control","Alt","Meta","Tab"].includes(event.key))return;
    const now=Date.now();
    if(now-lastTouchAttempt<20000)return;
    lastTouchAttempt=now;
    const code=session.code,token=session.token;
    rpc("am_touch_room",{p_code:code,p_token:token}).catch(e=>{
      if(session?.code!==code||session?.token!==token)return;
      if(/Inaktivität beendet|Spielcode oder Zugang ungültig/.test(e.message))returnAfterExpiry();
      else if(/SQL Editor/.test(e.message))status(e.message,true);
    });
  }
  function teacherLanding(){
    if(!teacherPin){homepage();return;}
    room=null;lastView="teacher";lastVersion=-1;message="";
    const h=get("headState");if(h)h.textContent="Lehrpersonenbereich";
    app().innerHTML='<div class="am-entry am-entry--teacher">'+
      '<section class="am-welcome am-welcome--teacher"><div class="am-welcome-inner"><div class="am-eyebrow">SPIELLEITUNG · GESCHÜTZTER BEREICH</div>'+
      '<h2>Ihre Spielrunde. Ihre Regie.</h2><p>Eröffnen Sie eine Partie. Danach sehen Sie Spielcode, Teamstatus, Countdown, Rangliste und die komplette Spielsteuerung direkt in einem Dashboard.</p></div></section>'+
      '<div class="am-card-grid am-card-grid--single">'+
      '<section class="am-card am-card--primary"><div class="am-card-head"><span class="am-card-symbol" aria-hidden="true">01</span><div><p class="am-card-overline">NEUES SPIEL</p><h3>Spielrunde und Dashboard eröffnen</h3></div></div>'+
      '<p class="am-card-intro">Erstellen Sie einen Spielcode für drei Skigebiete. Das gemeinsame Dashboard kann anschliessend auch im Vollbild am Beamer gezeigt werden.</p>'+
      '<div class="am-form-group"><label for="netRoomTitle">Name der Spielrunde</label><input class="net-input" id="netRoomTitle" maxlength="60" value="AlpenManager" autocomplete="off"></div>'+
      '<button class="btn am-submit" id="netCreate">Spiel erstellen und Dashboard öffnen <span aria-hidden="true">→</span></button>'+
      '<p class="am-footnote">Nach fünf Minuten ohne Aktivität auf allen Geräten wird die gesamte Spielrunde automatisch gelöscht.</p></section></div>'+
      '<div class="am-tools"><div><strong>Für die Vorbereitung</strong><p>Testen Sie die kombinierte Lehreranzeige oder das Spiel unabhängig von Supabase.</p></div><button class="btn alt" id="netOffline">Lokale Demo öffnen</button></div>'+
      '<div class="am-back"><button class="btn alt" id="netTeacherBack">← Zur Startseite / abmelden</button></div>'+msgBox()+'</div>';
    get("netCreate").onclick=async()=>{
      const button=get("netCreate");if(button)button.disabled=true;
      try{
        status("Erstelle die Spielrunde …");
        const x=await rpc("am_create_room",{p_title:get("netRoomTitle").value.trim()||"AlpenManager",p_pin:teacherPin});
        teacherPin="";
        saveSession({code:x.code,token:x.token,role:"host"});
        await refresh(true);
      }catch(e){status(e.message,true)}
      finally{if(get("netCreate"))get("netCreate").disabled=false}
    };
    get("netTeacherBack").onclick=()=>{teacherPin="";homepage()};
    get("netOffline").onclick=()=>{startView()};
  }

  function homepage(){
    room=null;lastView="home";lastVersion=-1;
    const head=get("headState");if(head)head.textContent="Startseite";
    let preset="";try{preset=new URLSearchParams(location.search).get("code")||"";}catch{}
    const code=/^[0-9]{4}$/.test(preset)?preset:"";
    app().innerHTML='<div class="am-entry am-entry--home">'+
      '<section class="am-welcome"><div class="am-welcome-inner">'+
      '<div class="am-eyebrow">PLANSPIEL · ANSPRUCHSGRUPPEN</div>'+
      '<h2>Führen. Entscheiden.<br>Verantwortung übernehmen.</h2>'+
      '<p>Leiten Sie Ihr Skigebiet durch fünf Wintersaisons. Ihre Entscheidungen beeinflussen Finanzen, Gäste und Anspruchsgruppen – manchmal erst Jahre später.</p>'+
      '<div class="am-facts"><span><strong>5</strong> Saisons</span><span><strong>3</strong> Skigebiete</span><span><strong>7</strong> Anspruchsgruppen</span></div>'+
      '</div></section>'+
      '<div class="am-card-grid">'+
      '<section class="am-card am-card--primary"><div class="am-card-head"><span class="am-card-symbol" aria-hidden="true">01</span><div><p class="am-card-overline">FÜR LERNENDE</p><h3>Spiel beitreten</h3></div></div>'+
      '<p class="am-card-intro">Ihre Lehrperson gibt Ihnen einen vierstelligen Spielcode. Ihr Skigebiet wird beim Beitritt automatisch zugeteilt.</p>'+
      '<div class="am-form-group"><label for="netCode">Spielcode</label><input class="net-input am-input-code" id="netCode" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="z. B. 4821" autocomplete="off" value="'+html(code)+'"></div>'+
      '<div class="am-form-group"><label for="netName">Name Ihres Skigebiets</label><input class="net-input" id="netName" maxlength="36" placeholder="z. B. Bergblick" autocomplete="off"></div>'+
      '<button class="btn am-submit" id="netJoin">Spiel beitreten <span aria-hidden="true">→</span></button>'+
      '<p class="am-footnote">Kein Passwort nötig. Pro Team wird ein Gerät verwendet. Fünf Minuten ohne Aktivität löschen die Runde automatisch.</p></section>'+
      '<section class="am-card am-card--secondary"><div class="am-card-head"><span class="am-card-symbol" aria-hidden="true">02</span><div><p class="am-card-overline">FÜR LEHRPERSONEN</p><h3>Lehrpersonen-Dashboard</h3></div></div>'+
      '<p class="am-card-intro">Erstellen und steuern Sie eine Spielrunde. Im Beamer-Dashboard behalten alle den Countdown und die Ergebnisse im Blick.</p>'+
      '<div class="am-form-group"><label for="netTeacherPin">Lehrpersonen-Passwort</label><input class="net-input" id="netTeacherPin" type="password" maxlength="16" autocomplete="off" placeholder="Passwort eingeben"></div>'+
      '<button class="btn alt am-submit" id="netTeacherLogin">Dashboard öffnen <span aria-hidden="true">→</span></button>'+
      '<div class="am-teacher-hint"><strong>Im Dashboard können Sie:</strong><span>Spielrunde erstellen</span><span>Saisons steuern</span><span>Live-Ergebnisse projizieren</span></div>'+
      '<p class="am-footnote">Neue Spielrunden sind nur für angemeldete Lehrpersonen zugänglich.</p></section></div>'+msgBox()+'</div>';
    get("netJoin").onclick=async()=>{
      try{
        status("Team wird angemeldet …");
        const code=get("netCode").value.trim(),name=get("netName").value.trim();
        if(!/^[0-9]{4}$/.test(code))throw Error("Bitte den vierstelligen Zahlencode eingeben.");
        if(name.length<2)throw Error("Bitte einen Namen für das Skigebiet eingeben.");
        const x=await rpc("am_join_room",{p_code:code,p_name:name});
        saveSession({code:x.code,token:x.token,role:"team",slot:x.slot});
        await refresh(true);
      }catch(e){status(e.message,true)}
    };
    get("netTeacherLogin").onclick=async()=>{
      const pin=get("netTeacherPin").value.trim();
      if(!pin){status("Bitte das Lehrpersonen-Passwort eingeben.",true);return;}
      const b=get("netTeacherLogin");if(b)b.disabled=true;
      try{
        status("Prüfe den Lehrpersonen-Zugang …");
        await rpc("am_verify_teacher",{p_pin:pin});
        teacherPin=pin;
        teacherLanding();
      }catch(e){status(e.message,true)}
      finally{if(get("netTeacherLogin"))get("netTeacherLogin").disabled=false}
    };
    get("netTeacherPin").onkeydown=e=>{if(e.key==="Enter")get("netTeacherLogin").click()};
  }
  function commonHeader() {
    return pageTop(isHost()?"Spielleitung":(own()?.name||"Ihr Skigebiet"))+
      '<div class="panel" style="margin-bottom:16px"><p id="netIdleCountdown" class="net-muted" style="margin:0 0 12px"></p><div class="net-flex"><div><span class="net-muted">Spielcode</span><div class="net-code">'+html(room.code)+'</div></div><div><span class="net-muted">Saison</span><h3>'+room.season+' / 5</h3></div><div class="net-flex">'+(isHost()?'<a class="btn alt" target="_blank" rel="noopener" href="?dashboard=1&amp;code='+encodeURIComponent(room.code)+'">Beamer-Dashboard öffnen</a>':'')+leaveButton()+'</div></div></div>';
  }
  function namesAndReady(){
    return (room.teams||[]).map(t=>'<div class="net-item net-flex"><div><strong>Skigebiet '+t.slot+': '+html(t.name)+'</strong><span class="net-muted">'+(room.phase==="decision"?(t.ready?"Entscheidungen eingereicht":"Entscheidungen ausstehend"):"Teilnahme bestätigt")+'</span></div><span class="net-flag '+(room.phase==="decision"&&!t.ready?"wait":"")+'">'+(room.phase==="decision"?(t.ready?"Bereit":"Offen"):"Beigetreten")+'</span></div>').join("");
  }
  function lobby(){
    const count=room.teams.length;
    app().innerHTML=commonHeader()+'<div class="net-columns"><section class="panel"><h3>Angemeldete Skigebiete ('+count+'/3)</h3>'+namesAndReady()+(count<3?'<p class="net-note">Die Lernenden treten mit dem vierstelligen Spielcode bei. Die Skigebiete werden automatisch zugeteilt.</p>':'')+'</section>'+
      '<section class="panel"><h3>'+(isHost()?"Spiel vorbereiten":"Warten auf den Start")+'</h3><p>'+(isHost()?"Sobald alle drei Skigebiete beigetreten sind, können Sie das gemeinsame Saisonereignis anzeigen.":"Die Lehrperson startet die Runde, sobald alle drei Teams bereit sind.")+'</p>'+
      (isHost()?'<button class="btn net-action" id="netStart" '+(count!==3?'disabled':'')+'>Spiel starten</button>':'')+'</section></div>'+msgBox();
    bindLeave();
    if(get("netStart"))get("netStart").onclick=()=>control("start");
  }
  function intro(){
    const e=EVENTS[room.season-1],imageFile=EVENT_IMAGES[room.season-1];
    app().innerHTML=commonHeader()+'<div class="event-screen" role="region" aria-label="Saisonereignis">'+
      '<div class="event-photo" style="background-image:url(&quot;'+encodeURI(imageFile)+'?v=20261022-online&quot;)"></div>'+
      '<div class="event-shade"></div><div class="event-content"><div class="kicker">Saison '+room.season+' von 5 · Eilmeldung</div>'+
      '<h2>'+html(e.title)+'</h2><p>'+html(e.desc)+'</p>'+
      (isHost()?'<button class="btn" id="netOpen">Strategiephase starten · 4 Minuten</button>':'<p class="net-note">Die Lehrperson startet gleich den gemeinsamen Vier-Minuten-Countdown.</p>')+
      '</div></div>'+msgBox();
    bindLeave();
    if(get("netOpen"))get("netOpen").onclick=()=>control("open");
  }
  function secondsLeft(){return room&&room.deadline?Math.max(0,Math.ceil((Date.parse(room.deadline)-Date.now())/1000)):240;}
  function formatTimer(){const s=secondsLeft();return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
  function refreshTimer(){const el=get("netTime");if(el&&room?.phase==="decision"){el.textContent=formatTimer();el.style.color=secondsLeft()===0?"#b03238":"#12668b";}}
  function updateReady(){
    const el=get("netReady");if(el)el.innerHTML=isHost()?projectorTeams():namesAndReady();
    const count=get("netCount");if(count)count.textContent=room.teams.filter(t=>t.ready).length+" von 3 Teams haben ihre Entscheidungen eingereicht.";
    const btn=get("netFinish");if(btn)btn.disabled=room.teams.filter(t=>t.ready).length!==3&&secondsLeft()>0;
  }
  function planDetails(){
    const t=own(),s=stateFor(t),d=(t?.choice&&Object.keys(t.choice).length?t.choice:defaults(s));
    const invested=i=>Boolean(s.assets[i.id]);
    const allInvest=INVEST.map(i=>'<label class="option"><input type="radio" name="investment" value="'+i.id+'" '+(invested(i)?"disabled":"")+' '+(!invested(i)&&d.investment===i.id?"checked":"")+'>'+html(i.name)+' · '+money(i.price)+(invested(i)?" · Bereits gekauft":"")+'<div class="hint">'+html(i.desc)+'</div></label>').join("");
    const noInvest=d.investment==="none"||!INVEST.some(i=>d.investment===i.id&&!invested(i));
    return '<div class="net-columns"><div class="stack"><section class="panel"><h3>Geschäftsentscheidungen</h3>'+
      field("price","Tageskartenpreis",40,100,5,d.price,"CHF ")+
      field("staff","Mitarbeitende",35,100,5,d.staff,"")+
      '<p class="hint">Personalkosten je Saison: bis 55 Mitarbeitende je CHF 62\'000, weitere Mitarbeitende je CHF 40\'000. Der Nutzen bleibt unverändert.</p>'+
      field("wage","Lohnänderung gegenüber Basislohn",-20,20,1,d.wage,"","+ %")+
      field("marketing","Marketingbudget",0,300000,25000,d.marketing,"CHF ")+
      field("maintenance","Wartungsbudget",50000,350000,25000,d.maintenance,"CHF ")+
      '<label for="segment">Zielgruppe der Werbung</label><select id="segment" class="net-input">'+SEGMENTS.map(x=>'<option '+(x===d.segment?"selected":"")+'>'+html(x)+'</option>').join("")+'</select>'+
      '<label for="supplier">Lieferantenmodell</label><select id="supplier" class="net-input"><option value="günstig">Günstig – Ersparnis, aber Risiko</option><option value="zuverlässig">Zuverlässig – ausgewogen</option><option value="nachhaltig">Nachhaltig – teurer, umweltfreundlich</option></select></section>'+
      '<section class="panel"><h3>Einmalige Investition</h3><p class="hint">Jedes Projekt ist nur einmal kaufbar.</p><label class="option"><input type="radio" name="investment" value="none" '+(noInvest?"checked":"")+'>Keine Investition</label>'+allInvest+'</section>'+
      '<section class="panel"><h3>Entscheidungen einreichen</h3><p>Sie können Ihre Eingaben innerhalb der Strategiephase mehrfach aktualisieren. Nach Ablauf der vier Minuten sind sie gesperrt.</p><button class="btn" id="netSave">Entscheidungen speichern</button><p id="netSaveStatus" class="net-muted">'+(t?.ready?"Ihre letzten Entscheidungen wurden gespeichert.":"Noch keine Entscheidung gespeichert.")+'</p></section></div>'+
      '<div class="stack"><section class="panel"><h3>Unternehmenskennzahlen</h3>'+metricHtml(s)+'</section>'+
      '<section class="panel"><h3>Die sieben Anspruchsgruppen</h3>'+groupsHtml(s)+'</section>'+
      '<section class="panel"><h3>Kapazität und Nachfrage</h3><div id="netCapacity"></div></section></div></div>';
  }
  function paintDecision(){
    const t=own(),s=stateFor(t),decision=t?.choice||{};
    if(secondsLeft()<=0){
      app().innerHTML=commonHeader()+'<section class="panel"><h2>Zeit abgelaufen</h2><p>Die Entscheidungen sind nun gesperrt. Die Lehrperson berechnet die Saison zentral.</p><h3>Gespeicherte Entscheidungen</h3><p>'+(t?.ready?"Ihre Eingaben wurden berücksichtigt.":"Es werden die bisherigen Standardeinstellungen verwendet.")+'</p></section>'+msgBox();
      bindLeave();return;
    }
    app().innerHTML=commonHeader()+'<div class="net-top"><h2>Strategiephase · Saison '+room.season+'/5</h2><div class="net-timer" id="netTime">'+formatTimer()+'</div></div>'+planDetails()+msgBox();
    bindLeave();get("supplier").value=decision.supplier||"zuverlässig";
    const updateCap=()=>{const d=readDecision();get("netCapacity").innerHTML=capacityOverview(s,d);};
    for(const id of ["price","staff","wage","marketing","maintenance"]){const el=get(id);const draw=()=>{const v=(id==="marketing"||id==="maintenance")?num(el.value):el.value;get(id+"Val").textContent=el.dataset.prefix+v+el.dataset.suffix};el.oninput=()=>{draw();updateCap()};draw()}
    document.querySelectorAll('input[name="investment"]').forEach(el=>el.onchange=updateCap);
    updateCap();
    get("netSave").onclick=async()=>{try{const d=readDecision();const b=get("netSave");b.disabled=true;status("Entscheidungen werden gespeichert …");await rpc("am_save_choice",{p_code:session.code,p_token:session.token,p_choice:d});if(get("netSaveStatus"))get("netSaveStatus").textContent="Entscheidungen gespeichert. Änderungen bis zum Zeitablauf möglich.";status("Ihre Entscheidungen sind gespeichert.");await refresh(false);}catch(e){status(e.message,true)}finally{if(get("netSave"))get("netSave").disabled=false}};
  }
  function readDecision(){
    const val=id=>Number(get(id).value);const chosen=document.querySelector('input[name="investment"]:checked');
    return {price:val("price"),staff:val("staff"),wage:val("wage"),marketing:val("marketing"),maintenance:val("maintenance"),segment:get("segment").value,supplier:get("supplier").value,investment:chosen?chosen.value:"none"};
  }
  function hostDecisions(){
    app().innerHTML=commonHeader()+'<div class="net-top"><h2>Gemeinsame Strategiephase</h2><div class="net-timer" id="netTime">'+formatTimer()+'</div></div>'+
      '<div class="net-columns"><section class="panel"><h3 id="netCount">0 / 3 Teams</h3><div id="netReady">'+namesAndReady()+'</div><p class="net-note">Der Countdown läuft auf dem Server für alle gleichzeitig. Nach Zeitablauf werden weitere Eingaben abgewiesen.</p><button class="btn" id="netFinish">Saison auswerten</button><p class="net-muted">Vorzeitig möglich, wenn alle Teams ihre Entscheidungen eingereicht haben. Sonst nach Ablauf der vier Minuten.</p></section>'+
      '<section class="panel"><h3>Spielleitung</h3><p>Die Lernenden sehen nur ihre eigenen Entscheidungen. Sobald die Saison beendet ist, werden alle drei Skigebiete zusammen berechnet und die Resultate veröffentlicht.</p><p class="net-muted">Die Lehrperson löst die Auswertung selbst aus, sobald alle drei Teams eingereicht haben oder vier Minuten vergangen sind.</p></section></div>'+msgBox();
    bindLeave();get("netFinish").onclick=finishSeason;updateReady();
  }
  function scoreboard(){
    const rows=(room.results||[]).slice().sort((a,b)=>Number(b.solvent)-Number(a.solvent)||b.score-a.score);
    if(!rows.length)return '<p>Die Ergebnisse werden vorbereitet.</p>';
    return '<div class="net-ranking">'+rows.map((r,i)=>'<div class="net-rank '+(i===0&&r.solvent?"winner":"")+'"><div class="net-flex"><div><strong>'+(i+1)+'. '+html(r.name)+'</strong><div class="net-muted">'+num(r.guests)+' Gäste · '+money(r.profit)+' Saisonergebnis · '+money(r.cash)+' Kontostand</div></div><strong>'+num(r.score)+'/100</strong></div>'+(r.solvent?"":'<span class="net-bad">Nicht gewinnberechtigt</span>')+'</div>').join("")+'</div>';
  }
  function report(){
    const current=isHost()?teamBySlot(reportSlot):own(),t=current||room.teams[0],s=stateFor(t),l=s.last;
    let header=commonHeader()+'<h2>Saisonbericht '+room.season+'/5</h2>';
    if(isHost())header+='<div class="net-team-tabs">'+room.teams.map(x=>'<button class="btn '+(x.slot===reportSlot?"":"alt")+'" data-report-slot="'+x.slot+'">'+html(x.name)+'</button>').join("")+'</div>';
    let body= '<div class="panel"><h3>Gemeinsamer Vergleich</h3>'+scoreboard()+'</div>';
    if(l)body+='<div class="net-columns" style="margin-top:16px"><section class="panel"><h3>'+html(t.name)+'</h3>'+metricHtml(s)+'<h3 style="margin-top:16px">Anspruchsgruppen</h3>'+groupsHtml(s)+'</section><section class="panel"><h3>Was hat Ihre Strategie bewirkt?</h3>'+l.news.map(x=>'<p class="net-item">'+html(x)+'</p>').join("")+'</section></div>'+decisionImpact(l,s)+'<div style="margin-top:16px">'+reportFinance(l,s)+'</div>';
    if(isHost())body+='<div class="panel" style="margin-top:16px"><button class="btn" id="netNext">'+(room.season===5?"Schlussrangliste anzeigen":"Nächste Saison vorbereiten")+'</button></div>';
    else body+='<p class="net-note" style="margin-top:16px">Die Lehrperson startet die nächste Saison.</p>';
    app().innerHTML=header+body+msgBox();bindLeave();
    document.querySelectorAll("[data-report-slot]").forEach(b=>b.onclick=()=>{reportSlot=Number(b.dataset.reportSlot);report()});
    if(get("netNext"))get("netNext").onclick=()=>control("next");
  }
  function finished(){
    // Die Lehrperson darf sämtliche Resultate sehen; für Lernende bleiben
    // die noch nicht freigegebenen Unternehmensdetails der Rivalen verborgen.
    const entries=(room.teams||[]).map(t=>{
      const ownState=t.state&&Array.isArray(t.state.stake)?t.state:null;
      const summary=(room.results||[]).find(x=>Number(x.slot)===Number(t.slot))||{};
      return {name:t.name,slot:t.slot,state:ownState,summary};
    });
    app().innerHTML=commonHeader()+finalDashboardHtml(entries)+
      '<div class="final-actions"><button class="btn" id="netNew">Zur Startseite</button></div>'+msgBox();
    bindLeave();
    get("netNew").onclick=()=>{clearSession();homepage()};
  }

  // Beamer-Dashboard: eigene rein lesende Ansicht. Teamentscheidungen werden nie angefordert.
  const colours=["#16769a","#d88736","#468e69"];
  function projectorState(t){
    const source=isHost()&&t?.state&&Array.isArray(t.state.stake)?t.state:t?.stats;
    if(!source||!Array.isArray(source.stake))return null;
    const s=Object.assign(clone(START),source);
    s.assets=Object.assign(clone(START.assets),source.assets||{});
    return s;
  }
  function projectorSnapshot(){
    const teams=(room.teams||[]).map(t=>{
      const s=projectorState(t);
      return {slot:t.slot,name:t.name,ready:t.ready,state:s,
        rating:s?score({state:s}):null,
        history:s&&Array.isArray(s.history)?s.history:[]};
    });
    return teams.sort((a,b)=>Number(b.rating?.solvent||false)-Number(a.rating?.solvent||false)||(b.rating?.total||0)-(a.rating?.total||0));
  }
  function projectorShell(title,sub){
    return '<div class="projector"><div class="net-hero net-flex"><div><span style="font-size:14px;opacity:.8">ALPENMANAGER · LIVE-DASHBOARD</span><h2 style="margin:7px 0 5px">'+html(title)+'</h2><span style="opacity:.82">'+html(sub||"Drei Skigebiete · fünf Saisons")+'</span></div>'+
      '<div style="text-align:right"><div style="opacity:.8;font-size:13px">SPIELCODE</div><div class="net-code" style="color:white">'+html(room.code)+'</div><div style="opacity:.8;font-size:13px">Saison '+room.season+' von 5</div></div></div>';
  }
  function projectorTeams(){
    return '<div class="net-grid">'+[1,2,3].map(slot=>{
      const t=teamBySlot(slot);
      return '<div class="net-stat"><div class="net-muted">SKIGEBIET '+slot+'</div><h3 style="margin:7px 0">'+html(t?.name||"Noch nicht vergeben")+'</h3>'+
        '<div class="net-flex"><span class="net-flag '+(t&&room.phase==="decision"&&!t.ready?"wait":"")+'">'+
          (!t?"Nicht beigetreten":room.phase==="decision"?(t.ready?"✓ Eingereicht":"Entscheidung offen"):"✓ Angemeldet")+
        '</span><span style="font-size:13px;color:#5a7588">Team '+slot+'</span></div></div>';
    }).join("")+'</div>';
  }
  function projectorStanding(){
    const listed=projectorSnapshot();
    if(!listed.some(t=>t.rating))return '<section class="panel"><h3>Rangliste</h3><p>Die Ergebnisse erscheinen nach der ersten abgeschlossenen Saison.</p></section>';
    return '<section class="panel" style="margin-top:16px"><div class="net-flex"><h3>Gesamtwertung bis Saison '+(room.phase==="report"||room.phase==="finished"?room.season:Math.max(1,room.season-1))+'</h3><span class="net-muted">40 % Wirtschaft · 40 % Anspruchsgruppen · 20 % Zukunft</span></div>'+
      listed.map((t,i)=>{
        const sc=t.rating;
        return '<div class="net-score-row"><strong style="font-size:23px">'+(i+1)+'.</strong><div><strong style="font-size:18px">'+html(t.name)+'</strong><div class="net-muted">'+(sc?.solvent?"Gewinnberechtigt":"Nicht gewinnberechtigt")+'</div></div>'+
        '<strong class="net-big" style="font-size:28px">'+(sc?.total??"–")+'</strong><div class="net-extracol"><div class="net-bartrack"><div class="net-barfill" style="width:'+(sc?.total||0)+'%;background:'+colours[(t.slot-1)%3]+'"></div></div><span class="net-muted">'+money(t.state?.totalProfit||0)+' gesamt</span></div></div>';
      }).join("")+'</section>';
  }
  function projectorResults(){
    const stats=projectorSnapshot(),hasData=stats.some(t=>t.rating);
    if(!hasData)return "";
    let summaries='<section class="panel" style="margin-top:16px"><h3>Wirtschaftliche Kennzahlen</h3><div class="net-grid">'+
      stats.map(t=>'<div class="net-stat"><div class="net-muted">'+html(t.name)+'</div><strong class="net-big" style="font-size:25px">'+money(t.state?.totalProfit||0)+'</strong>'+
      '<p class="net-muted">Kumulierter Gewinn / Verlust</p><div class="net-flex"><div><strong>'+num(t.state?.guests)+'</strong><div class="net-muted">Gäste zuletzt</div></div><div><strong>'+money(t.state?.cash||0)+'</strong><div class="net-muted">Kontostand</div></div></div></div>').join("")+'</div></section>';
    summaries+='<section class="panel" style="margin-top:16px"><h3>Anspruchsgruppen im Vergleich</h3><div class="net-grid">'+
      stats.map(t=>'<div class="net-stat"><strong>'+html(t.name)+'</strong><div class="net-big" style="margin:8px 0;font-size:30px">'+(t.state?.stake?num(t.state.stake.reduce((a,b)=>a+Number(b),0)/t.state.stake.length):"–")+'/100</div><span class="net-muted">Durchschnittliche Zufriedenheit</span><div class="net-bartrack" style="margin-top:10px"><div class="net-barfill" style="width:'+(t.state?.stake?Math.max(0,Math.min(100,t.state.stake.reduce((a,b)=>a+Number(b),0)/t.state.stake.length)):0)+'%;background:'+colours[t.slot-1]+'"></div></div></div>').join("")+'</div></section>';
    const chart=projectorChart(stats);
    if(chart)summaries+='<section class="panel" style="margin-top:16px"><h3>Gewinnentwicklung über die Saisons</h3>'+chart+'</section>';
    return summaries;
  }
  function projectorChart(stats){
    const valid=stats.filter(t=>t.history.length);
    if(!valid.length)return "";
    const W=950,H=260,L=95,R=30,T=22,B=42;
    const series=valid.map(t=>{let sum=0;return {name:t.name,slot:t.slot,values:[0,...t.history.slice(0,5).map(h=>(sum+=Number(h.profit||0))/1000000)]};});
    const all=series.flatMap(s=>s.values);
    const low=Math.min(0,...all),high=Math.max(0,...all),diff=Math.max(1,high-low);
    const min=low-.12*diff,max=high+.12*diff;
    const x=i=>L+i*(W-L-R)/5;
    const y=v=>T+(max-v)/(max-min)*(H-T-B);
    let svg='<svg class="net-history" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Gewinnentwicklung in Millionen Franken">';
    for(let k=0;k<=4;k++){const n=min+(max-min)*k/4,yy=y(n);svg+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" stroke="#dce8ef" stroke-width="1"/><text x="7" y="'+(yy+4)+'" font-size="13" fill="#597386">'+n.toFixed(1)+' Mio.</text>';}
    for(let k=0;k<=5;k++)svg+='<text x="'+x(k)+'" y="'+(H-10)+'" font-size="14" text-anchor="middle" fill="#597386">'+(k===0?"Start":"Saison "+k)+'</text>';
    for(const s of series){const points=s.values.map((v,i)=>x(i)+','+y(v)).join(' ');const colour=colours[s.slot-1];svg+='<polyline points="'+points+'" fill="none" stroke="'+colour+'" stroke-width="4" stroke-linejoin="round"/>';for(let i=0;i<s.values.length;i++)svg+='<circle cx="'+x(i)+'" cy="'+y(s.values[i])+'" r="4" fill="'+colour+'"/>';}
    svg+='</svg>';
    return svg+'<div class="net-legend">'+series.map(s=>'<span><i class="net-dot" style="background:'+colours[s.slot-1]+'"></i>'+html(s.name)+'</span>').join("")+'</div><p class="net-muted">Kumulierter Saisongewinn in Millionen CHF. Investitionen sind in dieser Gewinnzahl nicht als vollständiger Saisonaufwand verbucht.</p>';
  }
  // Steuerbuttons sitzen im selben Dashboard wie Countdown und Teamstatistik.
  function hostDashboardControls(){
    const phase=room.phase,count=(room.teams||[]).length,ready=(room.teams||[]).filter(t=>t.ready).length;
    let action="",hint="";
    if(phase==="lobby"){
      action='<button class="btn" id="netStart" '+(count!==3?'disabled':'')+'>Spiel starten →</button>';
      hint=count===3?"Alle drei Skigebiete sind angemeldet.":"Warten auf drei echte Teams: "+count+" von 3 angemeldet.";
    }else if(phase==="intro"){
      action='<button class="btn" id="netOpen">Strategiephase starten · 4 Minuten →</button>';
      hint="Alle Teams sehen dasselbe Saisonereignis.";
    }else if(phase==="decision"){
      action='<button class="btn" id="netFinish" '+(ready!==3&&secondsLeft()>0?'disabled':'')+'>Saison auswerten →</button>';
      hint=ready===3?"Alle Entscheidungen gespeichert. Sie können die Saison jetzt auswerten.":secondsLeft()<=0?"Vier Minuten abgelaufen. Sie können die Saison auswerten.":"Auswertung möglich, sobald alle Teams gespeichert haben, sonst nach vier Minuten.";
    }else if(phase==="report"){
      action='<button class="btn" id="netNext">'+(room.season===5?"Schlussrangliste anzeigen":"Nächste Saison vorbereiten")+' →</button>';
      hint="Besprechen Sie die Ergebnisse und starten Sie anschliessend die nächste Saison.";
    }else{
      hint="Die Partie ist abgeschlossen. Für eine neue Partie zur Startseite zurückkehren.";
    }
    return '<section class="panel net-host-controls"><div><div class="net-host-eyebrow">SPIELLEITUNG · AKTIVE SPIELRUNDE</div><h3>Spielsteuerung</h3><p class="net-muted">'+hint+'</p><p id="netIdleCountdown" class="net-muted" style="font-weight:650"></p></div><div class="net-host-actions">'+action+'</div></section>';
  }
  function bindHostDashboardControls(){
    const start=get("netStart");if(start)start.onclick=()=>control("start");
    const open=get("netOpen");if(open)open.onclick=()=>control("open");
    const finish=get("netFinish");if(finish)finish.onclick=finishSeason;
    const next=get("netNext");if(next)next.onclick=()=>control("next");
  }
  function projectorPage(){
    const host=isHost();
    const phase=room.phase,desc=phaseNames[phase]||"Online",title=phase==="finished"?"Schlussrangliste":phase==="report"?"Ergebnisse der Saison "+room.season:phase==="decision"?"Strategiephase":phase==="intro"?"Saisonereignis":'Spielrunde vorbereiten';
    const head=get("headState");if(head)head.textContent=(host?"Spielleitung + Beamer":"Beamer")+" · Saison "+room.season+"/5";
    let body=projectorShell(title,desc);
    body+='<div class="net-flex" style="margin-bottom:14px"><span class="net-tag">'+(previewActive?"Lokale Vorschau":host?"Live · Lehrersteuerung und Beamer in einem":"Live · nur Anzeige · keine Spielsteuerung")+'</span><div class="net-flex"><button class="btn alt" id="netFull">Vollbild</button>'+leaveButton()+'</div></div>';
    if(host)body+=hostDashboardControls();
    if(phase==="lobby"){
      body+='<div class="panel"><h3>Teams beitreten lassen</h3><p>Vierstelligen Spielcode auf der Startseite eingeben. Die drei Skigebiete werden automatisch und eindeutig zugeteilt.</p>'+projectorTeams()+'</div>';
    }else if(phase==="intro"){
      const e=EVENTS[room.season-1],photo=EVENT_IMAGES[room.season-1];
      body+='<div class="event-screen" style="min-height:480px"><div class="event-photo" style="background-image:url(&quot;'+encodeURI(photo)+'&quot;)"></div><div class="event-shade"></div><div class="event-content"><div class="kicker">SAISON '+room.season+'/5 · EILMELDUNG</div><h2>'+html(e.title)+'</h2><p>'+html(e.desc)+'</p><p style="margin-top:16px">Die Spielleitung gibt die gemeinsame Strategiephase frei.</p></div></div>';
    }else if(phase==="decision"){
      body+='<section class="panel" style="text-align:center;margin-bottom:16px"><div class="net-muted">VERBLEIBENDE ENTSCHEIDUNGSZEIT</div><div class="net-project-timer" id="netTime">'+formatTimer()+'</div>'+
        '<p class="net-sub">'+(secondsLeft()>0?"Die drei Skigebiete entscheiden gleichzeitig.":"Zeit abgelaufen. Die Spielleitung berechnet jetzt die Saison.")+'</p></section><section class="panel"><h3>Fortschritt der drei Skigebiete</h3><div id="netReady">'+projectorTeams()+'</div><p class="net-muted" id="netCount">'+room.teams.filter(x=>x.ready).length+' von 3 Teams haben ihre Entscheidungen eingereicht.</p></section>';
      if(room.season>1)body+=projectorStanding();
    }else if(phase==="report"){
      body+=projectorStanding()+projectorResults();
      body+='<p class="net-note" style="margin-top:14px">Die Spielleitung startet die nächste Saison, sobald die Ergebnisse besprochen sind.</p>';
    }else{
      // Finaler Beamer nutzt denselben Schlussbildschirm. Fehlende vertrauliche
      // Werte (z. B. Mitarbeitendenzahl) werden nicht aus START erfunden.
      const finalTeams=projectorSnapshot().map(t=>({
        name:t.name,slot:t.slot,state:t.state,
        summary:(room.results||[]).find(x=>Number(x.slot)===Number(t.slot))||{}
      }));
      body+=finalDashboardHtml(finalTeams,{publicView:true});
      const finalChart=projectorChart(projectorSnapshot());
      if(finalChart)body+='<section class="panel" style="margin-top:18px"><h3>Gewinnentwicklung über die fünf Saisons</h3>'+finalChart+'</section>';
    }
    app().innerHTML=body+msgBox()+'</div>';
    bindLeave();
    if(host)bindHostDashboardControls();
    const full=get("netFull");if(full)full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){status("Vollbildmodus nicht verfügbar.",true)}};
  }

  function showPage() {
    if(!room||!session){homepage();return}
    installStyle();
    if(isProjector()||isHost())projectorPage();
    else if(room.phase==="lobby")lobby();
    else if(room.phase==="intro")intro();
    else if(room.phase==="decision"){if(isHost())hostDecisions();else paintDecision();}
    else if(room.phase==="report")report();
    else if(room.phase==="finished")finished();
    lastView=room.phase;lastVersion=room.version;
    refreshIdleDisplay();
  }
  async function refresh(force) {
    if(!session)return;
    if(polling){if(force)refreshPending=true;return;}
    polling=true;
    try{
      const fresh=await (isProjector()?rpc("am_projector_room",{p_code:session.code,p_pin:session.pin}):rpc("am_read_room",{p_code:session.code,p_token:session.token}));
      const changed=force||!room||fresh.phase!==lastView||fresh.season!==room.season||((fresh.phase==="lobby"||fresh.phase==="report"||fresh.phase==="finished")&&fresh.version!==room.version);
      room=fresh;message="";
      if(changed)showPage();
      else {
        lastVersion=room.version;
        refreshIdleDisplay();
        if(room.phase==="decision"){refreshTimer();if(!isHost()&&!isProjector()&&secondsLeft()<=0&&get("netSave"))paintDecision();if(isHost())updateReady();if(isProjector()){const p=get("netReady");if(p)p.innerHTML=projectorTeams();const q=get("netCount");if(q)q.textContent=room.teams.filter(x=>x.ready).length+" von 3 Teams haben ihre Entscheidungen eingereicht.";}}
        
      }
    }catch(e){
      if(/Inaktivität beendet/.test(e.message))returnAfterExpiry("Die Spielrunde wurde nach fünf Minuten ohne Aktivität beendet.");
      else if(/Zugang ungültig|Dashboard-Passwort ungültig|Spielcode nicht gefunden/.test(e.message))returnAfterExpiry();
      else status(e.message,true);
    }finally{
      polling=false;
      if(refreshPending){refreshPending=false;await refresh(true);}
    }
  }
  async function control(action){
    if(working)return;working=true;
    try{await rpc("am_control",{p_code:session.code,p_token:session.token,p_action:action});room=null;await refresh(true);}
    catch(e){status(e.message,true)}
    finally{working=false}
  }
  async function finishSeason(){
    if(!session||!isHost()||working||!room||room.phase!=="decision")return;
    lastFinishAttempt=Date.now();
    if(secondsLeft()>0&&room.teams.filter(x=>x.ready).length!==3){status("Vorzeitig nur möglich, wenn alle drei Teams ihre Entscheidungen gespeichert haben.",true);return;}
    working=true;status("Berechne die Saison für alle drei Skigebiete …");
    try{
      const fresh=await rpc("am_read_room",{p_code:session.code,p_token:session.token});
      if(fresh.phase!=="decision"){room=fresh;showPage();return;}
      const teams=fresh.teams.slice().sort((a,b)=>a.slot-b.slot);
      if(teams.length!==3)throw Error("Die Saison kann nur mit drei Teams berechnet werden.");
      game=newGame(teams.map(x=>x.name));
      game.season=fresh.season;
      game.teams.forEach((t,i)=>{
        t.state=teams[i].state&&Object.keys(teams[i].state).length?clone(teams[i].state):clone(START);
        t.pick=teams[i].choice&&Object.keys(teams[i].choice).length?Object.assign(defaults(t.state),teams[i].choice):defaults(t.state);
      });
      const oldReport=showReport,oldLocalSave=save;
      showReport=()=>{};save=()=>{}; // Online-Simulation nicht versehentlich in die lokale Demo speichern.
      try{runSeason();}finally{showReport=oldReport;save=oldLocalSave;}
      const results=game.teams.map((t,i)=>({slot:i+1,state:t.state,score:score(t).total,solvent:score(t).solvent}));
      await rpc("am_publish_results",{p_code:session.code,p_token:session.token,p_states:results});
      room=null;await refresh(true);
    }catch(e){status("Saisonberechnung: "+e.message,true)}
    finally{working=false}
  }

  // Offline-Vorschau der ECHTEN Lehrer- und Beamer-Oberfläche.
  // Eigene Beispiel-Partie wird im Speicher simuliert, niemals über Supabase.
  let previewSnapshots = [], previewPhase = "decision", previewRole = "teacher", previewSeason = 2;
  function samplePreviewStates(){
    const savedGame=game, savedShowReport=showReport, savedSave=save;
    const strategies=[
      {price:65,staff:65,wage:2,marketing:150000,maintenance:225000,segment:"Familien",supplier:"zuverlässig",invest:["family","lift","digital","service","none"]},
      {price:75,staff:55,wage:3,marketing:125000,maintenance:250000,segment:"Junge Erwachsene",supplier:"nachhaltig",invest:["eco","shuttle","staffHome","digital","none"]},
      {price:70,staff:60,wage:0,marketing:100000,maintenance:200000,segment:"Sportliche Gäste",supplier:"zuverlässig",invest:["lift","snow","service","eco","none"]}
    ];
    try{
      game=newGame(["Alpenblick","Schneeglück","Bergzauber"]);
      showReport=()=>{};save=()=>{};
      previewSnapshots=[game.teams.map(t=>clone(t.state))];
      for(let season=1;season<=5;season++){
        game.season=season;
        game.teams.forEach((t,i)=>{
          t.pick={...defaults(t.state),...strategies[i],investment:strategies[i].invest[season-1]||"none"};
        });
        runSeason();
        previewSnapshots.push(game.teams.map(t=>clone(t.state)));
      }
    }finally{
      game=savedGame;showReport=savedShowReport;save=savedSave;
    }
  }
  function previewRoom(){
    const completed=previewPhase==="finished"?5:previewPhase==="report"?previewSeason:previewPhase==="lobby"?0:previewSeason-1;
    const states=previewSnapshots[Math.max(0,Math.min(5,completed))];
    const names=["Alpenblick","Schneeglück","Bergzauber"];
    const teams=states.map((state,i)=>({
      slot:i+1,name:names[i],ready:previewPhase==="decision"?i!==2:false,
      choice:{},state:completed?clone(state):{},
      stats:completed?clone(state):null
    }));
    const results=completed?teams.map(t=>({
      slot:t.slot,name:t.name,guests:t.state.guests,
      profit:t.state.last?.profit||0,cash:t.state.cash,
      score:score({state:t.state}).total,
      solvent:score({state:t.state}).solvent
    })):[];
    return {
      code:"0000",title:"AlpenManager – Vorschau",phase:previewPhase,
      season:previewPhase==="finished"?5:previewPhase==="lobby"?1:previewSeason,
      deadline:previewPhase==="decision"?new Date(Date.now()+240000).toISOString():null,
      version:1,results,teams
    };
  }
  function renderDemoPreview(){
    installStyle();
    session={code:"0000",token:"demo-only",role:previewRole==="projector"?"projector":"host"};
    room=previewRoom();reportSlot=1;message="";
    const toolbar=get("demoPreviewToolbar");
    if(toolbar){
      toolbar.innerHTML='<div class="demo-preview-label"><strong>DEMO · LEHRPERSONEN-VORSCHAU</strong><small>Beispieldaten · keine Verbindung zu Supabase</small></div>'+
       '<label>Ansicht <select id="demoPreviewRole"><option value="teacher">Spielleitung</option><option value="projector">Beamer-Dashboard</option></select></label>'+
       '<label>Spielphase <select id="demoPreviewPhase"><option value="lobby">Warteraum</option><option value="intro">Saisonereignis</option><option value="decision">Strategiephase</option><option value="report">Saisonbericht</option><option value="finished">Schlussrangliste</option></select></label>'+
       '<label>Saison <select id="demoPreviewSeason">'+[1,2,3,4,5].map(x=>'<option value="'+x+'">'+x+' / 5</option>').join("")+'</select></label>'+
       '<a class="btn alt demo-preview-exit" href="?">Zur Startseite</a>';
      get("demoPreviewRole").value=previewRole;
      get("demoPreviewPhase").value=previewPhase;
      get("demoPreviewSeason").value=String(previewSeason);
      get("demoPreviewSeason").disabled=previewPhase==="lobby"||previewPhase==="finished";
      get("demoPreviewRole").onchange=()=>{previewRole=get("demoPreviewRole").value;renderDemoPreview()};
      get("demoPreviewPhase").onchange=()=>{previewPhase=get("demoPreviewPhase").value;renderDemoPreview()};
      get("demoPreviewSeason").onchange=()=>{previewSeason=Number(get("demoPreviewSeason").value)||2;renderDemoPreview()};
    }
    // Lehrer-Vorschau zeigt ebenfalls das kombinierte Live-Dashboard mit Steuerbuttons.
    projectorPage();

    // Sämtliche Aktionen bleiben lokal. Keine Online-RPC oder Speicherung.
    const leave=get("netLeave");if(leave)leave.onclick=()=>{location.href=location.pathname};
    const hostLink=app().querySelector('a[href*="dashboard=1"]');
    if(hostLink){hostLink.href="?demo=projector";hostLink.target="_blank";}
    const start=get("netStart");if(start)start.onclick=()=>{previewPhase="intro";renderDemoPreview()};
    const open=get("netOpen");if(open)open.onclick=()=>{previewPhase="decision";renderDemoPreview()};
    const finish=get("netFinish");if(finish){finish.disabled=false;finish.onclick=()=>{previewPhase="report";renderDemoPreview()};}
    const next=get("netNext");if(next)next.onclick=()=>{previewPhase=previewSeason===5?"finished":"intro";previewSeason=Math.min(5,previewSeason+1);renderDemoPreview()};
    const again=get("netNew");if(again)again.onclick=()=>{previewPhase="lobby";previewSeason=1;renderDemoPreview()};
    const marker=get("demoPreviewMarker");if(marker)marker.textContent="VORSCHAU – keine echten Teamdaten";
  }
  function openDemoPreview(role){
    previewActive=true;
    previewRole=role==="projector"?"projector":"teacher";
    previewSeason=2;
    previewPhase="decision";
    samplePreviewStates();
    const toolbar=document.createElement("div");
    toolbar.id="demoPreviewToolbar";
    toolbar.className="demo-preview-toolbar";
    app().parentNode.insertBefore(toolbar,app());
    renderDemoPreview();
  }

  function start(){
    installStyle();
    const demoRole=new URLSearchParams(location.search).get("demo");
    if(demoRole==="teacher"||demoRole==="projector"){openDemoPreview(demoRole);return;}
    let dashboardRequested=false;
    try{dashboardRequested=new URLSearchParams(location.search).has("dashboard");}catch{}
    if(dashboardRequested&&!sessionStorage.getItem(PROJECTOR_KEY)){session=null;homepage();}
    else{session=stored();}
    if(session&&session.code&&(session.token||(session.role==="projector"&&session.pin))){app().innerHTML='<section class="panel"><h2>Spielverbindung wird wiederhergestellt</h2><p>Verbinde mit Supabase und lade den aktuellen Spielstand …</p><button class="btn alt" id="netLeave">Zur Startseite</button>'+msgBox();bindLeave();refresh(true);}
    else if(!dashboardRequested){clearSession();homepage();}
    ["pointerdown","keydown","input","wheel"].forEach(eventName=>document.addEventListener(eventName,recordRealActivity,{passive:true,capture:true}));
    setInterval(()=>{if(!session)return;refreshIdleDisplay();refreshTimer();if(!isHost()&&!isProjector()&&room?.phase==="decision"&&secondsLeft()<=0&&get("netSave"))paintDecision();if(isHost()&&room?.phase==="decision")updateReady();},500);
    setInterval(()=>{if(session&&!polling&&!working)refresh(false);},1900);
  }
  document.addEventListener("DOMContentLoaded",start);
})();
