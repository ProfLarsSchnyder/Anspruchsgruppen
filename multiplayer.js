/* AlpenManager – Supabase Mehrspieler-Modus.
   Einmal supabase_setup.sql ausführen. Der Publishable Key ist für Browser vorgesehen.
   Keine geheimen Supabase-Schlüssel werden an den Browser ausgegeben. */
(function () {
  "use strict";
  const API = "https://xvgbisxwptnfupibcbpg.supabase.co/rest/v1/rpc/";
  const KEY = "sb_publishable_WF742ZbvUE8BzCTT2MZw2w_K2wFvYyt";
  const STORAGE_KEY = "alpenmanager_online_session_v1";
  const PROJECTOR_KEY = "alpenmanager_beamer_session_v1";
  let session = null, room = null, polling = false, working = false;
  let teacherPin = ""; // Nur im Arbeitsspeicher, nicht dauerhaft speichern.
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
    if(s.role==="projector"){sessionStorage.setItem(PROJECTOR_KEY,JSON.stringify(s));}
    else{sessionStorage.removeItem(PROJECTOR_KEY);localStorage.setItem(STORAGE_KEY,JSON.stringify(s));}
  }
  function clearSession(){
    if(session?.role==="projector")sessionStorage.removeItem(PROJECTOR_KEY);
    else{localStorage.removeItem(STORAGE_KEY);sessionStorage.removeItem(PROJECTOR_KEY);}
    session=null;room=null;lastView="";lastVersion=-1;
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
        throw new Error("Datenbank noch nicht eingerichtet: Bitte einmal supabase_setup.sql im Supabase SQL Editor ausführen.");
      throw new Error((data && (data.message || data.error_description)) || "Supabase-Fehler ("+response.status+")");
    }
    return data;
  }
  function installStyle() {
    if(get("netStyles"))return;
    const el=document.createElement("style");el.id="netStyles";
    el.textContent=".net-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:17px}.net-tag{background:#e8f2f8;color:#174e6e;border:1px solid #c7dce9;border-radius:9px;padding:7px 12px;font-size:13px;font-weight:650}.net-code{font-size:35px;letter-spacing:5px;font-weight:800;color:#0c4870}.net-item{padding:13px;border:1px solid #dce8ef;border-radius:10px;margin-bottom:9px;background:#fbfdff}.net-item strong{display:block}.net-muted{color:#607589;font-size:13px}.net-action{margin-top:13px}.net-flex{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.net-input{width:100%;border:1px solid #cadbe6;border-radius:9px;padding:12px;margin:7px 0 13px;background:#fff;color:#172e42}.net-flag{display:inline-block;padding:4px 9px;border-radius:8px;font-size:12px;background:#e7f4ef;color:#236748}.net-flag.wait{background:#fff3e0;color:#815000}.net-error{min-height:18px;margin-top:13px;font-size:14px}.net-ranking{display:grid;gap:10px}.net-rank{border:1px solid #dce8ef;background:#fbfdff;border-radius:12px;padding:16px}.net-rank.winner{border-color:#78aaa0;background:#f1faf7}.net-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.net-timer{font-size:35px;font-weight:800;color:#12668b;letter-spacing:1px}.net-short{font-size:13px;color:#657f91}.net-locked{opacity:.6}.net-note{background:#eff6fa;border-radius:10px;padding:12px 14px;color:#33576a}.net-bad{color:#ad2834}.net-team-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:15px}@media(max-width:560px){.net-code{font-size:26px}.net-timer{font-size:27px}}";
    el.textContent += ".net-role-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;align-items:stretch}.net-role-grid .panel{height:100%}.projector{max-width:1480px;margin:auto}.projector .net-code{font-size:46px}.projector h2{font-size:clamp(25px,3vw,43px)}.projector h3{font-size:23px}.projector .net-stat{border:1px solid #d5e5ee;background:#fff;border-radius:16px;padding:19px;min-width:0}.projector .net-big{font-size:clamp(24px,3vw,43px);font-weight:850;line-height:1.1;color:#0d415c}.projector .net-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.projector .net-team{display:grid;grid-template-columns:minmax(135px,1fr) auto;gap:12px;align-items:center;border:1px solid #d5e5ee;border-radius:13px;padding:16px;background:#fff}.projector .net-score-row{display:grid;grid-template-columns:65px minmax(120px,1fr) 85px 120px;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #dce9f1}.projector .net-bartrack{height:14px;background:#e8f0f4;border-radius:8px;overflow:hidden}.projector .net-barfill{height:100%;border-radius:8px;background:#237b98}.projector .net-hero{background:linear-gradient(115deg,#11354f,#196281);border-radius:20px;color:white;padding:28px 32px;margin-bottom:20px}.projector .net-hero h2,.projector .net-hero .net-big{color:#fff}.projector .net-event{padding:20px 0}.projector .net-event img{max-height:360px;object-fit:cover}.projector .net-project-timer{font-size:clamp(64px,12vw,150px);font-weight:900;letter-spacing:5px;line-height:1.2;color:#0d526d;text-align:center}.projector .net-sub{font-size:16px;color:#5a7588}.projector .net-history{width:100%;height:auto;max-height:270px}.projector .net-legend{display:flex;gap:16px;flex-wrap:wrap}.projector .net-dot{width:12px;height:12px;display:inline-block;border-radius:100%;margin-right:5px}@media(max-width:670px){.projector .net-score-row{grid-template-columns:45px 1fr 60px}.projector .net-score-row .net-extracol{display:none}.projector .net-code{font-size:30px}}";
    document.head.appendChild(el);
  }
  function pageTop(title) {
    const phase=room?phaseNames[room.phase]:"Online";
    const head=get("headState"); if(head)head.textContent=room?"Saison "+room.season+"/5 · "+phase:"Online-Spiel";
    return '<div class="net-top"><div><h2>'+html(title)+'</h2><span class="net-muted">AlpenManager · Online-Spiel über Supabase</span></div><span class="net-tag">'+html(phase||"Online")+'</span></div>';
  }
  function msgBox(){return '<p id="netMessage" class="net-error" role="status">'+html(message)+'</p>';}
  function leaveButton(){return '<button class="btn alt" id="netLeave">Verbindung verlassen</button>';}
  function bindLeave(){const el=get("netLeave");if(el)el.onclick=()=>{const warning=isHost()?"Spielleitungszugang auf diesem Gerät verlassen? Der Zugangstoken wird gelöscht. Ohne ihn können Sie diese Runde nicht weiter steuern.":"Diese Ansicht verlassen? Die Spielrunde bleibt gespeichert.";if(confirm(warning)){clearSession();homepage();}};}

  // Das Lehrpersonen-Dashboard ist der EINZIGE Einstieg für neue Online-Spiele.
  // Die Erlaubnis wird nicht nur im Browser, sondern in Supabase überprüft.
  function teacherLanding(){
    if(!teacherPin){homepage();return;}
    room=null;lastView="teacher";lastVersion=-1;message="";
    const h=get("headState");if(h)h.textContent="Lehrpersonen-Dashboard";
    let prefill="";try{prefill=new URLSearchParams(location.search).get("code")||"";}catch{}
    const code=/^[A-F0-9]{6}$/.test(prefill)?prefill:"";
    app().innerHTML='<div class="hero"><h2>Lehrpersonen-Dashboard</h2><p>Hier eröffnen Sie Ihre Spielrunde, verwalten den Spielablauf und öffnen die Beamer-Ansicht. Die drei Teams treten später selbstständig mit dem Spielcode bei.</p></div>'+
      '<div class="net-role-grid">'+
      '<section class="panel stack"><span class="net-tag">Spielleitung</span><h2>Neue Spielrunde</h2><p>Erstellt einen gemeinsamen Wettbewerb für drei Skigebiete über fünf Saisons. Der Zugang zur Steuerung wird auf diesem Gerät gespeichert.</p>'+
      '<label for="netRoomTitle">Name der Spielrunde (optional)</label><input class="net-input" id="netRoomTitle" maxlength="60" value="AlpenManager">'+
      '<button class="btn" id="netCreate">Spiel erstellen</button><p class="net-muted">Nach der Erstellung sehen Sie den Spielcode und die angemeldeten Teams.</p></section>'+
      '<section class="panel stack"><span class="net-tag">Für den Beamer</span><h2>Bestehende Spielrunde anzeigen</h2><p>Öffnen Sie eine laufende Spielrunde im schreibgeschützten Beamer-Dashboard mit grossem Timer, Teamstatus und Rangliste.</p>'+
      '<label for="netProjectCode">Spielcode</label><input class="net-input" id="netProjectCode" maxlength="6" value="'+html(code)+'" placeholder="z. B. A1B2C3" autocomplete="off">'+
      '<button class="btn alt" id="netProject">Beamer-Ansicht öffnen</button><p class="net-muted">Die Spielsteuerung bleibt getrennt von der Beamer-Ansicht.</p></section></div>'+
      '<div class="panel" style="margin-top:16px"><h3>Lokale Demonstration</h3><p class="net-muted">Die bestehende Ein-Gerät-Demo für die Unterrichtsvorbereitung kann weiterhin hier gestartet werden. Sie ist von den Online-Spielrunden getrennt.</p><button class="btn alt" id="netOffline">Lokale Demo öffnen</button></div>'+
      '<div style="margin-top:15px"><button class="btn alt" id="netTeacherBack">Abmelden und zur Startseite</button></div>'+msgBox();
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
    get("netProject").onclick=async()=>{
      const code=get("netProjectCode").value.trim().toUpperCase();
      if(!/^[A-F0-9]{6}$/.test(code)){status("Bitte einen gültigen Spielcode eingeben.",true);return;}
      try{
        status("Beamer-Ansicht wird geöffnet …");
        const preview=await rpc("am_projector_room",{p_code:code,p_pin:teacherPin});
        saveSession({code,pin:teacherPin,role:"projector"});
        teacherPin="";room=preview;message="";showPage();
      }catch(e){status(e.message,true)}
    };
    get("netTeacherBack").onclick=()=>{teacherPin="";homepage()};
    get("netOffline").onclick=()=>{startView()};
  }

  function homepage(){
    room=null;lastView="home";lastVersion=-1;
    const head=get("headState");if(head)head.textContent="Startseite";
    let preset="";try{preset=new URLSearchParams(location.search).get("code")||"";}catch{}
    const code=/^[A-F0-9]{6}$/.test(preset)?preset:"";
    app().innerHTML='<div class="hero"><h2>AlpenManager</h2><p>Drei Skigebiete, fünf Saisons und sieben Anspruchsgruppen. Starten Sie einen gemeinsamen Wettbewerb oder treten Sie Ihrem Team bei.</p></div>'+
      '<div class="net-role-grid">'+
      '<section class="panel stack"><span class="net-tag">Für Lernende</span><h2>Spiel beitreten</h2><p>Sie erhalten den Spielcode von Ihrer Lehrperson. Wählen Sie anschliessend eines der drei Skigebiete.</p>'+
      '<label for="netCode">Spielcode</label><input class="net-input" id="netCode" maxlength="6" placeholder="z. B. A1B2C3" autocomplete="off" value="'+html(code)+'">'+
      '<label for="netName">Name Ihres Skigebiets</label><input class="net-input" id="netName" maxlength="36" placeholder="z. B. Bergblick" autocomplete="off">'+
      '<label for="netSlot">Skigebiet</label><select class="net-input" id="netSlot"><option value="1">Skigebiet 1</option><option value="2">Skigebiet 2</option><option value="3">Skigebiet 3</option></select>'+
      '<button class="btn" id="netJoin">Spiel beitreten</button></section>'+
      '<section class="panel stack"><span class="net-tag">Nur für Lehrpersonen</span><h2>Lehrpersonen-Dashboard</h2><p>Melden Sie sich an, um eine neue Spielrunde zu erstellen, den Unterricht zu steuern oder Ergebnisse auf dem Beamer zu präsentieren.</p>'+
      '<label for="netTeacherPin">Lehrpersonen-Passwort</label><input class="net-input" id="netTeacherPin" type="password" maxlength="16" autocomplete="off" placeholder="Passwort eingeben">'+
      '<button class="btn alt" id="netTeacherLogin">Dashboard öffnen</button><p class="net-muted">Neue Spielrunden können ausschliesslich im Lehrpersonen-Dashboard erstellt werden.</p></section></div>'+msgBox();
    get("netJoin").onclick=async()=>{
      try{
        status("Team wird angemeldet …");
        const code=get("netCode").value.trim().toUpperCase(),name=get("netName").value.trim(),slot=+get("netSlot").value;
        if(!/^[A-F0-9]{6}$/.test(code))throw Error("Der Spielcode besteht aus sechs Zeichen (A–F, 0–9).");
        if(name.length<2)throw Error("Bitte einen Namen für das Skigebiet eingeben.");
        const x=await rpc("am_join_room",{p_code:code,p_slot:slot,p_name:name});
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
      '<div class="panel" style="margin-bottom:16px"><div class="net-flex"><div><span class="net-muted">Spielcode</span><div class="net-code">'+html(room.code)+'</div></div><div><span class="net-muted">Saison</span><h3>'+room.season+' / 5</h3></div><div class="net-flex">'+(isHost()?'<a class="btn alt" target="_blank" rel="noopener" href="?dashboard=1&amp;code='+encodeURIComponent(room.code)+'">Beamer-Dashboard öffnen</a>':'')+leaveButton()+'</div></div></div>';
  }
  function namesAndReady(){
    return (room.teams||[]).map(t=>'<div class="net-item net-flex"><div><strong>Skigebiet '+t.slot+': '+html(t.name)+'</strong><span class="net-muted">'+(room.phase==="decision"?(t.ready?"Entscheidungen eingereicht":"Entscheidungen ausstehend"):"Teilnahme bestätigt")+'</span></div><span class="net-flag '+(room.phase==="decision"&&!t.ready?"wait":"")+'">'+(room.phase==="decision"?(t.ready?"Bereit":"Offen"):"Beigetreten")+'</span></div>').join("");
  }
  function lobby(){
    const count=room.teams.length;
    app().innerHTML=commonHeader()+'<div class="net-columns"><section class="panel"><h3>Angemeldete Skigebiete ('+count+'/3)</h3>'+namesAndReady()+(count<3?'<p class="net-note">Die Lernenden treten über ihren Browser mit dem Spielcode bei und wählen ein noch freies Skigebiet.</p>':'')+'</section>'+
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
  function updateReady(){const el=get("netReady");if(el)el.innerHTML=namesAndReady();const count=get("netCount");if(count)count.textContent=room.teams.filter(t=>t.ready).length+" / 3 Teams";const btn=get("netFinish");if(btn)btn.disabled=room.teams.filter(t=>t.ready).length!==3 && secondsLeft()>0;}
  function planDetails(){
    const t=own(),s=stateFor(t),d=(t?.choice&&Object.keys(t.choice).length?t.choice:defaults(s));
    const invested=i=>Boolean(s.assets[i.id]);
    const allInvest=INVEST.map(i=>'<label class="option"><input type="radio" name="investment" value="'+i.id+'" '+(invested(i)?"disabled":"")+' '+(!invested(i)&&d.investment===i.id?"checked":"")+'>'+html(i.name)+' · '+money(i.price)+(invested(i)?" · Bereits gekauft":"")+'<div class="hint">'+html(i.desc)+'</div></label>').join("");
    const noInvest=d.investment==="none"||!INVEST.some(i=>d.investment===i.id&&!invested(i));
    return '<div class="net-columns"><div class="stack"><section class="panel"><h3>Geschäftsentscheidungen</h3>'+
      field("price","Tageskartenpreis",40,100,5,d.price,"CHF ")+
      field("staff","Mitarbeitende",35,100,5,d.staff,"")+
      field("wage","Lohnänderung gegenüber Basislohn",-20,20,1,d.wage,"","+ %")+
      field("marketing","Marketingbudget",0,300000,25000,d.marketing,"CHF ")+
      field("maintenance","Wartungsbudget",50000,350000,25000,d.maintenance,"CHF ")+
      '<label for="segment">Zielgruppe der Werbung</label><select id="segment" class="net-input">'+SEGMENTS.map(x=>'<option '+(x===d.segment?"selected":"")+'>'+html(x)+'</option>').join("")+'</select>'+
      '<label for="supplier">Lieferantenmodell</label><select id="supplier" class="net-input"><option value="günstig">Günstig – Ersparnis, aber Risiko</option><option value="zuverlässig">Zuverlässig – ausgewogen</option><option value="nachhaltig">Nachhaltig – teurer, umweltfreundlich</option></select></section>'+
      '<section class="panel"><h3>Einmalige Investition</h3><p class="hint">Jedes Projekt ist nur einmal kaufbar.</p><label class="option"><input type="radio" name="investment" value="none" '+(noInvest?"checked":"")+'>Keine Investition</label>'+allInvest+'</section>'+
      '<section class="panel"><h3>Entscheidungen einreichen</h3><p>Sie können Ihre Eingaben innerhalb der Strategiephase mehrfach aktualisieren. Nach Ablauf der vier Minuten sind sie gesperrt.</p><button class="btn" id="netSave">Entscheidungen speichern</button><p id="netSaveStatus" class="net-muted">'+(t?.ready?"Ihre letzten Entscheidungen wurden gespeichert.":"Noch keine Entscheidung gespeichert.")+'</p></section></div>'+
      '<div class="stack"><section class="panel"><h3>Unternehmenskennzahlen</h3>'+metricHtml(s)+'</section>'+
      '<section class="panel"><h3>Die sieben Anspruchsgruppen</h3>'+groupsHtml(s)+'</section>'+
      '<section class="panel"><h3>Kapazität und Nachfrage</h3><p id="netCapacity" class="net-note"></p><p class="hint">Ihr Marktanteil hängt auch von den Entscheidungen der beiden Konkurrenzunternehmen ab.</p></section></div></div>';
  }
  function paintDecision(){
    const t=own(),s=stateFor(t),decision=t?.choice||{};
    if(secondsLeft()<=0){
      app().innerHTML=commonHeader()+'<section class="panel"><h2>Zeit abgelaufen</h2><p>Die Entscheidungen sind nun gesperrt. Die Lehrperson berechnet die Saison zentral.</p><h3>Gespeicherte Entscheidungen</h3><p>'+(t?.ready?"Ihre Eingaben wurden berücksichtigt.":"Es werden die bisherigen Standardeinstellungen verwendet.")+'</p></section>'+msgBox();
      bindLeave();return;
    }
    app().innerHTML=commonHeader()+'<div class="net-top"><h2>Strategiephase · Saison '+room.season+'/5</h2><div class="net-timer" id="netTime">'+formatTimer()+'</div></div>'+planDetails()+msgBox();
    bindLeave();get("supplier").value=decision.supplier||"zuverlässig";
    const updateCap=()=>{const d=readDecision(),copy=clone(s);if(d.investment==="lift"&&!copy.assets.lift)copy.assets.lift=1;get("netCapacity").textContent="Geplante Kapazität: "+num(capacityOf(copy,d))+" Gäste pro Saison."};
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
      '<section class="panel"><h3>Spielleitung</h3><p>Die Lernenden sehen nur ihre eigenen Entscheidungen. Sobald die Saison beendet ist, werden alle drei Skigebiete zusammen berechnet und die Resultate veröffentlicht.</p><p class="net-muted">Dieses Lehrpersonen-Gerät muss für die automatische Berechnung geöffnet bleiben. Ist es geschlossen, wird die Saison nach Rückkehr berechnet.</p></section></div>'+msgBox();
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
    app().innerHTML=commonHeader()+'<section class="panel"><h2>Schlussrangliste · 5 Saisons</h2><p>40 % Wirtschaft · 40 % Anspruchsgruppen · 20 % Zukunftsfähigkeit. Zahlungsunfähige Unternehmen behalten ihre Punkte, können aber nicht gewinnen.</p>'+
      scoreboard()+'<h3 style="margin-top:22px">Reflexionsfragen</h3><p>Welche Anspruchsgruppen haben Sie berücksichtigt? Welche Interessenkonflikte gab es? Was würden Sie in einer neuen Partie anders machen?</p>'+
      '<button class="btn" id="netNew" style="margin-top:12px">Zur Startseite</button></section>'+msgBox();
    bindLeave();get("netNew").onclick=()=>{clearSession();homepage()};
  }

  // Beamer-Dashboard: eigene rein lesende Ansicht. Teamentscheidungen werden nie angefordert.
  const colours=["#16769a","#d88736","#468e69"];
  function projectorState(t){
    if(!t||!t.stats||!Array.isArray(t.stats.stake))return null;
    const s=Object.assign(clone(START),t.stats);
    s.assets=Object.assign(clone(START.assets),t.stats.assets||{});
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
  function projectorPage(){
    const phase=room.phase,desc=phaseNames[phase]||"Online",title=phase==="finished"?"Schlussrangliste":phase==="report"?"Ergebnisse der Saison "+room.season:phase==="decision"?"Strategiephase":phase==="intro"?"Saisonereignis":'Spielrunde vorbereiten';
    const head=get("headState");if(head)head.textContent="Beamer · Saison "+room.season+"/5";
    let body=projectorShell(title,desc);
    body+='<div class="net-flex" style="margin-bottom:14px"><span class="net-tag">Live · nur Anzeige · keine Spielsteuerung</span><div class="net-flex"><button class="btn alt" id="netFull">Vollbild</button>'+leaveButton()+'</div></div>';
    if(phase==="lobby"){
      body+='<div class="panel"><h3>Teams beitreten lassen</h3><p>Spielcode auf der Startseite eingeben und eines der drei Skigebiete wählen. Die Spielleitung startet nach dem Beitritt aller Gruppen.</p>'+projectorTeams()+'</div>';
    }else if(phase==="intro"){
      const e=EVENTS[room.season-1],photo=EVENT_IMAGES[room.season-1];
      body+='<div class="event-screen" style="min-height:480px"><div class="event-photo" style="background-image:url(&quot;'+encodeURI(photo)+'&quot;)"></div><div class="event-shade"></div><div class="event-content"><div class="kicker">SAISON '+room.season+'/5 · EILMELDUNG</div><h2>'+html(e.title)+'</h2><p>'+html(e.desc)+'</p><p style="margin-top:16px">Die Spielleitung gibt die gemeinsame Strategiephase frei.</p></div></div>';
    }else if(phase==="decision"){
      body+='<section class="panel" style="text-align:center;margin-bottom:16px"><div class="net-muted">VERBLEIBENDE ENTSCHEIDUNGSZEIT</div><div class="net-project-timer" id="netTime">'+formatTimer()+'</div>'+
        '<p class="net-sub">'+(secondsLeft()>0?"Die drei Skigebiete entscheiden gleichzeitig.":"Zeit abgelaufen. Die Spielleitung berechnet jetzt die Saison.")+'</p></section><section class="panel"><h3>Fortschritt der drei Skigebiete</h3><div id="netReady">'+projectorTeams()+'</div><p class="net-muted" id="netCount">'+room.teams.filter(x=>x.ready).length+' von 3 Teams haben ihre Entscheidungen eingereicht.</p></section>';
      if(room.season>1)body+=projectorStanding();
    }else{
      body+=projectorStanding()+projectorResults();
      if(phase==="report")body+='<p class="net-note" style="margin-top:14px">Die Spielleitung startet die nächste Saison, sobald die Ergebnisse besprochen sind.</p>';
      else body+='<div class="panel" style="margin-top:16px"><h3>Reflexion</h3><p>Welche Anspruchsgruppen wurden besonders berücksichtigt? Welche Interessenkonflikte gab es? Wer setzte seine Strategie über fünf Saisons überzeugend um?</p></div>';
    }
    app().innerHTML=body+msgBox()+'</div>';
    bindLeave();
    const full=get("netFull");if(full)full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){status("Vollbildmodus nicht verfügbar.",true)}};
  }

  function showPage() {
    if(!room||!session){homepage();return}
    installStyle();
    if(isProjector())projectorPage();
    else if(room.phase==="lobby")lobby();
    else if(room.phase==="intro")intro();
    else if(room.phase==="decision"){if(isHost())hostDecisions();else paintDecision();}
    else if(room.phase==="report")report();
    else if(room.phase==="finished")finished();
    lastView=room.phase;lastVersion=room.version;
  }
  async function refresh(force) {
    if(!session||polling)return;
    polling=true;
    try{
      const fresh=await (isProjector()?rpc("am_projector_room",{p_code:session.code,p_pin:session.pin}):rpc("am_read_room",{p_code:session.code,p_token:session.token}));
      const changed=force||!room||fresh.phase!==lastView||fresh.season!==room.season||((fresh.phase==="lobby"||fresh.phase==="report"||fresh.phase==="finished")&&fresh.version!==room.version);
      room=fresh;message="";
      if(changed)showPage();
      else {
        lastVersion=room.version;
        if(room.phase==="decision"){refreshTimer();if(!isHost()&&!isProjector()&&secondsLeft()<=0&&get("netSave"))paintDecision();if(isHost())updateReady();if(isProjector()){const p=get("netReady");if(p)p.innerHTML=projectorTeams();const q=get("netCount");if(q)q.textContent=room.teams.filter(x=>x.ready).length+" von 3 Teams haben ihre Entscheidungen eingereicht.";}}
        
      }
      if(isHost()&&room.phase==="decision"&&secondsLeft()<=0&&!working&&Date.now()-lastFinishAttempt>5000)await finishSeason();
    }catch(e){
      if(/Zugang ungültig|Dashboard-Passwort ungültig/.test(e.message)){clearSession();message="Der gespeicherte Zugang ist nicht mehr gültig.";homepage();}
      else status(e.message,true);
    }finally{polling=false;}
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
  function start(){
    installStyle();
    let dashboardRequested=false;
    try{dashboardRequested=new URLSearchParams(location.search).has("dashboard");}catch{}
    if(dashboardRequested&&!sessionStorage.getItem(PROJECTOR_KEY)){session=null;homepage();}
    else{session=stored();}
    if(session&&session.code&&(session.token||(session.role==="projector"&&session.pin))){app().innerHTML='<section class="panel"><h2>Spielverbindung wird wiederhergestellt</h2><p>Verbinde mit Supabase und lade den aktuellen Spielstand …</p><button class="btn alt" id="netLeave">Zur Startseite</button>'+msgBox();bindLeave();refresh(true);}
    else if(!dashboardRequested){clearSession();homepage();}
    setInterval(()=>{if(!session)return;refreshTimer();if(!isHost()&&!isProjector()&&room?.phase==="decision"&&secondsLeft()<=0&&get("netSave"))paintDecision();if(isHost()&&room?.phase==="decision"&&secondsLeft()<=0&&!working&&Date.now()-lastFinishAttempt>5000)finishSeason();},500);
    setInterval(()=>{if(session&&!polling&&!working)refresh(false);},1900);
  }
  document.addEventListener("DOMContentLoaded",start);
})();
