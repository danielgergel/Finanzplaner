/* ===== APP: Speicher, Sync, Oberfläche ===== */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const EUR=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"});
const EUR0=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fmt=x=>EUR.format(Math.round(x*100)/100+0), fmt0=x=>EUR0.format(Math.round(x)+0);
const sgn0=x=>(Math.round(x)>0?"+":Math.round(x)<0?"−":"")+EUR0.format(Math.abs(Math.round(x)));
const MON=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const mLabel=ym=>MON[+ym.slice(5,7)-1]+" "+ym.slice(0,4);
const dShort=d=>d.slice(8,10)+"."+d.slice(5,7)+".";
const hue=n=>parseInt(cyrb53(n),36)%360;
const dot=n=>`<i class="dot" style="background:${catColor(n)}"></i>`;

let S=null, META={theme:"auto",pass:null}, VER=1, saveT=null, pushT=null;
const ui={tab:"ov",month:todayStr().slice(0,7),openCat:null,allCats:false,sheet:null,det:{},imp:{acc:null,text:"",stage:"in",msg:""},ruleQ:"",avgN:3,acc:"all",pie:{mode:"out",more:false},add:null,sort:{mode:"out",skip:{},done:{out:0,in:0}},year:""};

/* ---------- Speicher: IndexedDB mit localStorage-Fallback ---------- */
let _db=null;
const idbOpen=()=>new Promise((res,rej)=>{try{const r=indexedDB.open("finanzplaner",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});
async function kvGet(k){
  try{_db=_db||await idbOpen();return await new Promise((res,rej)=>{const q=_db.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}
  catch(e){try{const v=localStorage.getItem("fp:"+k);return v?JSON.parse(v):undefined;}catch(e2){return undefined;}}
}
async function kvSet(k,v){
  try{_db=_db||await idbOpen();await new Promise((res,rej)=>{const t=_db.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});}
  catch(e){try{localStorage.setItem("fp:"+k,JSON.stringify(v));}catch(e2){toast("Speichern nicht möglich (Speicher voll?)");}}
}
function save(){clearTimeout(saveT);saveT=setTimeout(()=>kvSet("state",S),250);schedulePush();}
const saveMeta=()=>kvSet("meta",META);
function mutate(fn,cfg){fn();if(cfg)S.cfgTs=Date.now();VER++;save();render();}
const cmap=()=>catsOf(S,VER);
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),2600);}
function applyTheme(){const t=META.theme;if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;try{localStorage.setItem("fp-theme",t);}catch(e){}}

/* ---------- Hilfsfunktionen ---------- */
const accName=id=>{const a=S.accounts.find(x=>x.id===id);return a?a.name:"?";};
const nowYM=()=>todayStr().slice(0,7);
const hasDemo=()=>S.tx.some(t=>t.demo)||S.accounts.some(a=>a.demo);
function lastDataMonth(){let m="";for(const t of S.tx){const x=t.d.slice(0,7);if(x>m)m=x;}return m;}
function groupTx(list){
  const m=new Map();
  for(const t of list){const k=merchantKey(t);let g=m.get(k);if(!g){g={k,name:(t.p||t.t||k).slice(0,40),sum:0,tx:[]};m.set(k,g);}g.sum-=t.amt;g.tx.push(t);}
  return [...m.values()].sort((a,b)=>b.sum-a.sum);
}
function addRule(k,c,o){S.rules=S.rules.filter(r=>!(norm(r.k)===norm(k)&&!!r.in===!!(o&&o.in)));const r={k:k.trim(),c};if(o&&o.in)r.in=1;S.rules.unshift(r);}

/* ---------- Ansichten ---------- */
const VIEW={ov:vMonth,so:vSort,im:vImport,more:vSettings,avg:vAvg,goals:vGoals,year:vYear,abos:vAbos};
const dl2=d=>d.slice(8,10)+"."+d.slice(5,7)+"."+d.slice(2,4);
const unsList=()=>{const cm=cmap();return S.tx.filter(t=>cm.get(t.h)==null);};
function render(){
  document.querySelectorAll(".seg button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===ui.tab)));
  if(!S)return;
  if(materializeRecur(S,todayStr())){VER++;save();}
  const fab=$("#fab");if(fab)fab.hidden=!(ui.tab==="ov"&&!ui.wiz);
  const nU=unsList().length,sb=document.querySelector('.seg [data-tab="so"]');
  if(sb)sb.innerHTML="Sortieren"+(nU?`<i class="bdg" aria-label="${nU} offen">${nU>99?"99+":nU}</i>`:"");
  const demo=hasDemo()?`<div class="demo"><span><b>Demo-Daten</b> aktiv, nur zum Ausprobieren.</span><button class="btn s" data-a="demoDel">Demo löschen</button></div>`:"";
  $("#main").innerHTML=demo+VIEW[ui.tab]();
  const bn=$("#bnav"),show=ui.tab==="ov"&&S.tx.length>0;
  bn.hidden=!show;document.body.classList.toggle("hasnav",show);
  if(show)bn.innerHTML=`<div class="mnav"><button data-a="mprev" aria-label="Vormonat">◀</button><b>${mLabel(ui.month)}</b><button data-a="mnext" aria-label="Folgemonat">▶</button></div>`;
  renderSheet();
}
function emptyCard(){
  return `<div class="card"><p class="big">Noch keine Buchungen.</p><p class="muted">Lade als Erstes den CSV-Kontoauszug (oder eine PDF) einer Bank hoch. Danach siehst du hier sofort, wie du im Monat dastehst.</p>
  <button class="btn p w" data-a="tab" data-t="im">Kontoauszug importieren</button><button class="btn w" data-a="demo">Mit Beispieldaten ausprobieren</button></div>`;
}
const HINT=it=>{for(const c of it.cats)if(HINTS[c])return HINTS[c];return "Schau dir die größten Einzelbuchungen an und frage dich, was davon wirklich nötig war.";};
const AMPW={g:"grün",y:"gelb",r:"rot",n:"ohne Richtwert"};
function accStatus(ym){
  const cur=nowYM(),today=todayStr(),out={warn:[],all:[]},cov=coverage(S);
  for(const a of S.accounts){
    const e=cov[a.id];if(!e||a.virtual)continue;
    out.all.push(`${esc(a.name)}: Daten vom ${dl2(e.first)} bis ${dl2(e.last)} · ${e.complete.length} vollständige Monate`);
    if(ym>cur||e.complete.includes(ym))continue;
    if(ym===cur){ /* laufender Monat ist von Natur aus offen: nur warnen, wenn der Import veraltet ist */
      if(dayNum(today)-dayNum(e.last)>3)out.warn.push(`Konto ${esc(a.name)} endet am ${dl2(e.last)}, danach fehlen Buchungen – Zahlen unvollständig.`);
      continue;
    }
    out.warn.push(`Konto ${esc(a.name)} deckt diesen Monat nicht ab (Daten ${dl2(e.first)} bis ${dl2(e.last)}) – Zahlen unvollständig.`);
  }
  return out;
}
function vMonth(){
  if(!S.tx.length)return emptyCard();
  const cm=cmap(),ym=ui.month,SV=viewS(),ag=monthAgg(SV,ym,cm),today=todayStr(),cur=ym===today.slice(0,7),dim=daysIn(ym);
  const inc=effIncome(S,ym,cm,today),pd=projDay(ym,today,ag.last),canProj=cur&&pd>=8&&pd<dim;
  const noPlan=!S.budget.items.some(it=>it.plan>0)&&!S.fixed.length,neutral=inc.missing&&noPlan;
  const all=S.budget.items.map((it,i)=>{
    const ist=itemIst(it,ag),rf=refOf(S,it,inc.v);let am=ampel(S,it,ist,rf.ref);
    const fx=isFixItem(S,it),pr=projection(fx?Object.assign({},it,{fix:1}):it,ist,ym,today,ag.last);
    const warn=canProj&&!it.goal&&!fx&&rf.ref>0&&pr>rf.ref*1.1&&am!=="r";
    if(warn)am="y";
    return {it,i,ist,rf,am,pr,warn,q:rf.ref>0?ist/rf.ref:0};
  });
  const rows=all.filter(r=>r.rf.ref>0||Math.abs(r.ist)>0.005).sort((a,b)=>{const rk=r=>r.it.goal?3:r.am==="r"?0:r.am==="y"?1:2;return rk(a)-rk(b)||b.q-a.q||b.ist-a.ist;});
  /* Zusammenfassung */
  const spent=ag.fix+ag.var+ag.unsOut,left=ag.saldo;
  let projSpent=0;for(const r of all)if(groupOf(S,r.it.cats[0])!=="save")projSpent+=r.pr;projSpent+=canProj?ag.unsOut/pd*dim:ag.unsOut;
  let h=`<h2 class="mhead">${mLabel(ym)}${cur?` <small class="muted">· laufender Monat, Buchungen bis ${ag.last?dShort(ag.last):"–"}</small>`:(ym<today.slice(0,7)?` <small class="muted">· abgeschlossen</small>`:"")}</h2><p class="lead">Bisher <b>${fmt0(spent)}</b> ausgegeben${canProj?` · Prognose Monatsende <b>${fmt0(projSpent)}</b>`:""} · Einnahmen <b>${fmt0(ag.inc)}</b>${ag.other>0.5?` · weitere Eingänge ${fmt0(ag.other)}`:""} · übrig <b class="${left<0?"neg":"pos"}">${sgn0(left).replace("+","")}</b></p>`;
  h+=accFilterHtml();
  {const cp=commonPeriod(S);if(cp&&cp.lastMonth&&ym!==cp.lastMonth)h+=`<button class="linkline" data-a="monthCommon">Zum letzten vollständigen Monat (${mLabel(cp.lastMonth)}, alle Konten)</button>`;}
  if(ag.n)h+=donutCard(SV,cm,ym);
  const pv=monthAgg(SV,shiftYM(ym,-1),cm),subs=[];
  if(!inc.missing)subs.push(`Dein Gehalt: ${fmt0(inc.v)} (${esc(inc.src)})`);
  if(pv.n&&!coverageGaps(S,shiftYM(ym,-1)).length)subs.push(`Vormonat: ${fmt0(pv.fix+pv.var+pv.unsOut)} ausgegeben`);
  if(cur&&!canProj)subs.push("Prognose erst ab dem 8. des Monats");
  h+=`<p class="muted small">${subs.join(" · ")}</p>`;
  if(ag.n){const pT=ag.tx.filter(t=>t.amt>0),gh=pT.filter(t=>cm.get(t.h)===INCOME).reduce((s,t)=>s+t.amt,0);
    const parts=[];if(ag.sal>0.5)parts.push("Gehalt "+fmt0(ag.sal));if(ag.foe>0.5)parts.push("Förderung "+fmt0(ag.foe));if(ag.incOth>0.5)parts.push("Sonstiges "+fmt0(ag.incOth));
    h+=`<button class="linkline" data-a="einn">Einnahmen: ${fmt0(ag.inc)}${parts.length>1||ag.foe>0.5?" ("+parts.join(" · ")+")":""} aus ${ag.incTx.length} Buchungen${ag.other>0.5?" · Weitere Eingänge: "+fmt0(ag.other):""} – Tippen für Details</button><button class="linkline" data-a="tab" data-t="avg">Ø pro Monat und Fixkosten ansehen</button><button class="linkline" data-a="tab" data-t="year">Jahresrückblick</button>`;}
  if(!ag.n)h+=`<p class="empty">In diesem Monat gibt es keine Buchungen.</p>`;
  if(!S.budget.income&&!META.incSkip&&!S.tx.some(t=>cm.get(t.h)===INCOME)){
    const sc=detectSalary(S,cm);
    if(sc)h+=`<section class="card warnc"><p class="big">Ist das dein Gehalt?</p><p>${esc(sc.name)} · ca. <b>${fmt0(sc.amt)}</b> monatlich (${sc.months} Monate)</p><div class="row"><button class="btn p" data-a="salYes" data-k="${esc(sc.k)}">Ja</button><button class="btn" data-a="incSkip">Nein</button></div></section>`;
  }
  {const oc=detectOwnCandidate(S);if(oc)h+=`<section class="card warnc"><p class="big">Sind das deine eigenen Überweisungen?</p><p><b>${esc(oc.k)}</b> kommt ${oc.pos}× als Eingang und ${oc.neg}× als Ausgang vor. Überweisungen von und an dich selbst zählen dann weder als Einnahme noch als Ausgabe.</p><div class="row"><button class="btn p" data-a="ownYes" data-k="${esc(oc.k)}">Ja, das bin ich</button><button class="btn" data-a="ownNo" data-k="${esc(oc.k)}">Nein</button></div></section>`;}
  /* Gehalt erkennen */
  if(!S.budget.income&&!META.incSkip&&!S.tx.some(t=>cm.get(t.h)===INCOME)){
    const cands=S.tx.filter(t=>t.amt>0&&cm.get(t.h)!==TRANSFER&&cm.get(t.h)!==INCOME).sort((a,b)=>b.amt-a.amt).slice(0,5);
    if(cands.length)h+=`<section class="card warnc"><p class="big">Welche Buchung ist dein Gehalt?</p><p class="muted small">Tippe auf die richtige Zeile. Daraus entsteht eine Regel und dein Einkommen wird erkannt.</p>${cands.map(t=>`<button class="line" data-a="incPick" data-h="${esc(t.h)}"><span class="ln"><b>${esc((t.p||t.t).slice(0,34))}</b><small>${dShort(t.d)} · ${esc(accName(t.a))}</small></span><span class="num pos">${fmt(t.amt)}</span></button>`).join("")}<button class="btn s w" data-a="incSkip">Später</button></section>`;
  }
  /* Einrichtung */
  if(neutral)h+=`<section class="card warnc"><p class="big">Einrichtung starten</p><p class="muted small">Damit die Ampel für dich passt, brauchen wir dein Einkommen und deine festen Kosten. Dauert eine Minute und lässt sich überspringen. Bis dahin zeigt die App nur deine Ausgaben, ohne Bewertung.</p><button class="btn p w" data-a="wizOpen">Einrichtung starten</button></section>`;
  else if(inc.missing)h+=`<section class="card warnc"><p class="muted">Gib dein Einkommen ein, sonst sind die Vergleichswerte nicht sinnvoll.</p><button class="btn p w" data-a="wizOpen">Einkommen eingeben</button></section>`;
  if(!S.profile.legacy&&S.profile.setupDone){const rc=detectRecurring(S,cm)[0];if(rc)h+=`<section class="card"><p><b>Wiederkehrende Zahlung erkannt:</b> ${esc(rc.name)} ${rc.interval>1?fmt(rc.occ)+" alle "+rc.interval+" Monate ("+fmt(rc.amt)+" pro Monat)":fmt0(rc.amt)+" monatlich"}. Als feste Kosten übernehmen?</p><div class="row"><button class="btn s p" data-a="recAdd" data-k="${esc(rc.k)}">Übernehmen</button><button class="btn s" data-a="recNo" data-k="${esc(rc.k)}">Nein</button></div></section>`;}
  /* Alarm */
  const al=all.filter(r=>!r.it.goal&&(r.am==="r"||r.warn)).sort((a,b)=>((b.warn?b.pr:b.ist)-b.rf.ref)-((a.warn?a.pr:a.ist)-a.rf.ref)).slice(0,2);
  if(al.length)h+=`<section class="alarm bad" role="alert"><h2>Achtung</h2>${al.map(r=>`<p><b>${esc(r.it.n)}: ${r.warn?`Prognose ${fmt0(r.pr)} statt ${fmt0(r.rf.ref)}`:`${fmt0(r.ist)} statt ${fmt0(r.rf.ref)} – ${sgn0(r.ist-r.rf.ref)}`}</b><br><span>${esc(HINT(r.it))}</span></p>`).join("")}</section>`;
  else if(ag.n&&all.some(r=>r.rf.ref>0))h+=`<section class="alarm good"><p><b>Alles im Rahmen.</b> Keine Kategorie liegt über dem Richtwert.</p></section>`;
  h+=budgetHintHtml();
  h+=subsHint();
  if(!S.tx.some(t=>t.amt>0))h+=`<section class="card warnc" role="alert"><p class="big">Keine Eingänge gefunden.</p><p class="muted small">Prüfe, ob die Vorzeichen beim Import stimmen. Sonst fehlen dir die Einnahmen.</p><button class="btn p w" data-a="diag">Vorzeichen prüfen</button></section>`;
  /* Hinweise: unsortiert, Umbuchungen, Konten */
  const U=unsList(),uOut=U.filter(t=>t.amt<0).reduce((s,t)=>s-t.amt,0),uIn=U.filter(t=>t.amt>0).length;
  const st=accStatus(ym);let nt="";
  if(U.length)nt+=`<button class="line" data-a="tab" data-t="so"><span class="ln"><b>${U.length} Buchungen unsortiert${ag.unsOut?" ("+fmt0(ag.unsOut)+" in diesem Monat)":""}</b><small>${uIn?uIn+" Eingänge prüfen · ":""}Jetzt sortieren</small></span><span aria-hidden="true">›</span></button>`;
  if(ag.trans.length)nt+=`<button class="line" data-a="umb"><span class="ln"><b>Umbuchungen ignoriert: ${ag.trans.length} Buchungen, ${fmt0(ag.transSum)}</b><small>Übertrag zwischen eigenen Konten und Kreditkarte bezahlt, zählt nicht. Tippen zum Prüfen.</small></span><span aria-hidden="true">›</span></button>`;
  if(ag.ins.length)nt+=`<button class="line" data-a="incList"><span class="ln"><b>Weitere Eingänge (Rückzahlungen, Beiträge): ${ag.ins.length} Buchungen, ${fmt0(ag.insSum)}</b><small>Zählen nicht als Einnahmen, aber in Übrig. Tippen für Details oder um dein Gehalt zu wählen.</small></span><span aria-hidden="true">›</span></button>`;
  if(ag.pend&&ag.pend.length)nt+=`<div class="line static"><span class="ln"><b>${ag.pend.length} vorgemerkte Buchungen (${fmt0(ag.pend.reduce((s,t)=>s-t.amt,0))})</b><small>Noch nicht gebucht, zählen erst nach der Buchung. Sie stehen in den Kategorie-Details.</small></span></div>`;
  for(const w of st.warn)nt+=`<div class="line static warnt"><span class="ln"><b>⚠ ${w}</b></span></div>`;
  if(nt)h+=`<section class="card notes">${nt}</section>`;
  {const fxPlan=S.budget.items.filter(it=>isFixItem(S,it)&&!it.goal&&groupOf(S,it.cats[0])==="fix").reduce((s,it)=>s+(refOf(S,it,inc.v).plan||0),0);
   if(fxPlan>0||ag.fix>0)h+=`<section class="card notes"><button class="line" data-a="fixedOpen"><span class="ln"><b>Feste Kosten: Plan ${fmt0(fxPlan)} · bisher ${fmt0(ag.fix)}</b><small>Tippen zum Bearbeiten (Mehr, Feste Kosten)</small></span><span aria-hidden="true">›</span></button></section>`;}
  /* Saldo ehrlich aufteilen */
  if(ag.n){
    h+=`<section class="card"><h2 class="sec">So verteilt sich dein Geld</h2>
    <div class="kv"><span>Einnahmen (Gehalt u. a.)</span><b class="num pos">${fmt0(ag.inc)}</b></div>${ag.other>0.5?`<button class="kv klink" data-a="incList"><span>Weitere Eingänge (Rückzahlungen, Beiträge)</span><b class="num">+ ${fmt0(ag.other)}</b></button>`:""}
    <div class="kv"><span>Fixkosten</span><b class="num">− ${fmt0(ag.fix)}</b></div>
    <div class="kv"><span>Variable Ausgaben</span><b class="num">− ${fmt0(ag.var)}</b></div>${ag.tradeOut?`<div class="kv warnrow"><span>davon Trading-Kosten</span><b class="num warnt">− ${fmt0(ag.tradeOut)}</b></div>`:""}
    <div class="kv"><span>Sparen / Anlegen (Sparen, Rücklagen)</span><b class="num">− ${fmt0(ag.save)}</b></div>
    ${ag.unsOut?`<button class="kv klink" data-a="tab" data-t="so"><span>Unsortiert</span><b class="num">− ${fmt0(ag.unsOut)}</b></button>`:""}
    <div class="kv tot"><span>Übrig</span><b class="num ${left<0?"neg":"pos"}">${sgn0(left).replace("+","")}</b></div>
    </section>`;
  }
  /* Sparziele und Ampel-Liste */
  h+=goalsCard();
  const shown=ui.allCats?rows:rows.slice(0,5);
  if(rows.length){
    h+=`<h2 class="sec">Kategorien: Ist / Richtwert</h2>`;
    for(const r of shown){
      const o=r.rf.src==="Plan"?(r.rf.de!=null?"Durchschnitt DE "+fmt0(r.rf.de):""):(r.rf.plan!=null?"Plan "+fmt0(r.rf.plan):"");
      h+=`<button class="brow" data-a="catd" data-i="${r.i}" aria-label="${esc(r.it.n)}, ${AMPW[r.am]}, Details öffnen"><div class="bt"><span class="amp ${r.am}"></span><i class="dot" style="background:${catColor(r.it.cats[0])}"></i><b>${r.am==="r"&&!r.it.goal?"⚠ ":""}${esc(r.it.n)}</b><span class="num">${fmt0(r.ist)} <small>/ ${r.rf.ref>0?fmt0(r.rf.ref):"–"} · ${r.rf.ref>0?Math.round(r.q*100)+" %":"kein Richtwert"}</small></span></div>
      <div class="bm">${r.rf.std?`<span class="std">Standardwert (Durchschnitt DE)</span>`:""}${r.warn?`<span class="warnt">Prognose ${fmt0(r.pr)}</span>`:""}${o?`<span class="faint">${o}</span>`:""}</div>${r.it.note?`<div class="note">${esc(r.it.note)}</div>`:""}</button>`;
    }
    if(rows.length>5)h+=`<button class="btn w" data-a="allCats">${ui.allCats?"Nur die ersten 5 zeigen":"Alle "+rows.length+" Kategorien anzeigen"}</button>`;
    h+=`<p class="muted small">Grün: unter 90 % des Richtwerts · Gelb: 90 % bis zum Richtwert oder Prognose über 110 % · Rot: über dem Richtwert. Richtwert = dein Plan, sonst Durchschnitt Deutschland (grobe Orientierung). Anpassen unter Mehr.</p>`;
  }
  const kn=S.accounts.length;
  return h+`<details class="dt card" data-id="accs" ${ui.det.accs?"open":""}><summary>Konten-Stand</summary><div class="dbody">${st.all.length?st.all.map(x=>`<p class="small">${x}</p>`).join(""):`<p class="small muted">Noch kein Konto importiert.</p>`}</div></details>`;
}
/* ---------- Ø pro Monat (nur vollständige Monate je Konto) ---------- */
function avgDonut(R){
  const D=incomeSplit(R);if(!D.total)return "";
  const Rr=54,CI=2*Math.PI*Rr;let off=0;
  const circ=D.segs.map(s=>{const len=s.amt/D.total*CI,e=`<circle cx="80" cy="80" r="${Rr}" fill="none" stroke="${s.color}" stroke-width="24" stroke-dasharray="${len.toFixed(2)} ${(CI-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 80 80)"/>`;off+=len;return e;}).join("");
  const aria=D.segs.map(s=>s.label+" "+fmt0(s.amt)+", "+pctTxt(s.pct)).join("; ");
  return `<svg viewBox="0 0 160 160" class="donut small" role="img" aria-label="Aufteilung ${D.over?"der Ausgaben, sie liegen über dem Einkommen":"des Einkommens"} pro Monat: ${esc(aria)}">${circ}<text x="80" y="80" text-anchor="middle" class="dtot sm">${fmt0(D.over?D.total:R.inc)}</text><text x="80" y="98" text-anchor="middle" class="dlab">${D.over?"Ausgaben":"Einkommen"}</text></svg><ul class="plist">${D.segs.map(s=>`<li><div class="lrow"><i class="dot" style="background:${s.color}"></i><span class="pn">${esc(s.label)}</span><span class="num">${fmt0(s.amt)}</span><span class="pp num">${pctTxt(s.pct)}</span></div></li>`).join("")}</ul>${D.over?`<p class="warnt">⚠ Die Ausgaben liegen im Schnitt über dem Einkommen.</p>`:""}`;
}
function vAvg(){
  const cm=cmap(),N=ui.avgN,R=avgReport(S,cm,N),few=n=>n<3?` <span class="warnt">wenig Daten</span>`:"";
  const ab=n=>`<small class="faint">Ø aus ${n} ${n===1?"Monat":"Monaten"}</small>${few(n)}`;
  let h=`<button class="btn s" data-a="tab" data-t="ov">‹ Zurück zur Monatsansicht</button><h2 class="sec">Ø pro Monat</h2>
  <p class="muted small">Gerechnet wird pro Kalendermonat und je Konto nur mit vollständigen Monaten (liegt der Monat komplett im Zeitraum, den du importiert hast). Angebrochene Monate am Anfang und Ende zählen nicht.</p>
  <div class="chips" role="group" aria-label="Zeitraum">${[[3,"Letzte 3"],[6,"Letzte 6"],[12,"Letzte 12"],[0,"Alle vollständigen"]].map(([n,l])=>`<button data-a="avgN" data-n="${n}" aria-pressed="${N===n}">${l}</button>`).join("")}</div>`;
  if(!R.accs.length)return h+`<div class="card"><p class="big">Noch kein vollständiger Monat.</p><p class="muted">Importiere einen Zeitraum, der mindestens einen ganzen Kalendermonat umfasst (vom 1. bis zum Monatsletzten).</p><button class="btn p w" data-a="tab" data-t="im">Zum Import</button></div>`;
  const line=(l,v,n,cls)=>`<div class="kv"><span>${l}<br>${ab(n)}</span><b class="num ${cls||""}">${fmt0(v)}</b></div>`;
  h+=`<section class="card"><h2 class="sec">Pro Monat im Schnitt</h2>${avgDonut(R)}${line("Einnahmen pro Monat (Gehalt u. a.)",R.inc,R.incN||R.nMin,"pos")}${R.other>0.5?line("Weitere Eingänge (Rückzahlungen, Beiträge)",R.other,R.nMin):""}${line("Fixkosten pro Monat",R.fix,R.nMin)}${line("Variabel pro Monat",R.var,R.nMin)}${R.tradeCost>0.5?`<div class="kv warnrow"><span>davon Trading-Kosten</span><b class="num warnt">${fmt0(R.tradeCost)}</b></div>`:""}${line("Sparen / Anlegen pro Monat",R.save,R.nMin)}${R.uns?line("Unsortiert pro Monat",R.uns,R.nMin):""}<div class="kv tot"><span>Übrig pro Monat</span><b class="num ${R.left<0?"neg":"pos"}">${R.left<0?"−":""}${fmt0(Math.abs(R.left))}</b></div>${R.moved>0.5?`<p class="muted small">Auf andere eigene Konten verschoben: ${fmt0(R.moved)} pro Monat. Das zählt nicht als Ausgabe; dort liegen z. B. Versicherungen oder andere Fixkosten.</p>`:""}</section>`;
  const rowHtml=r=>{
    const it=S.budget.items.find(i=>i.cats.includes(r.cat)),pl=r.group==="fix"&&it?refOf(S,it,0).plan:null;
    let sub=ab(r.n);
    if(pl>0)sub+=` <small class="${Math.abs(pl-r.val)>Math.max(5,pl*0.1)?"warnt":"faint"}">· Plan ${fmt0(pl)} · real ${fmt0(r.val)}</small>`;
    if(r.group==="fix"&&r.posts.length>1)sub+=`<br><small class="faint">${r.posts.map(p=>esc(p.name)+" "+fmt0(p.amt)).join(" · ")}</small>`;
    return `<div class="kv"><span>${esc(r.cat==="(unsortiert)"?"Unsortiert":catLabel(r.cat))}<br>${sub}</span><b class="num ${r.cat==="Trading"?"warnt":""}">${fmt0(r.val)}</b></div>`;
  };
  for(const [g,t] of [["fix","Fixkosten pro Monat"],["var","Variable Ausgaben pro Monat"],["save","Sparen / Anlegen pro Monat"]]){
    const rs=R.rows.filter(r=>r.group===g);if(rs.length)h+=`<section class="card"><h2 class="sec">${t}</h2>${rs.map(rowHtml).join("")}</section>`;
  }
  const rc=detectRecurring(S,cm);
  h+=`<section class="card"><h2 class="sec">Fixkosten automatisch erkannt</h2><p class="muted small">Zahlungen, die fast jeden Monat in ähnlicher Höhe (±10 %) vorkommen, oder regelmäßig alle 3, 6 oder 12 Monate (dann auf den Monat umgelegt). Nur ein Vorschlag, du bestätigst.</p>`+
    (rc.length?rc.map(r=>`<div class="erow"><span class="rk">${esc(r.name)}<br><small class="faint">${r.interval>1?fmt(r.occ)+" alle "+r.interval+" Monate = "+fmt(r.amt)+" pro Monat":fmt0(r.amt)+" monatlich"} · ${r.months} Monate</small></span><button class="btn s p" data-a="recAdd" data-k="${esc(r.k)}">Übernehmen</button><button class="btn s" data-a="recNo" data-k="${esc(r.k)}" aria-label="Nein, ${esc(r.name)} nicht übernehmen">Nein</button></div>`).join("")+`<div class="kv tot"><span>Erkannt, pro Monat</span><b class="num">${fmt0(rc.reduce((s,r)=>s+r.amt,0))}</b></div>`:`<p class="muted small">Keine wiederkehrenden Zahlungen gefunden oder alle schon übernommen.</p>`)+`</section>`;
  h+=`<section class="card"><h2 class="sec">Abdeckung je Konto</h2>${R.accs.map(a=>`<div class="kv small"><span>${esc(a.name)}<br><small class="faint">Daten ${dl2(a.first)} bis ${dl2(a.last)}</small></span><b class="num">${a.n} Monate</b></div>`).join("")}</section>`;
  return h;
}

/* ---------- Sortieren (geführt) ---------- */
function sortLists(){
  const U=unsList();
  const out=groupTx(U.filter(t=>t.amt<0));
  const inn=groupTx(U.filter(t=>t.amt>0)).map(g=>Object.assign(g,{sum:-g.sum})).sort((a,b)=>b.sum-a.sum);
  return {out,inn};
}
function vSort(){
  const SO=ui.sort,L=sortLists(),U=unsList();
  if(!S.tx.length)return emptyCard();
  if(!U.length)return `<div class="card"><p class="big">Alles sortiert.</p><p class="muted">Es gibt keine unsortierten Buchungen mehr.</p><button class="btn p w" data-a="tab" data-t="ov">Zur Monatsansicht</button></div>`;
  const mode=SO.mode,list=mode==="in"?L.inn:L.out,rest=list.filter(g=>!SO.skip[mode+g.k]),cur=rest[0],skipped=list.length-rest.length;
  let h=`<div class="chips" role="group" aria-label="Liste wählen"><button data-a="sortMode" data-m="out" aria-pressed="${mode==="out"}">Ausgaben (${L.out.length})</button><button data-a="sortMode" data-m="in" aria-pressed="${mode==="in"}">Eingänge prüfen (${L.inn.length})</button></div>`;
  if(!list.length)return h+`<div class="card"><p class="big">${mode==="in"?"Keine Eingänge offen.":"Keine Ausgaben offen."}</p><button class="btn w" data-a="sortMode" data-m="${mode==="in"?"out":"in"}">Zur anderen Liste</button></div>`;
  const done=SO.done[mode],total=done+list.length;
  h+=`<p class="muted small" aria-live="polite">${cur?`Händler ${done+1} von ${total}`:`${done} von ${total} erledigt`}</p><div class="bar b2"><s class="g" style="width:${Math.round(done/Math.max(1,total)*100)}%"></s></div>`;
  if(!cur)return h+`<div class="card"><p class="big">Rest später.</p><p class="muted">${skipped} Händler hast du übersprungen.</p><button class="btn p w" data-a="sortReset">Übersprungene jetzt zeigen</button></div>`;
  const g=cur,cats=mode==="in"?[INCOME,TRANSFER,"Trading",...S.cats.filter(c=>![INCOME,TRANSFER,"Trading"].includes(c))]:[...S.cats.filter(c=>c!==INCOME&&c!==TRANSFER),TRANSFER];
  h+=`<div class="card"><p class="big">${esc(g.name)}</p><p class="muted small">${g.tx.length} ${g.tx.length===1?"Buchung":"Buchungen"} · ${fmt(Math.abs(g.sum))}${mode==="in"?" Eingang":""}</p>
  ${g.tx.slice(0,3).map(t=>`<div class="tl static"><span class="td">${dShort(t.d)}</span><span class="tt">${esc((t.t||t.p).slice(0,60))}</span><span class="num ${t.amt>0?"pos":""}">${fmt(t.amt)}</span>${flipBtn(t)}</div>`).join("")}
  ${g.tx.length>3?`<p class="muted small">… und ${g.tx.length-3} weitere</p>`:""}
  <div class="cgrid">${cats.map(c=>`<button data-a="sortCat" data-k="${esc(g.k)}" data-c="${esc(c)}">${dot(c)}${esc(catLabel(c))}</button>`).join("")}</div>
  <label class="fld">Regel für künftige Buchungen (Stichwort)<input id="alwk" value="${esc(g.k)}" aria-label="Stichwort der Regel"></label>
  <p class="muted small">Ein Tipp auf die Kategorie ordnet alle ${g.tx.length} Buchungen zu und merkt sich das Stichwort für die Zukunft.</p>
  <button class="btn w" data-a="sortSkip" data-k="${esc(g.k)}">Später</button></div>`;
  return h;
}
/* ---------- Bottom-Sheets ---------- */
const flipBtn=t=>t.rec?"":`<button class="fl" data-a="flip" data-h="${esc(t.h)}" aria-label="Plus/Minus umdrehen" title="Plus/Minus umdrehen">±</button>`;
function flipBlock(t){
  if(t.rec)return `<p class="muted small">Dauerposten: Betrag und Art unter Mehr, Dauerposten ändern.</p>`;
  const gl=flipGroup(S,t);
  return `<div class="row"><button class="btn s p" data-a="flip" data-h="${esc(t.h)}">± Plus/Minus umdrehen</button>${gl.length>1?`<button class="btn s" data-a="flipGrp" data-h="${esc(t.h)}">Alle Buchungen dieses Händlers umdrehen (${gl.length})</button>`:""}</div>${t.fl?`<p class="muted small">Vorzeichen manuell umgedreht (Original ${fmt(t.oa)}). Nochmal tippen stellt es wieder her.</p>`:""}`;
}
function txRow(t){return `<div class="tlw"><button class="tl" data-a="tx" data-h="${esc(t.h)}"><span class="td">${dShort(t.d)}</span><span class="tt">${t.man?(t.rec?"⟳ ":"✎ "):""}${esc((t.man?(t.p||t.t):(t.t||t.p)).slice(0,50))} <small class="faint">· ${esc(accName(t.a))}</small></span>${t.fl?`<small class="warnt">±</small> `:""}<span class="num ${t.amt>0?"pos":""}">${fmt(t.amt)}</span></button>${flipBtn(t)}</div>`;}
function renderSheet(){
  const el=$("#sheet"),sh=ui.sheet;
  const hide=()=>{ui.sheet=null;el.innerHTML="";el.classList.remove("on");};
  if(!sh){hide();return;}
  let inner="";const cm=cmap();
  if(sh.t==="imp"){
    inner=`<p class="big">Import fertig</p><p><b>${sh.n}</b> neu${sh.dup?` · ${sh.dup} Duplikate übersprungen`:""}${sh.up?` · ${sh.up} vorhandene Buchungen mit genaueren Daten aktualisiert (z. B. PDF durch CSV)`:""}${sh.pend?` · ${sh.pend} vorgemerkt (zählen erst, wenn gebucht)`:""} · <b>${sh.uns}</b> noch zu sortieren</p>
    <div class="row">${sh.uns?`<button class="btn p" data-a="impGo" data-t="so">Als Nächstes: Sortieren</button><button class="btn" data-a="impGo" data-t="ov">Zur Monatsansicht</button>`:`<button class="btn p" data-a="impGo" data-t="ov">Zur Monatsansicht</button>`}</div>`;
  }else if(sh.t==="catdet"){
    const it=S.budget.items[sh.i],ag=monthAgg(viewS(),ui.month,cm);
    const tx=it?it.cats.flatMap(c=>ag.byCat[c]?ag.byCat[c].tx:[]):[];
    const out=tx.filter(t=>t.amt<0),st=listStats(out),inn=tx.filter(t=>t.amt>0),xd=crossDups(out);
    const pc=pendCats(),pend=(ag.pend||[]).filter(p=>it&&it.cats.includes(pc.get(p.h)));
    const row=t=>`<div class="tlw"><button class="tl" data-a="${t.pv?"sheetClose":"tx"}" data-h="${esc(t.h)}"><span class="td">${dShort(t.d)}</span><span class="tt">${t.man?(t.rec?"⟳ ":"✎ "):""}${esc((t.p||t.t||"").slice(0,34))} <small class="faint">· ${esc(accName(t.a))} · ${STATUS(t)}</small></span><span class="num ${t.amt>0?"pos":""}">${fmt(t.amt)}</span></button>${t.pv?"":flipBtn(t)}</div>`;
    inner=`<p class="big">${esc(it?it.n:"")}: ${fmt(st.sum)}</p><p class="muted small">${mLabel(ui.month)} · ${it&&it.note?esc(it.note)+" · ":""}Falsch einsortiert? Tippe die Buchung an und ändere die Kategorie.</p>
      <div class="kv small"><span>Anzahl Ausgaben</span><b class="num">${st.n}</b></div>${st.n?`<div class="kv small"><span>Kleinster / größter Betrag</span><b class="num">${fmt(st.min)} / ${fmt(st.max)}</b></div><div class="kv small"><span>Durchschnitt je Buchung</span><b class="num">${fmt(st.sum/st.n)}</b></div>`:""}
      ${Object.keys(st.byAcc).length?`<div class="kv small"><span>Nach Konto</span><b class="num small">${Object.entries(st.byAcc).map(([a,e])=>esc(accName(a))+": "+e.n+"× "+fmt0(e.sum)).join(" · ")}</b></div>`:""}
      ${xd.length?`<p class="warnt small" role="alert">⚠ ${xd.length}× gleicher Betrag in zwei Konten innerhalb von 3 Tagen – evtl. dieselbe Zahlung doppelt importiert. Mehr, „Duplikate prüfen und bereinigen“.</p>`:""}
      ${inn.length?`<p class="muted small">Dazu ${inn.length} Gutschrift(en) über ${fmt(inn.reduce((s,t)=>s+t.amt,0))} (zählen unter Weitere Eingänge, nicht gegen die Ausgaben gerechnet).</p>`:""}
      <h3 class="sec">Buchungen nach Händler (Datum · Konto · Status)</h3>`+
      groupTx(tx).map(g=>`<div class="gh"><b>${esc(g.name)}</b><span class="num">${g.tx.length}× · ${fmt(g.sum)}</span></div>${g.tx.sort((a,b)=>a.d<b.d?1:-1).map(row).join("")}`).join("")+
      (pend.length?`<h3 class="sec">Vorgemerkt (zählt noch nicht): ${fmt(pend.reduce((s,t)=>s-t.amt,0))}</h3><p class="muted small">Noch nicht gebucht, z. B. Reservierung an der Zapfsäule. Mit dem nächsten Import wird daraus die echte Buchung.</p>`+pend.map(row).join(""):"")+
      `<button class="btn w" data-a="csvCat" data-i="${sh.i}">CSV für ${ui.month.slice(0,4)} (z. B. Steuer)</button><button class="btn w" data-a="sheetClose">Schließen</button>`;
  }else if(sh.t==="add"){
    if(!ui.add)ui.add=newAdd();inner=addHtml();
  }else if(sh.t==="seg"){
    const SVv=viewS(),r=segTx(SVv,ui.month,cm,sh.mode,sh.key);
    if(!r.seg){hide();return;}
    inner=`<p class="big"><i class="dot" style="background:${r.seg.color}"></i>${esc(segLabel(sh.mode,sh.key))}</p><p class="muted small">${fmt0(r.seg.amt)} · ${pctTxt(r.seg.pct)} von ${fmt0(r.D.total)} · ${mLabel(ui.month)}. Falsch einsortiert? Buchung antippen und Kategorie ändern.</p>${r.list.map(txRow).join("")}<button class="btn w" data-a="sheetClose">Schließen</button>`;
  }else if(sh.t==="einn"){
    const ag=monthAgg(viewS(),ui.month,cm),pos=ag.incTx.slice().sort((a,b)=>b.amt-a.amt),sum=pos.reduce((s,t)=>s+t.amt,0);
    const ex=ag.trans.filter(t=>t.amt>0).sort((a,b)=>b.amt-a.amt),bd=boundaryIncome(S,ui.month,cm);
    const shifted=S.tx.filter(t=>t.mo===ui.month&&t.d.slice(0,7)!==ui.month&&t.amt>0);
    const byA={};for(const t of pos)byA[t.a]=(byA[t.a]||0)+t.amt;
    const cn=t=>cm.get(t.h);
    /* v12: Aufschluesselung nach Art und Quelle (Absender, Konto, Anzahl) */
    const grp=(list,kf)=>{const m=new Map();for(const t of list){const k=kf(t),src=(t.p||t.t||"?").slice(0,30),key=k+"|"+norm(src).slice(0,20);const e=m.get(key)||m.set(key,{k,src,sum:0,n:0,accs:new Set()}).get(key);e.sum+=t.amt;e.n++;e.accs.add(accName(t.a));}return [...m.values()].sort((a,b)=>b.sum-a.sum);};
    const srcRow=e=>`<div class="kv small"><span>${esc(e.src)}<br><small class="faint">${e.n} ${e.n===1?"Buchung":"Buchungen"} · ${esc([...e.accs].join(", "))}${e.accs.size>1?` <span class="warnt">· in ${e.accs.size} Konten: evtl. doppelt importiert?</span>`:""}</small></span><b class="num pos">${fmt(e.sum)}</b></div>`;
    const kinds=["sal","foe","oth"].map(k=>({k,list:grp(pos.filter(t=>incKind(t)===k),()=>k)})).filter(x=>x.list.length);
    const ss=salaryStats(S,cm,ui.month),tw=(ss&&ss.twins||[]).filter(p=>mkey(p[1])===ui.month),eff=effIncome(S,ui.month,cm);
    const xd=crossDups(pos);
    const statH=ss?`<h3 class="sec">Dein Gehalt im Vergleich</h3><p class="muted small">Gehalt je Monat (nur Lohn/Gehalt, ohne Förderung): ${ss.months.slice(-6).map(o=>MON[+o.m.slice(5,7)-1].slice(0,3)+" "+fmt0(o.v)+(ss.bonus.includes(o.m)?" (Sonderzahlung?)":"")).join(" · ")}. Typisch (Median): <b>${fmt0(ss.med)}</b>, Spanne ${fmt0(ss.min)} bis ${fmt0(ss.max)}.</p><p class="muted small">Für die Richtwerte rechnet die App mit <b>${fmt0(eff.v)}</b> (${esc(eff.src)}).</p>${[S.budget.planIncome,S.profile.income].filter(v=>v>0&&Math.abs(v-eff.v)>50).slice(0,1).map(v=>`<button class="btn s w" data-a="useIncome" data-v="${v}">Stattdessen mit ${fmt0(v)} rechnen (dein Plan)</button>`).join("")}`:"";
    inner=`<p class="big">Einnahmen ${mLabel(ui.month)}: ${fmt(sum)}</p><p class="muted small">Einnahmen sind nur Gehalt und ähnliches Einkommen (Kategorie Einkommen), ${pos.length} Buchungen. Alle anderen Eingänge stehen unter Weitere Eingänge und zählen nicht als Einnahmen.</p>`+
      kinds.map(x=>`<h3 class="sec">${esc(INC_KIND_LABEL[x.k])}: ${fmt(x.list.reduce((s,e)=>s+e.sum,0))}</h3>`+x.list.map(srcRow).join("")).join("")+
      (tw.length||xd.length?`<p class="warnt small" role="alert">⚠ ${tw.length+xd.length} Eingang/Eingänge mit gleichem Betrag in zwei Konten innerhalb von 3 Tagen. Wahrscheinlich dieselbe Zahlung doppelt importiert (z. B. PDF in ein anderes Konto). Mehr, „Duplikate prüfen und bereinigen“.</p>`:"")+statH+
      `<h3 class="sec">Alle Buchungen</h3>`+
      (pos.length?pos.map(t=>`<div class="tlw"><button class="tl" data-a="tx" data-h="${esc(t.h)}"><span class="td">${dShort(t.d)}</span><span class="tt">${t.man?(t.rec?"⟳ ":"✎ "):""}${esc(accName(t.a))} · ${esc((t.p||t.t).slice(0,26))} <small class="faint">· ${esc(cn(t)==null?"unsortiert":catLabel(cn(t)))}${t.mo&&t.mo!==t.d.slice(0,7)?" · gebucht "+dShort(t.d):""}</small></span><span class="num pos">${fmt(t.amt)}</span></button>${flipBtn(t)}</div>`).join(""):`<p class="muted">Keine Eingänge in diesem Monat.</p>`)+
      `<div class="kv tot"><span>Summe</span><b class="num pos">${fmt(sum)}</b></div>`+
      `<h3 class="sec">Nach Konto</h3>`+S.accounts.filter(a=>S.tx.some(t=>t.a===a.id)).map(a=>`<div class="kv small"><span>${esc(a.name)}</span><b class="num">${byA[a.id]?fmt0(byA[a.id]):"keine Eingänge"}</b></div>`).join("")+
      `<h3 class="sec">Weitere Eingänge (${ag.ins.length}, ${fmt0(ag.insSum)}) nach Quelle</h3><p class="muted small">Rückzahlungen, Beiträge, Erstattungen. Zählen nicht als Einnahmen, aber in Übrig.</p>`+(ag.ins.length?grp(ag.ins,()=>"w").map(srcRow).join("")+ag.ins.slice().sort((a,b)=>b.amt-a.amt).map(txRow).join(""):`<p class="muted small">Keine.</p>`)+`<h3 class="sec">Nicht mitgezählt (${ex.length})</h3>`+
      (ex.length?ex.map(t=>`<div class="erow"><span class="rk">${dShort(t.d)} · ${esc(accName(t.a))} · ${esc((t.p||t.t).slice(0,24))}<br><small class="warnt">${isCardPay(t)?"Kreditkarte bezahlt":"Umbuchung zwischen eigenen Konten"}</small></span><b class="num">${fmt(t.amt)}</b><button class="btn s" data-a="cntInc" data-h="${esc(t.h)}">Doch als Einnahme zählen</button></div>`).join(""):`<p class="muted small">Keine positiven Buchungen ausgeschlossen. (Beim Import als Duplikat übersprungene Buchungen werden nicht gespeichert.)</p>`)+
      ((bd.length||shifted.length)?`<h3 class="sec">Gehalt zum Monatswechsel</h3><p class="muted small">Diese Gehälter wurden kurz vor Monatsende oder zu Monatsbeginn gebucht und stehen deshalb im Nachbarmonat.</p>`+bd.map(t=>`<div class="erow"><span class="rk">${dShort(t.d)} · ${esc(accName(t.a))} · ${esc((t.p||t.t).slice(0,24))}</span><b class="num">${fmt(t.amt)}</b><button class="btn s" data-a="moHere" data-h="${esc(t.h)}">In ${MON[+ui.month.slice(5,7)-1]} zählen</button></div>`).join("")+shifted.map(t=>`<div class="erow"><span class="rk">${dShort(t.d)} · ${esc((t.p||t.t).slice(0,24))} (hierher verschoben)</span><b class="num">${fmt(t.amt)}</b><button class="btn s" data-a="moReset" data-h="${esc(t.h)}">Zurück</button></div>`).join(""):"")+
      `<button class="btn w" data-a="sheetClose">Schließen</button>`;
  }else if(sh.t==="inc"){
    const ag=monthAgg(viewS(),ui.month,cm),list=ag.ins.slice().sort((a,b)=>b.amt-a.amt);
    if(!list.length){hide();return;}
    inner=`<p class="big">Weitere Eingänge</p><p class="muted small">${mLabel(ui.month)}: Rückzahlungen, Beiträge und andere Eingänge. Sie zählen nicht als Einnahmen, aber in Übrig. Ist dein Gehalt dabei, tippe darauf: dann merkt sich die App die Regel und kennt dein Einkommen.</p>`+
      list.map(t=>`<div class="erow"><button class="line" data-a="incPick" data-h="${esc(t.h)}" aria-label="Das ist mein Gehalt: ${esc((t.p||t.t).slice(0,30))}"><span class="ln"><b>${esc((t.p||t.t).slice(0,34))}</b><small>${dShort(t.d)} · ${esc(accName(t.a))} · Das ist mein Gehalt</small></span><span class="num pos">${fmt(t.amt)}</span></button><button class="btn s" data-a="tx" data-h="${esc(t.h)}" aria-label="Details">…</button>${flipBtn(t)}</div>`).join("")+
      `<button class="btn w" data-a="sheetClose">Schließen</button>`;
  }else if(sh.t==="umb"){
    const ag=monthAgg(viewS(),ui.month,cm);
    inner=`<p class="big">Umbuchungen (zählen nicht)</p><p class="muted small">${mLabel(ui.month)}: Übertrag zwischen eigenen Konten und Kreditkartenzahlungen. Sie zählen weder als Ausgabe noch als Einnahme, damit nichts doppelt gezählt wird. Tippe auf eine Buchung, um sie zurückzuholen.</p>`+
      ag.trans.sort((a,b)=>a.d<b.d?1:-1).map(t=>`<div class="tlw"><button class="tl" data-a="tx" data-h="${esc(t.h)}"><span class="td">${dShort(t.d)}</span><span class="tt">${isCardPay(t)?"Kreditkarte bezahlt · ":"Umbuchung · "}${esc(accName(t.a))} · ${esc((t.t||t.p).slice(0,40))}</span><span class="num">${fmt(t.amt)}</span></button>${flipBtn(t)}</div>`).join("")+
      `<button class="btn w" data-a="sheetClose">Schließen</button>`;
  }else{
    const txs=(sh.hs||[]).map(h=>S.tx.find(t=>t.h===h)).filter(Boolean);
    if(!txs.length){hide();return;}
    const t=txs[0],cur=cm.get(t.h),kw=merchantKey(t);
    inner=`<p class="big">${esc((t.p||t.t||"").slice(0,50))}</p>
   <p class="muted small">${txs.length>1?txs.length+" Buchungen · Summe "+fmt(txs.reduce((s,x)=>s+x.amt,0)):dShort(t.d)+" · "+fmt(t.amt)+" · "+esc(accName(t.a))}<br>${esc((t.t||"").slice(0,120))}</p>
   ${flipBlock(t)}
   ${cur===TRANSFER?`<p class="status">${isCardPay(t)?"Kreditkarte bezahlt: zählt nicht als Ausgabe, die Einkäufe stehen auf der Kreditkarte. So wird nichts doppelt gezählt.":"Umbuchung zwischen eigenen Konten: zählt weder als Ausgabe noch als Einnahme."}</p><button class="btn s w" data-a="txNt" data-h="${esc(t.h)}">Als normale Buchung behandeln</button>`:(t.nt?`<button class="btn s w" data-a="txNt" data-h="${esc(t.h)}">Wieder automatisch als Umbuchung erkennen</button>`:"")}
   ${t.man?`<div class="row"><button class="btn s p" data-a="${t.rec?"recEdit":"manEdit"}" data-h="${esc(t.h)}" data-id="${esc(t.rec||"")}">${t.rec?"Dauerposten bearbeiten":"✎ Bearbeiten"}</button></div>`:""}
   <p class="muted small">Falsch einsortiert? Wähle unten die richtige Kategorie.</p>
   <div class="cgrid">${S.cats.map(c=>`<button class="${c===cur?"on":""}" data-a="setcat" data-c="${esc(c)}">${dot(c)}${esc(catLabel(c))}</button>`).join("")}</div>
   <label class="chk"><input type="checkbox" id="alw" ${sh.always===false?"":"checked"}> Für diesen Händler immer</label>
   <input id="alwk" value="${esc(kw)}" aria-label="Schlüsselwort für die Regel">
   <div class="row">${txs.length===1?`<button class="btn s dang" data-a="txDel" data-h="${esc(t.h)}">Buchung löschen</button>`:""}${txs.some(x=>x.c)?`<button class="btn s" data-a="setcat" data-c="">Automatisch</button>`:""}<button class="btn s" data-a="sheetClose">Schließen</button></div>`;
  }
  el.classList.add("on");
  el.innerHTML=`<div class="scrim" data-a="sheetClose"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Details"><div class="grab"></div>${inner}</div>`;
}

function vImport(){
  const I=ui.imp;if(!I.acc||!S.accounts.some(a=>a.id===I.acc))I.acc=S.accounts[0]&&S.accounts[0].id;
  let h=`<h2 class="sec">Konto wählen</h2><div class="chips wrapc">${S.accounts.filter(a=>!a.virtual).map(a=>`<button data-a="impAcc" data-id="${esc(a.id)}" aria-pressed="${a.id===I.acc}">${esc(a.name)}</button>`).join("")}</div>`;
  {const ld=lastDate(S,I.acc);h+=`<p class="muted small">${ld?"Zuletzt importiert bis "+dShort(ld)+ld.slice(0,4)+".":"Für dieses Konto gibt es noch keine Buchungen."}</p>`;}
  if(I.stage==="in"){
    h+=guideHtml()+`<div class="card"><label class="btn p w" for="csvf" tabindex="0" id="csvl">CSV- oder PDF-Datei wählen</label><input type="file" id="csvf" accept=".csv,.txt,.pdf,application/pdf,text/csv,text/plain" hidden>
    <p class="muted small cen">Datei auch per Drag &amp; Drop oder Einfügen möglich. PDFs werden nur lokal im Browser gelesen.</p>
    <p class="muted small cen">oder Text einfügen (CSV oder aus der PDF kopierter Text)</p><textarea id="csvt" rows="5" placeholder="CSV- oder PDF-Text hier einfügen" aria-label="CSV- oder PDF-Text">${esc(I.text)}</textarea>
    <button class="btn w" data-a="impText">Text einlesen</button>${I.busy?`<p class="status" role="status">${esc(I.busy)}</p>`:""}${I.msg?`<p class="err" role="alert">${esc(I.msg)}</p>`:""}</div>
    <p class="muted small">Unterstützt ; und , als Trenner, UTF-8 und Windows-1252, deutsche Zahlen und Datumsformate. Doppelte Buchungen werden beim erneuten Import übersprungen.</p>`;
  }else if(I.stage==="year"){
    h+=`<div class="card"><p class="big">Jahr angeben</p><p class="muted small">In der PDF stehen Buchungsdaten ohne Jahr, und im Kopf war keins zu finden.</p>
    <label class="fld">Jahr<input inputmode="numeric" id="pdfYear" value="${new Date().getFullYear()}"></label>
    <div class="row"><button class="btn p" data-a="pdfYear">Weiter</button><button class="btn" data-a="impCancel">Abbrechen</button></div></div>`;
  }else if(I.stage==="map"){
    const a=I.a,hdr=a.rows[I.hr]||[],opt=(sel)=>`<option value="">(nicht vorhanden)</option>`+hdr.map((x,i)=>`<option value="${i}" ${sel===i?"selected":""}>${i+1}: ${esc(x.slice(0,28))}</option>`).join("");
    const F=[["date","Buchungsdatum *"],["amount","Betrag (oder Soll/Haben)"],["soll","Soll (Ausgaben)"],["haben","Haben (Einnahmen)"],["payee","Empfänger / Auftraggeber"],["text","Verwendungszweck"],["bal","Saldo"]];
    h+=`<div class="card"><p class="big">Spalten zuordnen</p><p class="muted small">Die Spalten wurden nicht erkannt. Wähle die Kopfzeile und ordne die Felder zu. Die Zuordnung wird für dieses Konto gemerkt.</p>
    <label class="fld">Kopfzeile<select data-ch="mapHr">${a.rows.slice(0,20).map((r,i)=>`<option value="${i}" ${i===I.hr?"selected":""}>Zeile ${i+1}: ${esc(r.join(" | ").slice(0,40))}</option>`).join("")}</select></label>
    ${F.map(([k,l])=>`<label class="fld">${l}<select data-ch="mapCol" data-f="${k}">${opt(I.cols[k])}</select></label>`).join("")}
    <div class="row"><button class="btn p" data-a="mapOk">Weiter</button><button class="btn" data-a="impCancel">Abbrechen</button></div>${I.msg?`<p class="err">${esc(I.msg)}</p>`:""}</div>`;
  }else{
    const nw=impNew(I),nd=I.rows.filter(r=>r.dup).length,nm=I.rows.filter(r=>r.maybe).length;
    h+=`<div class="card"><p class="big">Vorschau: ${esc(accName(I.acc))}</p>
    <div class="kv"><span>Neu</span><b class="num">${nw.length}</b></div><div class="kv"><span>Duplikate (übersprungen)</span><b class="num">${nd}</b></div>${I.rows.some(r=>r.up)?`<div class="kv"><span>Davon vorhandene Buchungen, die genauere Daten bekommen (z. B. PDF → CSV, Vorzeichen)</span><b class="num">${I.rows.filter(r=>r.up).length}</b></div>`:""}${I.pend&&I.pend.length?`<div class="kv"><span>Vorgemerkt (noch nicht gebucht, zählt erst nach Buchung)</span><b class="num">${I.pend.length}</b></div>`:""}${nm?`<div class="kv"><span>Mögliche Duplikate (gleiches Datum, Betrag, Konto, anderer Text)</span><b class="num">${nm}</b></div><label class="chk"><input type="checkbox" data-ch="takeMaybe" ${I.takeMaybe?"checked":""}> Mögliche Duplikate trotzdem übernehmen (Eingänge werden immer übernommen)</label>`:""}<div class="kv"><span>Nicht lesbare Zeilen</span><b class="num">${I.skipped}</b></div>
    <div class="kv"><span>Summe neu</span><b class="num">${fmt(nw.reduce((s,r)=>s+r.amt,0))}</b></div>
    <div class="kv"><span>davon Eingänge (+)</span><b class="num pos">${nw.filter(r=>r.amt>0).length} · ${fmt0(nw.filter(r=>r.amt>0).reduce((s,r)=>s+r.amt,0))}</b></div><div class="kv"><span>davon Ausgaben (−)</span><b class="num">${nw.filter(r=>r.amt<0).length} · ${fmt0(-nw.filter(r=>r.amt<0).reduce((s,r)=>s+r.amt,0))}</b></div>
    ${nw.length&&!nw.some(r=>r.amt>0)?`<p class="err" role="alert">Keine Eingänge in dieser Datei. Stimmen die Vorzeichen? Dann unten "Vorzeichen umkehren" prüfen.</p>`:""}
    ${impWarn(I)}
    <label class="chk"><input type="checkbox" data-ch="inv" ${I.inv?"checked":""}> Vorzeichen umkehren (z. B. Amex: Ausgaben positiv)</label>
    ${I.src==="pdf"?`<p class="muted small">Quelle: PDF-Text, heuristisch erkannt. Bitte Vorschau prüfen${I.guess?", bei "+I.guess+" Buchungen wurde das Vorzeichen geschätzt (der Haken unten kehrt alle um)":""}. CSV ist verlässlicher.</p>`:`<p class="muted small">Trenner „${esc(I.a.delim==="\t"?"Tab":I.a.delim)}“ · Spalten: Datum ${I.a.cols.date+1}${I.a.cols.amount!=null?", Betrag "+(I.a.cols.amount+1):""}</p>`}
    ${I.rows.slice(0,5).map(r=>`<div class="tl static"><span class="td">${dShort(r.d)}</span><span class="tt">${esc((r.p+" "+r.t).trim().slice(0,50))}${r.dup?" (Duplikat)":r.maybe?(I.takeMaybe||r.amt>0?" (mögliches Duplikat, wird übernommen)":" (mögliches Duplikat, wird übersprungen)"):""}</span><span class="num ${r.amt>0?"pos":""}">${fmt(r.amt)}</span></div>`).join("")}
    ${I.rows.length>5?`<p class="muted small">… und ${I.rows.length-5} weitere</p>`:""}
    ${I.src==="pdf"&&I.rows.some(r=>r.guess)?`<h3 class="sec">Vorzeichen unsicher (${I.rows.filter(r=>r.guess).length})</h3><p class="muted small">Bei diesen Zeilen war nicht eindeutig, ob es ein Eingang oder eine Ausgabe ist. Standard: Ausgabe, außer bei Wörtern wie Gehalt oder Gutschrift. Tippe auf ↔, um eine Zeile umzudrehen.</p>${I.rows.map((r,i)=>({r,i})).filter(x=>x.r.guess).slice(0,60).map(({r,i})=>`<div class="tl static"><span class="td">${dShort(r.d)}</span><span class="tt">${esc((r.p+" "+r.t).trim().slice(0,40))}</span><span class="num ${r.amt>0?"pos":""}">${fmt(r.amt)}</span><button class="btn s" data-a="impFlip" data-i="${i}" aria-label="Vorzeichen umdrehen">↔</button></div>`).join("")}<button class="btn w" data-a="impFlipAll">Alle unsicheren umdrehen</button>`:""}
    ${I.unrec&&I.unrec.length?`<details class="dt" data-id="unrec"><summary>Nicht erkannt (${I.unrec.length})</summary><div class="dbody"><p class="muted small">Diese Zeilen wurden keiner Buchung zugeordnet. Fehlt etwas, bitte per CSV importieren oder manuell prüfen.</p>${I.unrec.slice(0,40).map(u=>`<div class="tl static"><span class="tt" style="white-space:normal">${esc(u.slice(0,160))}</span></div>`).join("")}</div></details>`:""}</div>
    <div class="stickybar"><button class="btn p w" data-a="impOk" ${nw.length?"":"disabled"}>${nw.length} Buchungen übernehmen</button><button class="btn" data-a="impCancel">Abbrechen</button></div>`;
  }
  if(I.stage==="in"&&!S.tx.length)h+=`<button class="btn w" data-a="demo">Mit Beispieldaten ausprobieren</button>`;
  return h;
}
function vSettings(){
  const D=(id,title,body)=>`<details class="card dt" data-id="${id}" ${ui.det[id]?"open":""}><summary>${title}</summary><div class="dbody">${body}</div></details>`;
  const catOpts=sel=>S.cats.map(c=>`<option value="${esc(c)}" ${c===sel?"selected":""}>${esc(catLabel(c))}</option>`).join("");
  let h=`<h2 class="sec">Einstellungen</h2><button class="btn w" data-a="tab" data-t="avg">Ø pro Monat und Fixkosten</button><button class="btn w" data-a="tab" data-t="goals">Sparziele</button><button class="btn w" data-a="tab" data-t="abos">Abo-Radar</button><button class="btn w" data-a="tab" data-t="year">Jahresrückblick</button>`;
  {const rc=detectRecurring(S,cmap()),fsum=S.fixed.reduce((s,f)=>s+(+f.amt||0),0);
  h+=D("fixed","Feste Kosten ("+S.fixed.length+(fsum?", "+fmt0(fsum):"")+")",`<p class="muted small">Jeder Posten wird zum Plan-Wert seiner Kategorie (bei gleicher Kategorie summiert) und gilt als Fixposten, also ohne Hochrechnung.</p>`+
    S.fixed.map(f=>`<div class="fxr"><input class="nm" data-ch="fxName" data-id="${esc(f.id)}" value="${esc(f.n)}" aria-label="Name"><input inputmode="decimal" data-ch="fxAmt" data-id="${esc(f.id)}" value="${f.amt}" aria-label="Betrag in Euro"><select data-ch="fxCat" data-id="${esc(f.id)}" aria-label="Kategorie">${fxCats().map(x=>`<option value="${esc(x)}" ${x===f.cat?"selected":""}>${esc(x)}</option>`).join("")}</select><button class="btn s" data-a="fxDel" data-id="${esc(f.id)}" aria-label="${esc(f.n)} löschen">×</button></div>`).join("")+
    `<div class="fxr"><input class="nm" id="fxn" placeholder="Neuer Posten, z. B. Strom" aria-label="Neuer Posten"><input id="fxa" inputmode="decimal" placeholder="Betrag €" aria-label="Betrag"><select id="fxc" aria-label="Kategorie">${fxCats().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select><button class="btn s p" data-a="fxAdd">+</button></div>`+
    (rc.length?`<h3 class="sec">Wiederkehrende Zahlungen erkannt</h3><p class="muted small">Nur ein Vorschlag, nichts wird automatisch übernommen.</p>`+rc.map(r=>`<div class="erow"><span class="rk">${esc(r.name)} · ${r.interval>1?fmt(r.occ)+" alle "+r.interval+" Monate = "+fmt(r.amt)+" pro Monat":fmt0(r.amt)+" monatlich"} (${r.months} Monate)</span><button class="btn s p" data-a="recAdd" data-k="${esc(r.k)}">Übernehmen</button><button class="btn s" data-a="recNo" data-k="${esc(r.k)}" aria-label="Nein, ${esc(r.name)} nicht übernehmen">Nein</button></div>`).join(""):""));
  h+=D("setup","Einrichtung",`<p class="muted small">Einkommen, feste Kosten und Limits in drei kurzen Schritten festlegen oder jederzeit wiederholen. Bereits vorhandene Werte werden vorausgefüllt und nur geändert, wenn du den Schritt mit "Weiter" bestätigst.</p><button class="btn p w" data-a="wizOpen">Einrichtung ${S.profile.setupDone?"wiederholen":"starten"}</button>`);}
  {const dg=importDiag(S),dl=d=>d.slice(8,10)+"."+d.slice(5,7)+"."+d.slice(2,4);
  h+=D("diag","Import prüfen",`<p class="muted small">Zahlen pro Konto, ohne Texte aus den Buchungen. Fehlen Eingänge oder Ausgaben, stimmen vermutlich die Vorzeichen: Konto löschen, neu importieren und dabei "Vorzeichen umkehren" prüfen.</p>`+
    (dg.length?dg.map(x=>`<div class="diag"><b>${esc(x.name)}</b><span>${x.n} Buchungen · ${dl(x.min)} bis ${dl(x.max)}</span><span>Saldo der Buchungen: <b>${fmt0(x.pos+x.neg)}</b> · <b class="pos">+${fmt0(x.pos)}</b> (${x.np} Eingänge) · <b>−${fmt0(-x.neg)}</b> (${x.nn} Ausgaben)</span>${x.np===0?`<span class="warnt">⚠ Keine Eingänge: Vorzeichen prüfen</span>`:x.nn===0?`<span class="warnt">⚠ Keine Ausgaben: Vorzeichen prüfen</span>`:""}<label class="chk s"><input type="checkbox" data-ch="accInv" data-id="${esc(x.id)}" ${x.inv?"checked":""}> Vorzeichen beim nächsten Import umkehren</label>${(()=>{const ms=[...new Set(S.tx.filter(t=>t.a===x.id&&!t.man).map(t=>mkey(t)))].sort().reverse(),op=ms.map(m=>`<option value="${m}">${mLabel(m)}</option>`).join("");return `<p class="muted small">Alle Buchungen dieses Kontos umdrehen (Plus ↔ Minus):</p><div class="fxr"><select id="fr-${esc(x.id)}" aria-label="Bereich"><option value="month">Gewählter Monat (${mLabel(ui.month)})</option><option value="span">Zeitraum von bis</option><option value="all">Ganzes Konto</option></select><select id="ff-${esc(x.id)}" aria-label="von">${op}</select><select id="ft-${esc(x.id)}" aria-label="bis">${op}</select><button class="btn s" data-a="flipRng" data-id="${esc(x.id)}">Umdrehen</button></div>`;})()}</div>`).join(""):`<p class="muted small">Noch keine Buchungen.</p>`));}
  {const R=ui.dupRes,dl=d=>d.slice(8,10)+"."+d.slice(5,7)+"."+d.slice(2,4),WHY={ref:"gleiche Kundenreferenz",name:"gleicher Händler",text:"gleicher Verwendungszweck (Händler umbenannt)",sign:"PDF mit falschem Vorzeichen",pdfcsv:"gleiche Buchung aus PDF und CSV",pdfpdf:"zwei PDF-Importe",konto:"dasselbe Bankkonto unter zwei Namen"};
   const pr=p=>`<div class="tl static"><span class="td">${dl(p.keep.d)}</span><span class="tt">${esc(accName(p.drop.a))} · ${esc((p.drop.p||p.drop.t||"").slice(0,22))} ↔ ${esc((p.keep.p||p.keep.t||"").slice(0,22))}<br><small class="faint">${WHY[p.why]||p.why}</small></span><span class="num">${fmt(p.drop.amt)}</span></div>`;
   let b=`<p class="muted small">Findet Buchungen, die durch mehrfachen oder überlappenden Import doppelt gespeichert sind (z. B. zwei Exporte mit gleichem Zeitraum, CSV und PDF desselben Monats, PDF in ein anderes Konto importiert). Entfernt wird nur die Kopie; deine Zuordnungen wandern auf die behaltene Buchung. Manuelle Buchungen und Dauerposten werden nie angefasst. Mehrmals ausführen ändert nichts mehr.</p><button class="btn w" data-a="dupCheck">Duplikate prüfen</button>`;
   if(R){const sure=R.pairs.filter(p=>p.sure),uns=R.pairs.filter(p=>!p.sure);
     if(R.removed!=null)b+=`<p class="status" role="status">Bereinigt: ${R.removed} entfernt. Buchungen vorher ${R.before}, nachher ${R.after}. Umsatzvolumen vorher ${fmt0(R.sumB)}, nachher ${fmt0(R.sumA)}.</p>`;
     b+=`<p><b>${sure.length}</b> sichere Duplikate${sure.length?` (${fmt0(sure.reduce((s,p)=>s+Math.abs(p.drop.amt),0))})`:""}${uns.length?` · ${uns.length} unsichere (werden nicht entfernt)`:""}</p>`;
     const byWhy={};for(const p of sure)byWhy[p.why]=(byWhy[p.why]||0)+1;if(sure.length)b+=`<p class="muted small">${Object.entries(byWhy).map(([k,v])=>v+"× "+(WHY[k]||k)).join(" · ")}</p>`;
     b+=sure.slice(0,30).map(pr).join("")+(sure.length>30?`<p class="muted small">… und ${sure.length-30} weitere</p>`:"");
     if(sure.length)b+=`<button class="btn p w" data-a="dupFix">${sure.length} Duplikate entfernen</button>`;
     if(uns.length)b+=`<details class="dt"><summary>Unsicher, bitte selbst prüfen (${uns.length})</summary><div class="dbody"><p class="muted small">Gleicher Tag, gleicher runder Betrag, aber nicht sicher dieselbe Buchung. Echte Duplikate hier einzeln über die Buchung löschen.</p>${uns.slice(0,30).map(pr).join("")}</div></details>`;}
   h+=D("dups","Duplikate prüfen und bereinigen",b);}
  h+=D("recur","Dauerposten ("+S.recur.length+")",`<p class="muted small">Dauerposten rechnen sich ab dem Startdatum in jedem Monat automatisch mit, bis zum Enddatum. Neue legst du mit dem Plus in der Monatsansicht an (Haken "Jeden Monat wiederholen").</p>`+
    (S.recur.length?S.recur.map(r=>`<div class="erow"><span class="rk">⟳ ${esc(r.n)}<br><small class="faint">${fmt(r.amt)} · ${esc(catLabel(r.cat))} · ab ${dl2(r.start)}${r.end?" bis "+dl2(r.end):""}</small></span><button class="btn s" data-a="recEdit" data-id="${esc(r.id)}">Bearbeiten</button><button class="btn s dang" data-a="recDel" data-id="${esc(r.id)}" aria-label="${esc(r.n)} löschen">×</button></div>`).join(""):`<p class="muted small">Noch keine Dauerposten.</p>`)+`<button class="btn w" data-a="addOpen">Neue Buchung oder Dauerposten</button>`);
  h+=D("reset","Neu aufsetzen",`<p class="muted small">Löscht alle <b>importierten</b> Buchungen (${S.tx.filter(t=>!t.man).length}). Konten, Kategorien, Regeln, Plan, feste Kosten, Profil, Tresor, manuelle Buchungen und Dauerposten bleiben. Danach alle Konten für denselben Zeitraum neu laden.</p><button class="btn w" data-a="reapply">Regeln neu anwenden</button><p class="muted small">Berechnet alle Zuordnungen neu, die aus Regeln stammen. Einzeln gesetzte Zuordnungen und manuelle Buchungen bleiben. Hilfreich, wenn Buchungen falsch einsortiert wurden.</p><button class="btn w dang" data-a="wipeTx">Nur Buchungen löschen (Einstellungen behalten)</button>`);
  h+=D("myname","Mein Name (Eigenüberweisungen erkennen)",`<p class="muted small">Überweisungen von und an dich selbst (zwischen deinen Konten) zählen weder als Einnahme noch als Ausgabe. Der Name wird beim Import aus den Daten abgeleitet. Hier kannst du ihn prüfen oder ergänzen (mehrere mit Komma trennen).</p><label class="fld">Mein Name<input data-ch="myNames" value="${esc((S.profile.myNames||[]).join(", "))}" placeholder="z. B. Max Mustermann" aria-label="Mein Name"></label><p class="muted small">Erkannte eigene Konten (IBAN): ${(S.profile.myIbans||[]).length}</p>`);
  h+=D("acc","Konten",S.accounts.filter(a=>!a.virtual).map(a=>`<div class="erow"><input data-ch="accName" data-id="${esc(a.id)}" value="${esc(a.name)}" aria-label="Kontoname"><label class="chk s"><input type="checkbox" data-ch="accInv" data-id="${esc(a.id)}" ${a.inv?"checked":""}> Vorz. umkehren</label><button class="btn s" data-a="accDel" data-id="${esc(a.id)}" aria-label="Konto ${esc(a.name)} löschen">Löschen</button></div>`).join("")+
    `<div class="erow"><input id="newAcc" placeholder="Neues Konto" aria-label="Neues Konto"><button class="btn s p" data-a="accAdd">Hinzufügen</button></div>`);
  h+=D("cat","Kategorien",S.cats.map((c,i)=>{const fixed=c===INCOME||c===TRANSFER;return `<div class="erow"><input data-ch="catName" data-i="${i}" value="${esc(fixed?catLabel(c):c)}" ${fixed?"disabled":""} aria-label="Kategorie"><button class="btn s" data-a="catDel" data-i="${i}" ${fixed?"disabled":""} aria-label="Kategorie ${esc(c)} löschen">Löschen</button></div>`;}).join("")+
    `<div class="erow"><input id="newCat" placeholder="Neue Kategorie" aria-label="Neue Kategorie"><button class="btn s p" data-a="catAdd">Hinzufügen</button></div>`);
  const q=norm(ui.ruleQ),rl=S.rules.map((r,i)=>({r,i})).filter(x=>!q||norm(x.r.k).includes(q)||norm(x.r.c).includes(q));
  h+=D("rul","Regeln ("+S.rules.length+")",`<p class="muted small">Schlüsselwort (Groß/Klein egal) im Empfänger oder Zweck. ^ am Anfang = Wortanfang, $ am Ende = Wortende. Erste passende Regel zählt, neue stehen oben.</p>
    <input id="ruleQ" placeholder="Regeln suchen" value="${esc(ui.ruleQ)}" aria-label="Regeln suchen">
    <div class="erow"><input id="newRk" placeholder="Schlüsselwort" aria-label="Schlüsselwort"><select id="newRc" aria-label="Kategorie">${catOpts("")}</select><button class="btn s p" data-a="ruleAdd">Neu</button></div>`+
    rl.slice(0,60).map(({r,i})=>`<div class="erow"><span class="rk">${esc(r.k)}${ruleBreadth(S,r.k).broad?` <small class="warnt" title="Diese Regel trifft sehr viele Buchungen">⚠ trifft sehr viele Buchungen</small>`:""}</span><span class="ra">→ ${esc(catLabel(r.c))}</span><button class="btn s" data-a="ruleDel" data-i="${i}" aria-label="Regel ${esc(r.k)} löschen">×</button></div>`).join("")+(rl.length>60?`<p class="muted small">… ${rl.length-60} weitere, Suche nutzen.</p>`:"")+
    `<button class="btn w" data-a="ruleDefaults">Standardregeln ergänzen</button>`);
  const cm=cmap(),inc=effIncome(S,ui.month,cm);
  h+=D("bud","Richtwerte &amp; Einkommen",`<p class="muted small">Richtwert = dein Plan in Euro. Fehlt ein Plan, gilt der Durchschnitt Deutschland (grobe Orientierung in Prozent vom Netto, kein amtlicher Wert) und wird als "Standardwert" markiert.</p>
    <div class="chips" role="group" aria-label="Welcher Richtwert zählt"><button data-a="mode" data-m="plan" aria-pressed="${S.budget.mode==="plan"}">Mein Plan, sonst Durchschnitt</button><button data-a="mode" data-m="avg" aria-pressed="${S.budget.mode==="avg"}">Durchschnitt Deutschland</button><button data-a="mode" data-m="max" aria-pressed="${S.budget.mode==="max"}">Größerer Wert</button></div>
    <p class="muted small">Dein Gehalt: ${fmt0(effIncome(S,ui.month,cmap(),todayStr()).v)} (${esc(effIncome(S,ui.month,cmap(),todayStr()).src)}).</p>
    <label class="fld">Gehalt manuell (leer lassen = aus Buchungen erkennen)<input inputmode="decimal" data-ch="income" value="${S.budget.income>0?S.budget.income:""}" placeholder="automatisch"></label>
    <label class="fld">Nettoeinkommen aus der Einrichtung (€, gilt, bis Buchungen dein Gehalt zeigen)<input inputmode="decimal" data-ch="profInc" value="${S.profile.income>0?S.profile.income:""}" placeholder="z. B. 2400"></label>${S.budget.planIncome>0?`<label class="fld">Plan-Gehalt als Rückfall (€)<input inputmode="decimal" data-ch="planInc" value="${S.budget.planIncome}"></label>`:""}
    <label class="fld">Ampel: Gelb ab (% vom Richtwert, Rot ab 100 %)<input inputmode="numeric" data-ch="thrG" value="${S.budget.g}"></label>
    <div class="erow b3"><span class="rk"><b>Kategorie</b></span><span class="small muted">Plan €</span><span class="small muted">Ø DE %</span></div>`+
    S.budget.items.map((it,i)=>`<div class="erow b3"><span class="rk">${esc(it.n)}</span><input inputmode="decimal" data-ch="bPlan" data-i="${i}" value="${it.plan==null?"":it.plan}" aria-label="Plan ${esc(it.n)} in Euro" placeholder="€"><input inputmode="decimal" data-ch="bPct" data-i="${i}" value="${it.pct==null?"":it.pct}" aria-label="Durchschnitt Deutschland ${esc(it.n)} in Prozent" placeholder="%"></div>`).join("")+
    `<button class="btn w" data-a="budReset">Alle Plan-Werte leeren</button>`);
  h+=D("thm","Darstellung",`<div class="chips">${[["auto","Automatisch"],["light","Hell"],["dark","Dunkel"]].map(([v,l])=>`<button data-a="theme" data-v="${v}" aria-pressed="${META.theme===v}">${l}</button>`).join("")}</div>
    <p class="muted small">Wenn eine Budget-Kategorie gelb oder rot wird, erscheint ein Hinweis in der Monatsansicht. Optional auch als Mitteilung auf diesem Gerät, ohne Server und nur solange die App geöffnet ist.</p>
    <button class="btn w" data-a="notifyOn">${META.notify?"Mitteilungen sind an":"Mitteilungen einschalten"}</button>${META.notify?`<button class="btn w" data-a="notifyOff">Mitteilungen aus</button>`:""}`);
  const csvYears=[...new Set(S.tx.map(t=>t.d.slice(0,4)))].sort().reverse();
  h+=D("dat","Daten &amp; Backup",`<p class="muted small">CSV für die Steuer oder die eigene Tabelle. Semikolon und deutsches Komma, filterbar nach Kategorie und Jahr. Umbuchungen zwischen eigenen Konten fehlen, außer du wählst diese Kategorie ausdrücklich.</p>
    <label class="fld">Kategorie<select id="csvCat" aria-label="Kategorie für den CSV-Export"><option value="all">Alle Kategorien</option>${S.cats.map(c=>`<option value="${esc(c)}">${esc(catLabel(c))}</option>`).join("")}</select></label>
    <label class="fld">Jahr<select id="csvYear" aria-label="Jahr für den CSV-Export"><option value="all">Alle Jahre</option>${csvYears.map(y=>`<option value="${y}">${y}</option>`).join("")}</select></label>
    <label class="fld">Art<select id="csvSign" aria-label="Einnahmen oder Ausgaben"><option value="all">Einnahmen und Ausgaben</option><option value="out">Nur Ausgaben</option><option value="in">Nur Eingänge</option></select></label>
    <button class="btn w" data-a="csvExport">CSV exportieren</button>
    <label class="chk"><input type="checkbox" id="expV" checked> Tresor im Backup einschließen</label>
    <button class="btn w" data-a="export">JSON-Backup herunterladen</button>
    <label class="btn w" for="impj" tabindex="0">Backup einlesen</label><input type="file" id="impj" accept=".json,application/json" hidden>
    ${hasDemo()?`<button class="btn w" data-a="demoDel">Demo-Daten löschen</button>`:`<button class="btn w" data-a="demo">Mit Beispieldaten ausprobieren</button>`}
    <button class="btn w dang" data-a="wipe">Alles löschen</button>`);
  const sy=META.pass;
  h+=D("syn","Sync (Ende-zu-Ende verschlüsselt)",`<p class="muted small">Alle Daten werden auf dem Gerät mit deiner Passphrase verschlüsselt, bevor sie in Firestore landen. Wähle eine lange, einmalige Passphrase (mindestens 12 Zeichen) und merke sie dir gut, sie ist nicht wiederherstellbar.</p>
    <p class="status" id="sy-st" role="status">${esc(syLabel())}</p>`+
    (sy?`<button class="btn w" data-a="syNow">Jetzt synchronisieren</button><button class="btn w" data-a="syOff">Sync trennen</button>`:
    `<label class="fld">Sync-Passphrase<input type="password" id="syPass" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
     <button class="btn p w" data-a="syNew">Sync einrichten</button><button class="btn w" data-a="syJoin">Mit bestehender Passphrase verbinden</button>`));
  h+=`<p class="muted small cen">Finanzplaner v13 · alle Daten bleiben auf deinem Gerät <button class="vq" data-a="vault" aria-label="Gesperrter Bereich">·</button></p>`;
  return h;
}

/* ---------- Import-Ablauf ---------- */
function impWarn(I){
  const acc=S.accounts.find(a=>a.id===I.acc)||{},n=I.rows.length;let h="";
  const box=(t,b)=>`<div class="status warnbox" role="alert"><b>${t}</b> ${b}</div>`;
  if(n>=10&&!acc.posOk){const sh=I.rows.filter(r=>r.amt>0).length/n;if(sh>=0.8)h+=box("Bei diesem Konto sind "+Math.round(sh*100)+" % der Beträge positiv.",`Ist das richtig? <div class="row"><button class="btn s p" data-a="posOk">Ja, stimmt</button><button class="btn s" data-a="posInv">Umkehren</button></div>`);}
  if(I.sc&&I.sc.suggestInv)h+=box("Die Saldo-Spalte passt nur mit umgekehrten Vorzeichen",`(${I.sc.inv} von ${I.sc.n} Zeilen). <div class="row"><button class="btn s p" data-a="posInv">Umkehren</button></div>`);
  if(I.ov)h+=box("Diese Buchungen sind schon im Konto „"+esc(I.ov.name)+"“",`(${I.ov.n} von ${I.ov.of} im gemeinsamen Zeitraum, ${Math.round(I.ov.rate*100)} %). Ist es dasselbe Bankkonto (z. B. PDF und CSV derselben Bank)? Dann bitte dort importieren, sonst zählt alles doppelt. <div class="row"><button class="btn s p" data-a="impSwitch" data-id="${esc(I.ov.acc)}">In „${esc(I.ov.name)}“ importieren</button></div>`);
  if(I.conf&&I.conf.n>=5&&I.conf.bad/I.conf.n>=0.7)h+=box("Typ-/Buchungstext und Vorzeichen passen nicht zusammen",`(${I.conf.bad} von ${I.conf.n} Zeilen). <div class="row"><button class="btn s p" data-a="posInv">Umkehren</button></div>`);
  return h;
}
const impNew=I=>takeRows(I.rows,I.takeMaybe);
function impBuild(a){
  const I=ui.imp,acc=S.accounts.find(x=>x.id===I.acc),inv=!!acc.inv;
  I.a=a;I.inv=inv;
  const ex=extractRows(a,{inv});assignHashes(ex.rows,acc.id);
  markDups(S,ex.rows,acc.id);I.takeMaybe=false;I.sc=signCheck(ex.rows);I.conf=ex.conf;
  I.rows=ex.rows;I.pend=ex.pend||[];I.ov=importOverlap(S,ex.rows,acc.id);I.skipped=ex.skipped;I.stage="prev";I.msg="";
  if(!ex.rows.length){I.stage="in";I.msg="Keine lesbaren Buchungen gefunden. Prüfe Datei und Konto.";}
  render();
}
const PDFJS_BASE="./vendor/";
let _pdfP=null;
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(_pdfP)return _pdfP;
  _pdfP=new Promise((res,rej)=>{
    const s=document.createElement("script");s.src=PDFJS_BASE+"pdf.min.js";s.crossOrigin="anonymous";
    s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_BASE+"pdf.worker.min.js";res(window.pdfjsLib);}catch(e){rej(e);}};
    s.onerror=()=>{_pdfP=null;rej(new Error("offline"));};
    document.head.appendChild(s);
  });
  return _pdfP;
}
async function pdfToLines(buf){
  const lib=await loadPdfJs();
  const doc=await lib.getDocument({data:new Uint8Array(buf),isEvalSupported:false}).promise;
  const lines=[];
  for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const tc=await pg.getTextContent();lines.push(...itemsToRows(tc.items));}
  return lines;
}
async function impLoadFile(f){
  const I=ui.imp;
  if(!S.accounts.some(a=>a.id===I.acc)){toast("Bitte erst ein Konto anlegen");return;}
  const head=new Uint8Array(await f.slice(0,5).arrayBuffer());
  const isPdf=/\.pdf$/i.test(f.name)||f.type==="application/pdf"||String.fromCharCode(...head)==="%PDF-";
  if(!isPdf){impLoad(decodeBuf(await f.arrayBuffer()));return;}
  I.msg="";I.busy="PDF wird gelesen …";render();
  try{
    const lines=await pdfToLines(await f.arrayBuffer());
    I.busy="";
    if(lines.map(x=>x.t).join("").length<20){I.msg="Diese PDF enthält keinen auswählbaren Text (Scan). Bitte CSV nutzen.";render();return;}
    impStartPdf(lines,f.name);
  }catch(e){
    I.busy="";
    I.msg=e&&e.name==="PasswordException"?"Diese PDF ist passwortgeschützt. Bitte ohne Passwort speichern oder CSV nutzen.":
      (e&&e.message==="offline"?"Die PDF-Bibliothek konnte nicht geladen werden. Bitte die Seite neu laden oder CSV nutzen.":"Die PDF konnte nicht gelesen werden. Bitte CSV nutzen.");
    render();
  }
}
function impStartPdf(lines,fname){
  const I=ui.imp;I.pdf={lines,fname,year:null};I.flips=new Set();impBuildPdf();
}
function impBuildPdf(){
  const I=ui.imp,acc=S.accounts.find(x=>x.id===I.acc),P=I.pdf;
  const res=parsePdfLines(P.lines,{fname:P.fname,year:P.year});
  if(!res.rows.length){I.stage="in";I.msg=res.unrec.length?"Es wurden keine Buchungen sicher erkannt ("+res.unrec.length+" unklare Zeilen). Bitte CSV nutzen.":"Im PDF-Text wurden keine Buchungen gefunden. Bitte CSV nutzen.";render();return;}
  if(res.needYear){I.stage="year";render();return;}
  const fl=I.flips||new Set(),rows=res.rows.map((r,i)=>({d:r.d,amt:(acc.inv?-r.amt:r.amt)*(fl.has(i)?-1:1),p:r.p,t:r.t,guess:r.guess&&!fl.has(i),conf:r.conf,src:"pdf"}));
  assignHashes(rows,acc.id);
  markDups(S,rows,acc.id);rows.forEach((r,i)=>{r.o=i;});I.takeMaybe=false;
  Object.assign(I,{sc:null,conf:null,src:"pdf",rows,pend:null,ov:importOverlap(S,rows,acc.id),skipped:0,unrec:res.unrec,guess:rows.filter(r=>r.guess).length,inv:!!acc.inv,stage:"prev",msg:"",busy:""});
  render();
}
function impLoad(text){
  const I=ui.imp,acc=S.accounts.find(x=>x.id===I.acc);if(!acc){toast("Bitte erst ein Konto anlegen");return;}
  I.text="";I.src="csv";I.unrec=null;
  const a=analyzeCSV(text,acc.map);
  if(!a.rows.length){I.msg="Die Datei ist leer.";render();return;}
  if(!a.ok){
    const lines=text.split(/\r?\n/),pr=parsePdfLines(lines);
    if(pr.rows.length&&pr.rows.length>=pr.unrec.length){impStartPdf(lines,"");return;}
    I.stage="map";I.a=a;I.hr=Math.min(a.rows.findIndex(r=>r.length>=3),a.rows.length-1);if(I.hr<0)I.hr=0;I.cols={};I.msg="";render();return;}
  impBuild(a);
}
function impCommit(){
  const I=ui.imp,nw=impNew(I);let res={n:0,dup:0,up:0,pend:0};
  mutate(()=>{res=applyImport(S,I.acc,I.rows,{takeMaybe:I.takeMaybe,pend:I.src==="pdf"?null:(I.pend||[])});
    ui.month=lastDataMonth()||nowYM();
    I.stage="in";I.rows=[];I.pend=[];I.msg="";},true);
  const hs=new Set(nw.map(r=>r.h)),cm=cmap(),uns=S.tx.filter(t=>hs.has(t.h)&&cm.get(t.h)==null).length;
  ui.sheet={t:"imp",n:res.n,dup:res.dup-res.up,up:res.up,pend:res.pend,uns};render();
}

/* ---------- Aktionen (Klicks) ---------- */
const ACT={
  flip:el=>{const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;if(t.rec){toast("Dauerposten bitte unter Mehr ändern");return;}mutate(()=>{flipTx(t);});toast(t.fl?"Vorzeichen umgedreht":"Original wiederhergestellt");},
  flipGrp:el=>{
    const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;const list=flipGroup(S,t);
    if(!confirm((t.fl?"Umdrehung rückgängig machen":"Plus/Minus umdrehen")+" bei "+list.length+" Buchungen dieses Händlers (gleiches Konto)?"))return;
    mutate(()=>{for(const x of list)flipTx(x);});toast(list.length+" Buchungen geändert");
  },
  flipRng:el=>{
    const id=el.dataset.id,mode=($("#fr-"+id)||{}).value||"all";let from="",to="";
    if(mode==="month")from=to=ui.month;else if(mode==="span"){from=($("#ff-"+id)||{}).value||"";to=($("#ft-"+id)||{}).value||"";if(from&&to&&from>to){const x=from;from=to;to=x;}}
    const list=flipRangeList(S,id,from,to);
    if(!list.length){toast("Keine Buchungen in diesem Bereich");return;}
    const lab=mode==="month"?mLabel(ui.month):mode==="span"?(from?mLabel(from):"Anfang")+" bis "+(to?mLabel(to):"Ende"):"ganzes Konto";
    if(!confirm("Bei "+list.length+" Buchungen von "+accName(id)+" ("+lab+") Plus und Minus umdrehen? Doppelt ausgeführt stellt es das Original wieder her."))return;
    mutate(()=>{for(const x of list)flipTx(x);});toast(list.length+" Buchungen geändert");
  },
  impSwitch:el=>{const I=ui.imp;if(!S.accounts.some(a=>a.id===el.dataset.id))return;I.acc=el.dataset.id;if(I.src==="pdf")impBuildPdf();else impBuild(I.a);},
  dupCheck:()=>{ui.dupRes={pairs:dupScan(S),before:S.tx.length};ui.det.dups=true;render();},
  dupFix:()=>{
    const ps=dupScan(S).filter(p=>p.sure);if(!ps.length){toast("Keine sicheren Duplikate gefunden");return;}
    const sumOf=()=>S.tx.filter(t=>!t.man).reduce((s,t)=>s+Math.abs(t.amt),0);
    if(!confirm(ps.length+" doppelte Buchungen gefunden. Entfernen?\n\nEntfernt werden nur Kopien aus mehrfachen oder überlappenden Importen (gleiches Konto, gleicher Tag, gleicher Betrag, gleiche Buchung). Deine eigenen Zuordnungen werden auf die behaltene Buchung übertragen, manuelle Buchungen bleiben unberührt."))return;
    const b={n:S.tx.length,sum:sumOf()};let n=0;
    mutate(()=>{n=dupCleanAll(S);applyRentMonths(S,resolveAll(S));},true);
    ui.dupRes={pairs:dupScan(S),before:b.n,after:S.tx.length,removed:n,sumB:b.sum,sumA:sumOf()};render();toast(n+" Duplikate entfernt");
  },
  useIncome:el=>{const v=+el.dataset.v;if(!(v>0))return;mutate(()=>{S.budget.income=v;},true);toast("Gehalt für die Richtwerte: "+fmt0(v));},
  posOk:()=>{const a=S.accounts.find(x=>x.id===ui.imp.acc);if(a){a.posOk=true;a.u=Date.now();}save();render();},
  posInv:()=>{const I=ui.imp,a=S.accounts.find(x=>x.id===I.acc);if(!a)return;a.inv=!a.inv;a.u=Date.now();save();if(I.src==="pdf")impBuildPdf();else impBuild(I.a);},
  reapply:()=>{
    if(!confirm("Regeln neu anwenden?\n\nAlle Zuordnungen, die aus Regeln stammen, werden neu berechnet. Einzeln von dir gesetzte Zuordnungen und manuelle Buchungen bleiben."))return;
    let n=0;mutate(()=>{n=reapplyRules(S);applyRentMonths(S,resolveAll(S));},false);toast(n+" Zuordnungen neu berechnet");
  },
  ownYes:el=>mutate(()=>{S.profile.myNames=[...new Set([...(S.profile.myNames||[]),el.dataset.k])];},true),
  ownNo:el=>mutate(()=>{S.profile.skipNames=[...(S.profile.skipNames||[]),el.dataset.k];},true),
  salYes:el=>{const sc=detectSalary(S,cmap());if(!sc||sc.k!==el.dataset.k)return;mutate(()=>{addRule(sc.k,INCOME,{in:1});if(!(S.profile.income>0))S.profile.income=sc.amt;},true);toast("Gehalt erkannt: Regel auf den Absender angelegt");},
  avgN:el=>{ui.avgN=+el.dataset.n;render();},
  einn:()=>{ui.sheet={t:"einn"};render();},
  cntInc:el=>{const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;mutate(()=>{t.c=INCOME;t.nt=1;t.u=Date.now();});toast("Zählt jetzt als Einnahme");},
  moHere:el=>{const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;mutate(()=>{t.mo=ui.month;t.u=Date.now();});toast("Zählt jetzt im "+MON[+ui.month.slice(5,7)-1]);},
  moReset:el=>{const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;mutate(()=>{t.mo=undefined;t.u=Date.now();});toast("Zählt wieder im Buchungsmonat");},
  impFlip:el=>{const I=ui.imp,i=+el.dataset.i;if(I.flips.has(i))I.flips.delete(i);else I.flips.add(i);impBuildPdf();},
  impFlipAll:()=>{const I=ui.imp;I.rows.forEach((r,i)=>{if(r.guess){if(I.flips.has(i))I.flips.delete(i);else I.flips.add(i);}});impBuildPdf();},
  diag:()=>{ui.sheet=null;ui.tab="more";ui.det.diag=true;render();window.scrollTo(0,0);},
  incList:()=>{ui.sheet={t:"inc"};render();},
  catd:el=>{ui.sheet={t:"catdet",i:+el.dataset.i};render();},
  allCats:()=>{ui.allCats=!ui.allCats;render();},
  umb:()=>{ui.sheet={t:"umb"};render();},
  incSkip:()=>{META.incSkip=true;saveMeta();render();},
  incPick:el=>{const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;mutate(()=>{if(t.amt>0)addRule(norm(t.p||merchantKey(t)).slice(0,30)||merchantKey(t),INCOME,{in:1});else addRule(merchantKey(t),INCOME);t.c=INCOME;t.u=Date.now();if(!(S.profile.income>0))S.profile.income=t.amt;},true);toast("Gehalt erkannt: Regel angelegt");},
  txNt:el=>{const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;mutate(()=>{t.nt=t.nt?undefined:1;if(t.c===TRANSFER)t.c=undefined;t.u=Date.now();ui.sheet=null;});toast(t.nt?"Zählt jetzt als normale Buchung (siehe Sortieren)":"Wird wieder automatisch erkannt");},
  impGo:el=>{ui.sheet=null;ui.tab=el.dataset.t;render();window.scrollTo(0,0);},
  sortMode:el=>{ui.sort.mode=el.dataset.m;render();},
  sortSkip:el=>{ui.sort.skip[ui.sort.mode+el.dataset.k]=1;render();},
  sortReset:()=>{ui.sort.skip={};render();},
  sortCat:el=>{
    const mode=ui.sort.mode,key=el.dataset.k,c=el.dataset.c,kw=(($("#alwk")||{}).value||key).trim();
    const g=sortLists()[mode==="in"?"inn":"out"].find(x=>x.k===key);if(!g)return;
    let mk=!!kw;if(mk){const b=ruleBreadth(S,kw);if(b.broad&&!confirm("Diese Regel trifft sehr viele Buchungen ("+b.n+" Buchungen, "+b.d+" Händler"+(b.short?", Stichwort sehr kurz":"")+"). Trotzdem für alle anlegen?"))mk=false;}
    mutate(()=>{for(const t of g.tx){t.c=c;t.rl=1;t.u=Date.now();}if(mk)addRule(kw,c);ui.sort.done[mode]++;},true);
  },
  tab:el=>{ui.tab=el.dataset.t;render();window.scrollTo(0,0);},
  mprev:()=>{ui.month=shiftYM(ui.month,-1);ui.openCat=null;render();},
  mnext:()=>{ui.month=shiftYM(ui.month,1);ui.openCat=null;render();},
  cat:el=>{ui.openCat=ui.openCat===el.dataset.c?null:el.dataset.c;render();},
  
  tx:el=>{ui.sheet={hs:[el.dataset.h]};render();},
  grp:el=>{const cm=cmap(),k=el.dataset.k;ui.sheet={hs:S.tx.filter(t=>cm.get(t.h)==null&&merchantKey(t)===k).map(t=>t.h)};render();},
  sheetClose:()=>{ui.sheet=null;render();},
  setcat:el=>{
    const sh=ui.sheet,c=el.dataset.c,always=$("#alw")&&$("#alw").checked,kw=($("#alwk")||{}).value||"";
    let mk=!!(c&&always&&kw.trim());
    if(mk){const b=ruleBreadth(S,kw);if(b.broad&&!confirm("Diese Regel trifft sehr viele Buchungen ("+b.n+" Buchungen, "+b.d+" Händler"+(b.short?", Stichwort sehr kurz":"")+"). Trotzdem für alle anlegen?"))mk=false;}
    mutate(()=>{
      for(const h of sh.hs){const t=S.tx.find(x=>x.h===h);if(t){t.c=c||undefined;t.u=Date.now();if(c){if(mk||sh.hs.length>1){t.rl=1;t.mn=undefined;}else{t.mn=1;t.rl=undefined;}}else{t.mn=undefined;t.rl=undefined;}}}
      if(mk)addRule(kw,c);
      ui.sheet=null;
    },mk);
    toast(c?"Kategorie: "+c+(always?" (Regel angelegt)":""):"Automatisch zugeordnet");
  },
  txDel:el=>{if(!confirm("Diese Buchung löschen?"))return;mutate(()=>{S.tx=S.tx.filter(t=>t.h!==el.dataset.h);S.del.push(el.dataset.h);ui.sheet=null;},true);},
  mode:el=>mutate(()=>{S.budget.mode=el.dataset.m;},true),
  theme:el=>{META.theme=el.dataset.v;saveMeta();applyTheme();render();},
  impAcc:el=>{ui.imp.acc=el.dataset.id;ui.imp.stage="in";ui.imp.msg="";render();},
  impText:()=>{const v=($("#csvt")||{}).value||"";if(!v.trim()){ui.imp.msg="Bitte Text einfügen.";render();return;}impLoad(v);},
  impCancel:()=>{ui.imp.stage="in";ui.imp.msg="";ui.imp.unrec=null;render();},
  pdfYear:()=>{const y=parseInt(($("#pdfYear")||{}).value,10);if(!(y>=1990&&y<=2100)){toast("Bitte ein gültiges Jahr eingeben");return;}ui.imp.pdf.year=y;impBuildPdf();},
  impOk:()=>impCommit(),
  mapOk:()=>{
    const I=ui.imp,c=I.cols;
    if(c.date==null||(c.amount==null&&c.soll==null&&c.haben==null)){I.msg="Datum und Betrag (oder Soll/Haben) sind Pflicht.";render();return;}
    const acc=S.accounts.find(x=>x.id===I.acc);
    acc.map={hr:I.hr,cols:Object.assign({},c),n:I.a.rows[I.hr].length};acc.u=Date.now();
    impBuild({delim:I.a.delim,rows:I.a.rows,hr:I.hr,cols:c,ok:true});save();
  },
  accAdd:()=>{const v=($("#newAcc").value||"").trim();if(!v)return;mutate(()=>{S.accounts.push({id:uid(),name:v,inv:false,map:null,u:Date.now()});ui.det.acc=true;});},
  accDel:el=>{const a=S.accounts.find(x=>x.id===el.dataset.id);if(!a||!confirm("Konto „"+a.name+"“ samt allen Buchungen löschen?"))return;
    mutate(()=>{S.accounts=S.accounts.filter(x=>x.id!==a.id);S.tx=S.tx.filter(t=>t.a!==a.id);S.del.push("acc:"+a.id);delete S.vault.ov[a.id];},true);},
  catAdd:()=>{const v=($("#newCat").value||"").trim();if(!v||S.cats.includes(v))return;mutate(()=>{S.cats.push(v);ensureItems(S);ui.det.cat=true;},true);},
  catDel:el=>{const c=S.cats[+el.dataset.i];if(!confirm("Kategorie „"+c+"“ löschen? Zugehörige Buchungen landen wieder in „Zu sortieren“."))return;
    mutate(()=>{S.cats.splice(+el.dataset.i,1);S.rules=S.rules.filter(r=>r.c!==c);for(const t of S.tx)if(t.c===c){t.c=undefined;t.u=Date.now();}for(const it of S.budget.items)it.cats=it.cats.filter(x=>x!==c);},true);},
  ruleAdd:()=>{const k=($("#newRk").value||"").trim(),c=$("#newRc").value;if(!k||!c)return;mutate(()=>{addRule(k,c);ui.det.rul=true;},true);},
  ruleDel:el=>mutate(()=>{S.rules.splice(+el.dataset.i,1);},true),
  ruleDefaults:()=>mutate(()=>{const have=new Set(S.rules.map(r=>norm(r.k)+"|"+r.c));for(const r of expandRules())if(!have.has(norm(r.k)+"|"+r.c)&&S.cats.includes(r.c))S.rules.push(r);},true),
  budReset:()=>{if(!confirm("Alle Plan-Werte leeren? Danach gilt der Durchschnitt Deutschland als Richtwert."))return;mutate(()=>{const m=S.budget.mode;S.budget=neutralBudget();S.budget.mode=m;ensureItems(S);},true);},
  demo:()=>{
    const d=makeDemo(todayStr());
    mutate(()=>{for(const a of d.accs)if(!S.accounts.some(x=>x.id===a.id))S.accounts.push(a);const k=new Set(S.tx.map(t=>t.h));for(const t of d.tx)if(!k.has(t.h))S.tx.push(t);
      S.del=S.del.filter(x=>!d.tx.some(t=>t.h===x));ui.month=lastDataMonth();ui.tab="ov";},true);
    toast("Demo-Daten geladen");
  },
  demoDel:()=>{if(!confirm("Alle Demo-Daten löschen?"))return;
    mutate(()=>{const dh=S.tx.filter(t=>t.demo).map(t=>t.h);S.del.push(...dh);S.tx=S.tx.filter(t=>!t.demo);for(const a of S.accounts.filter(a=>a.demo))S.del.push("acc:"+a.id);S.accounts=S.accounts.filter(a=>!a.demo);},true);},
  export:()=>{
    const withV=$("#expV")?$("#expV").checked:true,st=JSON.parse(JSON.stringify(S));
    if(!withV){st.vault={pin:null,ov:{},free:[],hist:{}};}
    const blob=new Blob([JSON.stringify({app:"finanzplaner",v:1,exp:new Date().toISOString(),state:st})],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="finanzplaner-backup-"+todayStr()+".json";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);
  },
  wipe:async()=>{
    if(!confirm("Wirklich ALLE Daten auf diesem Gerät löschen (Buchungen, Regeln, Tresor)? Das kann nicht rückgängig gemacht werden."))return;
    if(!confirm("Letzte Bestätigung: alles löschen?"))return;
    syncStop();META.pass=null;await saveMeta();
    S=newState();VER++;await kvSet("state",S);ui.month=nowYM();ui.openCat=null;ui.sheet=null;toast("Alles gelöscht");render();maybeWizard();
  },
  syNew:()=>syConnect(false),syJoin:()=>syConnect(true),
  syOff:()=>{syncStop();META.pass=null;saveMeta();setSy("aus","");render();},
  syNow:()=>{if(SY.ready)pushNow();else syncStart();},
  vault:()=>vaultOpen(),
  hintDismiss:()=>{
    const lights=budgetLights(S,ui.month,cmap(),todayStr());
    META.ampelSeen=META.ampelSeen||{};
    for(const L of lights)META.ampelSeen[ui.month+"|"+L.name]=L.am;
    saveMeta();render();
  },
  notifyOn:async()=>{
    if(!("Notification" in window)){toast("Dieses Gerät unterstützt keine Mitteilungen. Der Hinweis in der App bleibt.");return;}
    let p=Notification.permission;
    try{if(p==="default")p=await Notification.requestPermission();}catch(e){p="denied";}
    if(p!=="granted"){toast("Mitteilungen sind blockiert. Der Hinweis bleibt in der App.");return;}
    META.notify=true;await saveMeta();toast("Mitteilungen sind an, solange die App geöffnet ist.");render();
  },
  notifyOff:()=>{META.notify=false;saveMeta();toast("Mitteilungen aus");render();},
  goalAdd:()=>{
    const n=($("#gn").value||"").trim(),target=parseNum($("#gt").value,true),by=String(($("#gb")||{}).value||"").slice(0,7);
    const have=parseNum($("#gh").value,true),cat=($("#gc")||{}).value||"";
    if(!n||!(target>0)){toast("Name und Zielbetrag brauchen einen Wert.");return;}
    if(by&&!/^\d{4}-\d{2}$/.test(by)){toast("Bitte einen Zielmonat wählen.");return;}
    const g={id:uid(),n,target,by,have:have>0?have:0,cat};
    mutate(()=>{if(!Array.isArray(S.goals))S.goals=[];S.goals.push(g);},true);
    toast(goalPhrase(goalView(g,g.have,todayStr())));
  },
  goalDel:el=>mutate(()=>{S.goals=(S.goals||[]).filter(g=>g.id!==el.dataset.id);},true),
  yearPick:el=>{ui.year=el.dataset.y;render();},
  csvExport:()=>{
    doCsv({cat:($("#csvCat")||{}).value||"all",year:($("#csvYear")||{}).value||"all",sign:($("#csvSign")||{}).value||"all"});
  },
  csvCat:el=>{
    const it=S.budget.items[+el.dataset.i];if(!it)return;
    doCsv({cats:it.cats,year:ui.month.slice(0,4),sign:"all",name:it.n});
  }
};
const CH={
  myNames:el=>{const v=el.value.split(",").map(x=>norm(x)).filter(x=>x.length>=5);mutate(()=>{S.profile.myNames=v;},true);},
  income:el=>{const v=parseNum(el.value,true);mutate(()=>{S.budget.income=v>0?v:null;},true);},
  planInc:el=>{const v=parseNum(el.value,true);if(v>0)mutate(()=>{S.budget.planIncome=v;},true);},
  thrG:el=>{const v=parseNum(el.value,true);if(v>0)mutate(()=>{S.budget.g=v;},true);},
  thrR:el=>{const v=parseNum(el.value,true);if(v>0)mutate(()=>{S.budget.r=v;},true);},
  bPlan:el=>{const v=parseNum(el.value,true);mutate(()=>{S.budget.items[+el.dataset.i].plan=v>=0?v:null;},true);},
  bPct:el=>{const v=parseNum(el.value,true);mutate(()=>{S.budget.items[+el.dataset.i].pct=v>=0?v:null;},true);},
  accName:el=>{const v=el.value.trim();if(!v)return;mutate(()=>{const a=S.accounts.find(x=>x.id===el.dataset.id);a.name=v;a.u=Date.now();},true);},
  accInv:el=>mutate(()=>{const a=S.accounts.find(x=>x.id===el.dataset.id);a.inv=el.checked;a.u=Date.now();},true),
  catName:el=>{const v=el.value.trim(),i=+el.dataset.i,old=S.cats[i];if(!v||v===old||S.cats.includes(v)){render();return;}
    mutate(()=>{S.cats[i]=v;for(const r of S.rules)if(r.c===old)r.c=v;for(const t of S.tx)if(t.c===old){t.c=v;t.u=Date.now();}for(const it of S.budget.items)it.cats=it.cats.map(x=>x===old?v:x);},true);},
  inv:el=>{const I=ui.imp,acc=S.accounts.find(x=>x.id===I.acc);acc.inv=el.checked;acc.u=Date.now();save();if(I.src==="pdf")impBuildPdf();else impBuild(I.a);},
  mapHr:el=>{ui.imp.hr=+el.value;ui.imp.cols=mapHeader(ui.imp.a.rows[ui.imp.hr]||[]);render();},
  takeMaybe:el=>{ui.imp.takeMaybe=el.checked;render();},
  mapCol:el=>{ui.imp.cols[el.dataset.f]=el.value===""?undefined:+el.value;}
};

/* ---------- Einrichtungs-Assistent (3 Schritte, überspringbar, wiederholbar unter Mehr) ---------- */
const FX_SUG=[["Miete","Miete"],["Strom/Gas","Strom/Gas"],["Internet","Handy/Internet"],["Handy","Handy/Internet"],["Versicherungen","Versicherungen"],["Auto-Rate","Auto"],["Abos","Abos"],["Kredit/Raten","Kredit/Raten"],["Sparrate","Sparen"],["Sonstiges fest","Sonstiges"]];
const fxCats=()=>{const a=S.cats.filter(c=>c!==INCOME&&c!==TRANSFER);for(const [,c] of FX_SUG)if(!a.includes(c))a.push(c);return a;};
const varItems=()=>S.budget.items.map((it,i)=>({it,i})).filter(({it})=>!it.fix&&!it.goal&&fixedSum(S,it)===0);
function wizOpen(step){
  const inc=S.profile.income||S.budget.income||S.budget.planIncome||"";
  const W={step:step||1,income:inc?String(inc):"",fixed:S.fixed.map(f=>Object.assign({},f)),vars:{},done:{}};
  for(const {it,i} of varItems())W.vars[i]=it.plan>0?String(it.plan):"";
  ui.wiz=W;renderWiz();
}
function collectWiz(){
  const W=ui.wiz;if(!W)return;
  document.querySelectorAll("#wiz [data-wi]").forEach(el=>{
    const k=el.dataset.wi;
    if(k==="income")W.income=el.value;
    else if(k==="var")W.vars[el.dataset.i]=el.value;
    else{const f=W.fixed.find(x=>x.id===el.dataset.id);if(f){if(k==="fn")f.n=el.value;else if(k==="fa")f.amt=el.value;else if(k==="fc")f.cat=el.value;}}
  });
}
const wizInc=()=>parseNum(ui.wiz.income,true);
function renderWiz(){
  const el=$("#wiz"),W=ui.wiz;
  if(!W){el.innerHTML="";el.classList.remove("on");return;}
  el.classList.add("on");
  const inc=wizInc(),head=`<div class="vhead"><p class="muted small">Einrichtung · Schritt ${W.step} von 3</p><button class="btn s" data-a="wizClose">Schließen</button></div>`;
  let b="";
  if(W.step===1){
    b=`<h2 class="big">Wie hoch ist dein Nettoeinkommen?</h2><p class="muted">Pro Monat, nach Steuern. Die App nutzt es für die Vergleichswerte, bis sie dein Gehalt in den Buchungen erkennt.</p>
    <label class="fld">Nettoeinkommen pro Monat (€)<input inputmode="decimal" data-wi="income" value="${esc(W.income)}" placeholder="z. B. 2400" aria-label="Nettoeinkommen pro Monat"></label>
    <div class="stickybar"><button class="btn p w" data-a="wizNext">Weiter</button><button class="btn" data-a="wizSkip">Überspringen</button></div>`;
  }else if(W.step===2){
    const sum=W.fixed.reduce((s,f)=>s+(parseNum(f.amt,true)||0),0);
    b=`<h2 class="big">Welche festen Kosten hast du?</h2><p class="muted">Was jeden Monat ungefähr gleich abgeht. Tippe auf einen Vorschlag und trage den Betrag ein.</p>
    <div class="chips wrapc">${FX_SUG.map(([n],i)=>`<button data-a="wizAddFx" data-s="${i}">+ ${esc(n)}</button>`).join("")}<button data-a="wizAddFx" data-s="-1">+ Eigener Posten</button></div>
    ${W.fixed.map(f=>`<div class="fxr"><input class="nm" data-wi="fn" data-id="${esc(f.id)}" value="${esc(f.n)}" placeholder="Name" aria-label="Name"><input inputmode="decimal" data-wi="fa" data-id="${esc(f.id)}" value="${esc(f.amt)}" placeholder="Betrag €" aria-label="Betrag in Euro"><select data-wi="fc" data-id="${esc(f.id)}" aria-label="Kategorie">${fxCats().map(c=>`<option value="${esc(c)}" ${c===f.cat?"selected":""}>${esc(c)}</option>`).join("")}</select><button class="btn s" data-a="wizDelFx" data-id="${esc(f.id)}" aria-label="Posten löschen">×</button></div>`).join("")}
    ${W.fixed.length?`<p class="kv tot"><span>Feste Kosten gesamt</span><b class="num">${fmt0(sum)}</b></p>`:`<p class="muted small">Noch nichts eingetragen. Du kannst das auch später unter Mehr, Feste Kosten tun.</p>`}
    <div class="stickybar"><button class="btn p w" data-a="wizNext">Weiter</button><button class="btn" data-a="wizBack">Zurück</button><button class="btn" data-a="wizSkip">Überspringen</button></div>`;
  }else{
    b=`<h2 class="big">Wie viel willst du ausgeben?</h2><p class="muted">Wunsch-Limit pro Monat. Leer lassen = Vorschlag: der Durchschnitt Deutschland, umgerechnet auf ${inc>0?"dein Einkommen ("+fmt0(inc)+")":"dein Einkommen (bitte in Schritt 1 angeben)"}. Er dient nur als grobe Orientierung.</p>
    ${varItems().map(({it,i})=>{const sg=suggestFor(it,inc);return `<label class="fld">${esc(it.n)}<input inputmode="decimal" data-wi="var" data-i="${i}" value="${esc(W.vars[i]||"")}" placeholder="${sg!=null?"Vorschlag "+sg+" €":"Limit in €"}" aria-label="Limit ${esc(it.n)}"></label>`;}).join("")}
    <button class="btn w" data-a="wizSug">Vorschlag für alle leeren Felder nehmen</button>
    <div class="stickybar"><button class="btn p w" data-a="wizNext">Fertig</button><button class="btn" data-a="wizBack">Zurück</button></div>`;
  }
  el.innerHTML=`<div class="ovin" role="dialog" aria-modal="true" aria-label="Einrichtung">${head}${b}</div>`;
}
function wizFinish(){
  const W=ui.wiz;
  mutate(()=>{
    if(W.done[1]){const v=wizInc();S.profile.income=v>0?v:null;}
    if(W.done[2]){
      const list=W.fixed.map(f=>({id:f.id,n:(f.n||"").trim(),amt:parseNum(f.amt,true),cat:f.cat})).filter(f=>f.n&&f.amt>0);
      for(const f of list)if(!S.cats.includes(f.cat))S.cats.push(f.cat);
      S.fixed=list;ensureItems(S);
    }
    if(W.done[3])for(const {it,i} of varItems()){const raw=W.vars[i],v=parseNum(raw,true);if(raw!==undefined&&raw!=="")it.plan=v>0?v:null;else if(raw===""&&it.plan>0&&W.done[3])it.plan=null;}
    S.profile.setupDone=true;ui.wiz=null;
  },true);
  renderWiz();ui.tab="ov";render();toast("Einrichtung gespeichert");window.scrollTo(0,0);
}
function maybeWizard(){if(S&&!S.profile.setupDone&&!ui.wiz)wizOpen(1);}
const WACT={
  wizOpen:()=>wizOpen(1),
  wizClose:()=>{ui.wiz=null;if(!S.profile.setupDone){S.profile.setupDone=true;VER++;save();}renderWiz();render();},
  wizNext:()=>{collectWiz();const W=ui.wiz;W.done[W.step]=true;if(W.step<3){W.step++;renderWiz();window.scrollTo(0,0);}else wizFinish();},
  wizSkip:()=>{collectWiz();const W=ui.wiz;if(W.step<3){W.step++;renderWiz();}else wizFinish();},
  wizBack:()=>{collectWiz();if(ui.wiz.step>1){ui.wiz.step--;renderWiz();}},
  wizAddFx:el=>{collectWiz();const s=+el.dataset.s,sg=FX_SUG[s];ui.wiz.fixed.push({id:uid(),n:sg?sg[0]:"",amt:"",cat:sg?sg[1]:"Sonstiges"});renderWiz();},
  wizDelFx:el=>{collectWiz();ui.wiz.fixed=ui.wiz.fixed.filter(f=>f.id!==el.dataset.id);renderWiz();},
  wizSug:()=>{collectWiz();const inc=wizInc();for(const {it,i} of varItems()){const sg=suggestFor(it,inc);if(sg!=null&&!ui.wiz.vars[i])ui.wiz.vars[i]=String(sg);}renderWiz();},
  fxAdd:()=>{
    const n=($("#fxn").value||"").trim(),a=parseNum($("#fxa").value,true),c=$("#fxc").value;
    if(!n||!(a>0)){toast("Name und Betrag eintragen");return;}
    mutate(()=>{if(!S.cats.includes(c))S.cats.push(c);S.fixed.push({id:uid(),n,amt:a,cat:c});ensureItems(S);ui.det.fixed=true;},true);
  },
  fxDel:el=>mutate(()=>{S.fixed=S.fixed.filter(f=>f.id!==el.dataset.id);},true),
  recAdd:el=>{
    const r=detectRecurring(S,cmap()).find(x=>x.k===el.dataset.k);if(!r)return;
    const cat=r.cat&&r.cat!==INCOME&&r.cat!==TRANSFER?r.cat:"Sonstiges";
    mutate(()=>{S.fixed.push({id:uid(),n:r.interval>1?r.name+" (alle "+r.interval+" Monate)":r.name,amt:r.amt,cat});ui.det.fixed=true;},true);toast("Als feste Kosten übernommen");
  },
  recNo:el=>mutate(()=>{S.profile.skipRec.push(el.dataset.k);},true),
  fixedOpen:()=>{ui.tab="more";ui.det.fixed=true;render();window.scrollTo(0,0);}
};
const WCH={
  fxName:el=>{const v=el.value.trim();if(v)mutate(()=>{S.fixed.find(f=>f.id===el.dataset.id).n=v;},true);},
  fxAmt:el=>{const v=parseNum(el.value,true);if(v>0)mutate(()=>{S.fixed.find(f=>f.id===el.dataset.id).amt=v;},true);else render();},
  fxCat:el=>mutate(()=>{const c=el.value;if(!S.cats.includes(c))S.cats.push(c);S.fixed.find(f=>f.id===el.dataset.id).cat=c;ensureItems(S);},true),
  profInc:el=>{const v=parseNum(el.value,true);mutate(()=>{S.profile.income=v>0?v:null;},true);}
};
Object.assign(ACT,WACT);Object.assign(CH,WCH);

/* ---------- v6: Kontofilter, Kreisdiagramm, manuelle Buchungen, Import-Leitfaden ---------- */
const viewS=()=>ui.acc==="all"?S:Object.assign({},S,{tx:S.tx.filter(t=>t.a===ui.acc),pend:(S.pend||[]).filter(t=>t.a===ui.acc)});
/* Kategorie vorgemerkter Buchungen (zaehlen nicht, werden nur angezeigt) */
const pendCats=()=>resolveAll(Object.assign({},S,{tx:S.pend||[]}));
const STATUS=t=>t.pv?"vorgemerkt":(t.man?"manuell":(pdfLike(t)?"aus PDF":"gebucht"));
function accFilterHtml(){
  const accs=S.accounts.filter(a=>S.tx.some(t=>t.a===a.id));
  if(accs.length<2)return "";
  if(ui.acc!=="all"&&!accs.some(a=>a.id===ui.acc))ui.acc="all";
  return `<div class="chips" role="group" aria-label="Konto filtern"><button data-a="accF" data-id="all" aria-pressed="${ui.acc==="all"}">Alle Konten</button>${accs.map(a=>`<button data-a="accF" data-id="${esc(a.id)}" aria-pressed="${ui.acc===a.id}">${esc(a.name)}</button>`).join("")}</div>`+
    (ui.acc!=="all"?`<p class="muted small">Nur ${esc(accName(ui.acc))}. Umbuchungen werden weiter über alle Konten erkannt.</p>`:"");
}
const segLabel=(mode,key)=>key==="(unsortiert)"?"Unsortiert":key==="__more"?"Weitere":key==="__other"?"Weitere Eingänge":mode==="acc"?accName(key):catLabel(key);
const pctTxt=p=>(p<10?p.toFixed(1).replace(".",","):String(Math.round(p)))+" %";
function segTx(SV,ym,cm,mode,key){
  const D=donutData(SV,ym,cm,mode),seg=D.segs.find(s=>s.key===key);
  const keys=key==="__more"?(seg?seg.members.map(m=>m.key):[]):[key],list=[];
  for(const t of SV.tx){
    if(mkey(t)!==ym)continue;const c=cm.get(t.h);if(c===TRANSFER)continue;let k;
    if(mode==="in"){if(t.amt<=0)continue;k=c==null?"(unsortiert)":c;}
    else if(mode==="acc"){if(t.amt>=0)continue;k=t.a;}
    else{if(t.amt>=0)continue;k=c==null?"(unsortiert)":c;}
    if(keys.includes(k))list.push(t);
  }
  return {D,seg,list:list.sort((a,b)=>Math.abs(b.amt)-Math.abs(a.amt))};
}
function donutCard(SV,cm,ym){
  const P=ui.pie,D=donutData(SV,ym,cm,P.mode),ML={out:"Ausgaben",in:"Einnahmen",acc:"Konten"};
  let h=`<section class="card"><div class="chips" role="group" aria-label="Diagramm">${["out","in","acc"].map(m=>`<button data-a="pieMode" data-m="${m}" aria-pressed="${P.mode===m}">${ML[m]}</button>`).join("")}</div>`;
  if(!D.total)return h+`<p class="muted">Keine ${P.mode==="in"?"Einnahmen":"Ausgaben"} in diesem Monat.</p></section>`;
  const R=70,CI=2*Math.PI*R;let off=0;
  const circ=D.segs.map(s=>{
    const len=s.amt/D.total*CI,el=`<circle cx="100" cy="100" r="${R}" fill="none" stroke="${s.color}" stroke-width="30" stroke-dasharray="${len.toFixed(2)} ${(CI-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 100 100)" data-a="seg" data-k="${esc(s.key)}" role="button" tabindex="0" aria-label="${esc(segLabel(P.mode,s.key))}: ${fmt0(s.amt)}, ${pctTxt(s.pct)}"/>`;
    off+=len;return el;
  }).join("");
  h+=`<svg viewBox="0 0 200 200" class="donut" role="group" aria-label="${ML[P.mode]} ${mLabel(ym)}, Gesamt ${fmt0(D.total)}. Die Liste darunter enthält dieselben Werte.">${circ}<text x="100" y="98" text-anchor="middle" class="dtot">${fmt0(D.total)}</text><text x="100" y="118" text-anchor="middle" class="dlab">${P.mode==="in"?"Einnahmen":P.mode==="acc"?"nach Konto":"Ausgaben"}</text></svg><ul class="plist">`;
  for(const s of D.segs){
    h+=`<li><button data-a="seg" data-k="${esc(s.key)}" aria-label="${esc(segLabel(P.mode,s.key))}, ${fmt0(s.amt)}, ${pctTxt(s.pct)}${s.key==="__more"?", aufklappen":", Buchungen anzeigen"}"><i class="dot" style="background:${s.color}"></i><span class="pn">${esc(segLabel(P.mode,s.key))}${s.key==="__more"?` (${s.members.length}) ${P.more?"▴":"▾"}`:""}</span><span class="num">${fmt0(s.amt)}</span><span class="pp num">${pctTxt(s.pct)}</span></button></li>`;
    if(s.key==="__more"&&P.more)for(const m of s.members)h+=`<li class="sub"><button data-a="seg" data-k="${esc(m.key)}"><i class="dot" style="background:${m.color}"></i><span class="pn">${esc(segLabel(P.mode,m.key))}</span><span class="num">${fmt0(m.amt)}</span><span class="pp num">${pctTxt(m.pct)}</span></button></li>`;
  }
  return h+`</ul></section>`;
}
/* ---------- Eigene Buchung / Dauerposten ---------- */
function collectAdd(){
  const A=ui.add;if(!A||!$("#man-amt"))return;
  A.amt=$("#man-amt").value;A.cat=$("#man-cat").value;A.date=$("#man-date").value||A.date;A.note=$("#man-note").value;A.acc=$("#man-acc").value;A.rep=$("#man-rep").checked;A.end=$("#man-end").value;
}
function addHtml(){
  const A=ui.add,accs=S.accounts.filter(a=>!a.virtual),cats=S.cats.filter(c=>c!==TRANSFER),editing=!!(A.edit||A.recId);
  return `<p class="big">${editing?"Eintrag bearbeiten":"Eigene Buchung hinzufügen"}</p>
  <div class="chips" role="group" aria-label="Art"><button data-a="manType" data-m="out" aria-pressed="${A.type==="out"}">Ausgabe</button><button data-a="manType" data-m="in" aria-pressed="${A.type==="in"}">Einnahme</button></div>
  <label class="fld">Betrag (€)<input id="man-amt" inputmode="decimal" value="${esc(A.amt)}" placeholder="0,00"></label>
  <label class="fld">Kategorie<select id="man-cat">${cats.map(c=>`<option value="${esc(c)}" ${c===A.cat?"selected":""}>${esc(catLabel(c))}</option>`).join("")}</select></label>
  <label class="fld">Datum<input id="man-date" type="date" value="${esc(A.date)}"></label>
  <label class="fld">Notiz (optional)<input id="man-note" value="${esc(A.note)}" placeholder="z. B. Bargeld, Flohmarkt"></label>
  <label class="fld">Konto<select id="man-acc"><option value="man" ${A.acc==="man"?"selected":""}>Bar / Sonstiges</option>${accs.map(a=>`<option value="${esc(a.id)}" ${A.acc===a.id?"selected":""}>${esc(a.name)}</option>`).join("")}</select></label>
  <label class="chk"><input type="checkbox" id="man-rep" ${A.rep?"checked":""}> Jeden Monat wiederholen (Dauerposten, ab dem Datum)</label>
  <label class="fld">Wiederholen bis (optional)<input id="man-end" type="date" value="${esc(A.end||"")}"></label>
  <div class="row"><button class="btn p" data-a="manSave">Speichern</button>${editing?`<button class="btn s dang" data-a="manDel">Löschen</button>`:""}<button class="btn" data-a="sheetClose">Abbrechen</button></div>`;
}
const newAdd=()=>({type:"out",amt:"",cat:"Sonstiges",date:todayStr(),note:"",acc:"man",rep:false,end:"",edit:null,recId:null});
/* ---------- Import-Leitfaden mit Abdeckung ---------- */
function guideHtml(){
  const cp=commonPeriod(S);
  let h=`<details class="dt card" data-id="guide" ${ui.det.guide===false?"":"open"}><summary>Sauber importieren</summary><div class="dbody"><ol class="steps"><li>Wähle für <b>alle Konten denselben Zeitraum</b>, z. B. die letzten 3 oder 6 Monate.</li><li>Nimm jeweils <b>ganze Monate</b>: vom 1. bis zum Monatsletzten.</li><li>Importiere alle Konten und prüfe hier die Abdeckung.</li></ol>`;
  if(!cp)return h+`<p class="muted small">Noch keine Buchungen importiert.</p></div></details>`;
  const mn=cp.accs.reduce((m,a)=>a.first<m?a.first:m,"9999-99-99"),mx=cp.accs.reduce((m,a)=>a.last>m?a.last:m,""),span=Math.max(1,dayNum(mx)-dayNum(mn));
  h+=`<h3 class="sec">Abdeckung je Konto</h3>`+cp.accs.map(a=>{const l=(dayNum(a.first)-dayNum(mn))/span*100,w=Math.max(2,(dayNum(a.last)-dayNum(a.first))/span*100);
    return `<div class="cov"><div class="kv small"><span>${esc(a.name)}</span><span>${dl2(a.first)} bis ${dl2(a.last)}${cp.inactive.includes(a)?" (nicht mehr aktuell)":""}</span></div><div class="covbar" role="img" aria-label="${esc(a.name)}: ${dl2(a.first)} bis ${dl2(a.last)}"><i style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}%"></i></div></div>`;}).join("");
  h+=cp.act.length>1||cp.ok?(cp.ok?`<p class="status">Gemeinsamer Zeitraum aller Konten: <b>${dl2(cp.from)} bis ${dl2(cp.to)}</b>.${cp.act.length>1?` Der Beginn wird von ${esc(cp.limFrom)} begrenzt, das Ende von ${esc(cp.limTo)}.`:""}</p>`:`<p class="err" role="alert">Kein gemeinsamer Zeitraum: ${esc(cp.limFrom)} beginnt erst am ${dl2(cp.from)}, ${esc(cp.limTo)} endet schon am ${dl2(cp.to)}.</p>`):"";
  for(const w of cp.warn)h+=`<p class="warnt">⚠ ${esc(w.name)} ist deutlich ${w.kind} als die anderen Konten. Lade für alle Konten denselben Zeitraum.</p>`;
  if(cp.lastMonth)h+=`<p class="muted small">Letzter Monat, für den alle Konten vollständig sind: <b>${mLabel(cp.lastMonth)}</b>.</p>`;
  else h+=`<p class="warnt">Noch kein Monat ist für alle Konten vollständig.</p>`;
  return h+`</div></details>`;
}
const V6ACT={
  accF:el=>{ui.acc=el.dataset.id;render();},
  pieMode:el=>{ui.pie.mode=el.dataset.m;ui.pie.more=false;render();},
  seg:el=>{const k=el.dataset.k;if(k==="__more"){ui.pie.more=!ui.pie.more;render();}else{ui.sheet={t:"seg",mode:ui.pie.mode,key:k};render();}},
  monthCommon:()=>{const cp=commonPeriod(S);if(cp&&cp.lastMonth){ui.month=cp.lastMonth;render();}},
  addOpen:()=>{ui.add=newAdd();ui.sheet={t:"add"};render();},
  manType:el=>{collectAdd();const A=ui.add;A.type=el.dataset.m;if(A.type==="in"&&A.cat==="Sonstiges")A.cat=INCOME;if(A.type==="out"&&A.cat===INCOME)A.cat="Sonstiges";render();},
  manEdit:el=>{const t=S.tx.find(x=>x.h===el.dataset.h);if(!t)return;ui.add=Object.assign(newAdd(),{type:t.amt>0?"in":"out",amt:String(Math.abs(t.amt)).replace(".",","),cat:t.c||"Sonstiges",date:t.d,note:t.p||"",acc:t.a,edit:t.h});ui.sheet={t:"add"};render();},
  recEdit:el=>{const r=S.recur.find(x=>x.id===(el.dataset.id||(S.tx.find(t=>t.h===el.dataset.h)||{}).rec));if(!r)return;ui.add=Object.assign(newAdd(),{type:r.amt>0?"in":"out",amt:String(Math.abs(r.amt)).replace(".",","),cat:r.cat,date:r.start,note:r.n,acc:r.a||"man",rep:true,end:r.end||"",recId:r.id});ui.sheet={t:"add"};render();},
  manSave:()=>{
    collectAdd();const A=ui.add,v=parseNum(A.amt,true);
    if(!(v>0)){toast("Bitte einen Betrag eintragen");return;}
    if(!A.date){toast("Bitte ein Datum wählen");return;}
    const amt=(A.type==="in"?1:-1)*v,note=(A.note||"").trim();
    mutate(()=>{
      if(A.rep){
        if(A.edit){const t=S.tx.find(x=>x.h===A.edit);if(t){S.del.push(t.h);S.tx=S.tx.filter(x=>x.h!==t.h);}}
        if(A.recId){const r=S.recur.find(x=>x.id===A.recId);if(r){Object.assign(r,{n:note||catLabel(A.cat),amt,cat:A.cat,a:A.acc,start:A.date,end:A.end||null,rev:(r.rev||1)+1});removeRecurTx(S,r.id);}}
        else S.recur.push({id:uid(),n:note||catLabel(A.cat),amt,cat:A.cat,a:A.acc,start:A.date,end:A.end||null,rev:1});
        materializeRecur(S,todayStr());
      }else if(A.edit){
        const t=S.tx.find(x=>x.h===A.edit);if(t){Object.assign(t,{amt,c:A.cat,d:A.date,p:note||catLabel(A.cat),a:A.acc,u:Date.now()});}
      }else S.tx.push({h:"man-"+uid(),a:A.acc,d:A.date,amt,p:note||catLabel(A.cat),t:"",c:A.cat,man:true,u:Date.now()});
      ui.sheet=null;ui.add=null;
      if(A.date.slice(0,7)<=nowYM()&&!A.rep)ui.month=A.date.slice(0,7);
    },true);
    toast(A.rep?"Dauerposten gespeichert":"Gespeichert");
  },
  manDel:()=>{
    const A=ui.add;if(!confirm(A.recId?"Dauerposten und alle seine Monatsbuchungen löschen?":"Diese Buchung löschen?"))return;
    mutate(()=>{
      if(A.recId){S.recur=S.recur.filter(r=>r.id!==A.recId);removeRecurTx(S,A.recId);}
      else if(A.edit){S.tx=S.tx.filter(t=>t.h!==A.edit);S.del.push(A.edit);}
      ui.sheet=null;ui.add=null;
    },true);
  },
  recDel:el=>{if(!confirm("Dauerposten und alle seine Monatsbuchungen löschen?"))return;mutate(()=>{S.recur=S.recur.filter(r=>r.id!==el.dataset.id);removeRecurTx(S,el.dataset.id);},true);},
  wipeTx:()=>{
    const n=S.tx.filter(t=>!t.man).length;
    if(!confirm("Alle "+n+" importierten Buchungen löschen?\n\nKonten, Kategorien, Regeln, Plan, feste Kosten, Profil und Tresor sowie deine manuellen Buchungen und Dauerposten bleiben erhalten.\n\nLade danach alle Konten für denselben Zeitraum neu."))return;
    mutate(()=>{wipeImported(S,Date.now());ui.sheet=null;},true);
    ui.tab="im";render();toast(n+" Buchungen gelöscht. Lade jetzt alle Konten für denselben Zeitraum neu.");window.scrollTo(0,0);
  }
};
Object.assign(ACT,V6ACT);

/* ---------- Tresor ---------- */
const V={open:false,unlocked:false,last:0,pin:"",step:"enter",first:"",fails:0,lockUntil:0,msg:"",busy:false};
const vaultTotal=()=>{let s=0;for(const a of S.accounts){const o=S.vault.ov[a.id];const v=o!=null?o:latestBal(S,a.id);if(v!=null)s+=v;}for(const f of S.vault.free)s+=+f.val||0;return s;};
function vaultOpen(){V.open=true;V.unlocked=false;V.pin="";V.msg="";V.step=S.vault.pin?"enter":"new";V.last=Date.now();renderOv();}
function vaultLock(){if(!V.open&&!V.unlocked)return;V.open=false;V.unlocked=false;V.pin="";V.first="";const o=$("#ov");o.innerHTML="";o.classList.remove("on");}
function snapVault(){const k=nowYM(),t=Math.round(vaultTotal()*100)/100;if(S.vault.hist[k]!==t){S.vault.hist[k]=t;S.cfgTs=Date.now();save();}}
function vaultChart(){
  const keys=Object.keys(S.vault.hist).sort();
  if(keys.length<2)return `<p class="muted small">Der Verlauf entsteht, sobald mindestens zwei Monate gespeichert sind.</p>`;
  const vals=keys.map(k=>S.vault.hist[k]),mn=Math.min(...vals),mx=Math.max(...vals),W=320,H=110,P=10,rg=(mx-mn)||1;
  const pts=keys.map((k,i)=>[P+i*(W-2*P)/(keys.length-1),H-P-(S.vault.hist[k]-mn)/rg*(H-2*P)]);
  return `<svg viewBox="0 0 ${W} ${H}" class="vch" role="img" aria-label="Vermögensverlauf pro Monat"><polyline fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" points="${pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ")}"/>${pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="currentColor"/>`).join("")}</svg><div class="kv small"><span>${mLabel(keys[0])}: ${fmt0(vals[0])}</span><span>${mLabel(keys[keys.length-1])}: ${fmt0(vals[vals.length-1])}</span></div>`;
}
function renderOv(){
  const o=$("#ov");
  if(!V.open){o.innerHTML="";o.classList.remove("on");return;}
  o.classList.add("on");
  if(!V.unlocked){
    const title=V.step==="new"?"Neue PIN festlegen (4–6 Ziffern)":V.step==="confirm"?"PIN wiederholen":"PIN eingeben";
    o.innerHTML=`<div class="ovin pinw" role="dialog" aria-modal="true" aria-label="Gesperrter Bereich"><p class="big cen">${title}</p><div class="dots" aria-live="polite" aria-label="${V.pin.length} Ziffern eingegeben">${[0,1,2,3,4,5].map(i=>`<i class="${i<V.pin.length?"f":""}"></i>`).join("")}</div><p class="err cen">${esc(V.msg)}</p>
    <div class="pad">${[1,2,3,4,5,6,7,8,9].map(k=>`<button data-a="pk" data-k="${k}">${k}</button>`).join("")}<button data-a="pc" aria-label="Schließen" class="sm">Zurück</button><button data-a="pk" data-k="0">0</button><button data-a="pb" aria-label="Löschen" class="sm">⌫</button></div>
    <button class="btn p w" data-a="pok" ${V.pin.length>=4?"":"disabled"}>OK</button></div>`;
    return;
  }
  const accRows=S.accounts.filter(a=>!a.virtual).map(a=>{const auto=latestBal(S,a.id),ov=S.vault.ov[a.id];return `<div class="erow"><span class="rk">${esc(a.name)}</span><input inputmode="decimal" data-vi="ov" data-id="${esc(a.id)}" value="${ov!=null?ov:(auto!=null?auto:"")}" placeholder="0" aria-label="Stand ${esc(a.name)}"></div>`;}).join("");
  const free=S.vault.free.map(f=>`<div class="erow b3"><input data-vi="fn" data-id="${esc(f.id)}" value="${esc(f.name)}" aria-label="Bezeichnung"><input inputmode="decimal" data-vi="fv" data-id="${esc(f.id)}" value="${f.val==null?"":f.val}" aria-label="Wert" placeholder="0"><button class="btn s" data-a="vfdel" data-id="${esc(f.id)}" aria-label="Posten löschen">×</button></div>`).join("");
  o.innerHTML=`<div class="ovin" role="dialog" aria-modal="true" aria-label="Tresor"><div class="vhead"><h2 class="sec">Tresor</h2><button class="btn s p" data-a="vlock">Sperren</button></div>
   <div class="tile big1"><span>Gesamtvermögen</span><b class="num">${fmt(vaultTotal())}</b></div>
   <h3 class="sec">Konten</h3>${accRows}<h3 class="sec">Weitere Posten (Depot, Trade Republic, Bargeld …)</h3>${free}
   <div class="erow b3"><input id="vfn" placeholder="Neuer Posten" aria-label="Neuer Posten"><input id="vfv" inputmode="decimal" placeholder="Wert" aria-label="Wert"><button class="btn s p" data-a="vfadd">+</button></div>
   <h3 class="sec">Verlauf</h3>${vaultChart()}<button class="btn w" data-a="vsnap">Stand für diesen Monat speichern</button><button class="btn w" data-a="vpin">PIN ändern</button>
   <p class="muted small">Sperrt sich nach 60 Sekunden ohne Eingabe oder beim Verlassen der App. Leere Felder bei Konten verwenden den Saldo aus dem letzten Import.</p></div>`;
}
const PA={
  pk:el=>{if(V.pin.length<6){V.pin+=el.dataset.k;V.msg="";renderOv();}},
  pb:()=>{V.pin=V.pin.slice(0,-1);renderOv();},
  pc:()=>{vaultLock();},
  pok:async()=>{
    if(V.busy||V.pin.length<4)return;
    if(Date.now()<V.lockUntil){V.msg="Bitte kurz warten ("+Math.ceil((V.lockUntil-Date.now())/1000)+" s)";V.pin="";renderOv();return;}
    V.busy=true;
    try{
      if(V.step==="new"){V.first=V.pin;V.pin="";V.step="confirm";}
      else if(V.step==="confirm"){
        if(V.pin!==V.first){V.msg="PINs stimmen nicht überein";V.step="new";V.pin="";V.first="";}
        else{const rec=await pinCreate(V.pin);S.vault.pin=rec;S.cfgTs=Date.now();VER++;save();V.pin="";V.first="";V.unlocked=true;snapVault();}
      }else{
        if(await pinVerify(V.pin,S.vault.pin)){V.fails=0;V.pin="";V.unlocked=true;snapVault();}
        else{V.fails++;V.pin="";V.msg="PIN falsch";if(V.fails>=5){V.lockUntil=Date.now()+30000;V.fails=0;V.msg="Zu viele Versuche. 30 Sekunden Pause.";}}
      }
    }catch(e){V.msg=e.message;V.pin="";}
    V.busy=false;V.last=Date.now();renderOv();
  },
  vlock:()=>vaultLock(),
  vfadd:()=>{const n=($("#vfn").value||"").trim(),v=parseNum($("#vfv").value,true);if(!n)return;S.vault.free.push({id:uid(),name:n,val:isNaN(v)?0:v});S.cfgTs=Date.now();snapVault();save();renderOv();},
  vfdel:el=>{S.vault.free=S.vault.free.filter(f=>f.id!==el.dataset.id);S.cfgTs=Date.now();snapVault();save();renderOv();},
  vsnap:()=>{snapVault();renderOv();toast("Stand gespeichert");},
  vpin:()=>{V.unlocked=false;V.step="new";V.pin="";V.first="";V.msg="Neue PIN festlegen";renderOv();}
};
Object.assign(ACT,PA);
const VCH={
  ov:el=>{const v=parseNum(el.value,true);if(el.value.trim()===""||isNaN(v))delete S.vault.ov[el.dataset.id];else S.vault.ov[el.dataset.id]=v;S.cfgTs=Date.now();snapVault();save();renderOv();},
  fn:el=>{const f=S.vault.free.find(x=>x.id===el.dataset.id);if(f){f.name=el.value.trim();S.cfgTs=Date.now();save();}},
  fv:el=>{const f=S.vault.free.find(x=>x.id===el.dataset.id);if(f){const v=parseNum(el.value,true);f.val=isNaN(v)?0:v;S.cfgTs=Date.now();snapVault();save();renderOv();}}
};

/* ---------- Sync (Firestore, Ende-zu-Ende verschlüsselt) ---------- */
const SY={st:"aus",msg:"",unsub:null,key:null,keySalt:null,salt:null,lastTs:0,busy:false,again:false,ref:null,id:null,ready:false,join:false,dirty:false};
function syLabel(){return META.pass?({ok:"Verbunden. ",verbinde:"",fehler:"",offline:"",aus:""}[SY.st]||"")+(SY.msg||"Verbinde …"):"Sync ist aus. Die App funktioniert vollständig lokal.";}
function setSy(st,msg){SY.st=st;SY.msg=msg||"";const e=$("#sy-st");if(e)e.textContent=syLabel();}
const hhmm=()=>new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
async function getKey(pass,saltB64){if(SY.key&&SY.keySalt===saltB64)return SY.key;SY.key=await deriveKey(pass,b64d(saltB64));SY.keySalt=saltB64;return SY.key;}
function syncStop(){if(SY.unsub){try{SY.unsub();}catch(e){}}SY.unsub=null;SY.ready=false;SY.ref=null;SY.salt=null;SY.key=null;clearTimeout(pushT);}
async function syncStart(){
  syncStop();
  if(!META.pass){setSy("aus","");return;}
  if(!window.FB){setSy("offline","Firebase nicht erreichbar (offline?). Lokal läuft alles.");return;}
  try{
    SY.id=await docIdFor(META.pass);SY.ref=FB.doc(FB.db,"finanzplaner",SY.id);setSy("verbinde","Verbinde …");
    SY.unsub=FB.onSnapshot(SY.ref,onSnap,e=>setSy("fehler","Sync-Fehler: "+(e.code||e.message)));
  }catch(e){setSy("fehler",e.message);}
}
async function onSnap(snap){
  if(snap.metadata&&snap.metadata.hasPendingWrites)return;
  try{
    if(!snap.exists()){
      if(SY.join){setSy("fehler","Zu dieser Passphrase gibt es keine Daten. Tippfehler?");syncStop();META.pass=null;SY.join=false;saveMeta();render();return;}
      SY.ready=true;await pushNow();return;
    }
    const d=snap.data();
    if(d.dev===S.dev&&d.ts===SY.lastTs){SY.ready=true;setSy("ok","Gesendet "+hhmm());return;}
    const enc=await unpackDocs(d,SY.id,async i=>{const s=await FB.getDoc(FB.doc(FB.db,"finanzplaner",i));return s.exists()?s.data():null;});
    let R;try{R=normalizeState(await decryptJSON(enc,await getKey(META.pass,d.salt)));}catch(e){setSy("fehler","Passphrase passt nicht zu den Daten oder Daten beschädigt.");return;}
    SY.salt=d.salt;if(SY.join&&!S.tx.length)S.cfgTs=0;SY.join=false;
    const extra=hasExtra(S,R),dev=S.dev;
    const before=JSON.stringify([S.tx.length,S.cfgTs]);
    S=mergeStates(S,R);S.dev=dev;VER++;
    SY.ready=true;kvSet("state",S);
    if(before!==JSON.stringify([S.tx.length,S.cfgTs]))render();
    setSy("ok","Synchronisiert "+hhmm());
    if(extra||SY.dirty)schedulePush(true);
  }catch(e){setSy("fehler",e.message);}
}
function schedulePush(now){
  if(!META.pass||!window.FB)return;
  if(!SY.ready){SY.dirty=true;return;}
  clearTimeout(pushT);pushT=setTimeout(pushNow,now?300:2500);
}
async function pushNow(){
  if(!META.pass||!window.FB||!SY.ref||!SY.ready)return;
  if(SY.busy){SY.again=true;return;}
  SY.busy=true;SY.dirty=false;
  try{
    const salt=SY.salt||b64e(rnd(16)),key=await getKey(META.pass,salt);
    const enc=await encryptJSON(JSON.parse(JSON.stringify(S)),key),ts=Date.now();
    for(const d of packDocs(SY.id,salt,enc,ts,S.dev))await FB.setDoc(FB.doc(FB.db,"finanzplaner",d.id),d.data);
    SY.salt=salt;SY.lastTs=ts;setSy("ok","Gesendet "+hhmm());
  }catch(e){setSy("fehler",e.message||String(e));}
  finally{SY.busy=false;if(SY.again){SY.again=false;schedulePush();}}
}
async function syConnect(join){
  const p=($("#syPass")||{}).value||"";
  if(p.length<12){setSy("fehler","Die Passphrase braucht mindestens 12 Zeichen.");return;}
  if(!window.FB){setSy("offline","Firebase nicht erreichbar (offline?). Bitte später erneut versuchen.");return;}
  META.pass=p;SY.join=!!join;await saveMeta();render();syncStart();
}

/* ---------- Start & Ereignisse ---------- */
document.addEventListener("click",e=>{
  const el=e.target.closest("[data-a]");if(!el)return;
  const f=ACT[el.dataset.a];if(!f)return;
  if(el.tagName==="LABEL"||el.disabled)return;
  e.preventDefault();V.last=Date.now();f(el,e);
});
document.addEventListener("change",e=>{
  const el=e.target;
  if(el.closest&&el.closest("#wiz")){collectWiz();return;}
  if(el.dataset.vi&&VCH[el.dataset.vi]){V.last=Date.now();VCH[el.dataset.vi](el);return;}
  if(el.dataset.ch&&CH[el.dataset.ch]){CH[el.dataset.ch](el);return;}
  if(el.id==="csvf"&&el.files[0]){const f=el.files[0];impLoadFile(f).catch(()=>{ui.imp.busy="";ui.imp.msg="Datei konnte nicht gelesen werden.";render();});el.value="";}
  if(el.id==="impj"&&el.files[0]){
    el.files[0].text().then(t=>{
      const j=JSON.parse(t);if(!j.state||!j.state.tx)throw new Error("kein Backup");
      if(!confirm("Backup zusammenführen? Buchungen werden ergänzt, die Konfiguration des Backups ersetzt die aktuelle, falls sie neuer ist."))return;
      const dev=S.dev,R=normalizeState(j.state);R.cfgTs=Date.now();S=mergeStates(S,R);S.dev=dev;VER++;save();render();toast("Backup eingelesen");
    }).catch(()=>toast("Das ist keine gültige Backup-Datei"));
    el.value="";
  }
});
document.addEventListener("input",e=>{
  V.last=Date.now();
  if(e.target.id==="ruleQ"){ui.ruleQ=e.target.value;const pos=e.target.selectionStart;render();const n=$("#ruleQ");if(n){n.focus();n.setSelectionRange(pos,pos);}}
});
document.addEventListener("keydown",e=>{V.last=Date.now();if((e.key==="Enter"||e.key===" ")&&e.target.getAttribute&&e.target.getAttribute("role")==="button"&&e.target.tagName!=="BUTTON"){e.preventDefault();e.target.dispatchEvent(new MouseEvent("click",{bubbles:true}));}if((e.key==="Enter"||e.key===" ")&&e.target.tagName==="LABEL"){e.preventDefault();e.target.click();}if(e.key==="Escape"){if(V.open)vaultLock();else if(ui.sheet){ui.sheet=null;render();}}});
/* Drag & Drop und Einfügen von Dateien im Import-Reiter */
const impOpen=()=>ui.tab==="im"&&ui.imp.stage==="in";
document.addEventListener("dragover",e=>{if(impOpen())e.preventDefault();});
document.addEventListener("drop",e=>{if(!impOpen())return;e.preventDefault();const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)impLoadFile(f).catch(()=>{ui.imp.busy="";ui.imp.msg="Datei konnte nicht gelesen werden.";render();});});
document.addEventListener("paste",e=>{if(!impOpen())return;const f=e.clipboardData&&e.clipboardData.files&&e.clipboardData.files[0];if(f){e.preventDefault();impLoadFile(f).catch(()=>{});}});
document.addEventListener("pointerdown",()=>{V.last=Date.now();},true);
document.addEventListener("toggle",e=>{const id=e.target.dataset&&e.target.dataset.id;if(id)ui.det[id]=e.target.open;},true);
document.addEventListener("visibilitychange",()=>{if(document.hidden)vaultLock();else if(META.pass&&SY.ready)schedulePush();});
window.addEventListener("pagehide",vaultLock);
setInterval(()=>{if(V.open&&Date.now()-V.last>60000)vaultLock();},3000);
document.querySelectorAll(".seg button").forEach(b=>b.addEventListener("click",()=>{ui.tab=b.dataset.tab;render();window.scrollTo(0,0);}));
/* Langdruck auf den Titel (1,5 s) öffnet den Tresor */
(function(){
  const t=$("#ttl");let tm=null;
  const st=()=>{clearTimeout(tm);tm=setTimeout(()=>{tm=null;vaultOpen();},1500);},cl=()=>{clearTimeout(tm);};
  t.addEventListener("pointerdown",st);["pointerup","pointerleave","pointercancel"].forEach(n=>t.addEventListener(n,cl));
  t.addEventListener("contextmenu",e=>e.preventDefault());
})();
window.addEventListener("fb",()=>{if(META.pass&&!SY.unsub)syncStart();});

/* ---------- Sparziele, Abo-Radar, Jahresrückblick, CSV, Budget-Hinweis ---------- */
const AMP_RANK={g:0,y:1,r:2,n:0};
function freshLights(lights, ym){
  const seen=(META.ampelSeen)||{};
  return lights.filter(L=>(AMP_RANK[L.am]||0)>(AMP_RANK[seen[ym+"|"+L.name]]||0));
}
function syncAmpelSeen(lights, ym){
  const seen=META.ampelSeen||(META.ampelSeen={});
  const note=META.ampelNote||(META.ampelNote={});
  const names=new Set(lights.map(L=>L.name));
  const keepFrom=shiftYM(ym,-14);
  let ch=false;
  for(const bag of [seen,note])for(const k of Object.keys(bag)){
    const m=k.slice(0,7);
    if(m<keepFrom){delete bag[k];ch=true;continue;}
    if(bag===seen&&m===ym&&!names.has(k.slice(8))){delete bag[k];ch=true;}
  }
  return ch;
}
function showBudgetNote(body){
  const opts={body,tag:"fp-budget",lang:"de",icon:"apple-touch-icon.png"};
  const fallback=()=>{try{new Notification("Finanzplaner",{body,tag:"fp-budget",lang:"de"});}catch(e){}};
  try{
    if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration){
      navigator.serviceWorker.getRegistration().then(reg=>{
        if(reg&&reg.showNotification)reg.showNotification("Finanzplaner",opts).catch(fallback);
        else fallback();
      }).catch(fallback);
      return;
    }
  }catch(e){}
  fallback();
}
function notifyFresh(fresh, ym){
  if(!META.notify||typeof Notification==="undefined"||Notification.permission!=="granted"||!fresh.length)return;
  const note=META.ampelNote||(META.ampelNote={});
  const todo=fresh.filter(L=>{const k=ym+"|"+L.name+"|"+L.am;if(note[k])return false;note[k]=1;return true;});
  if(!todo.length)return;
  saveMeta();
  const body=todo.map(L=>L.name+" ist "+(L.am==="r"?"rot":"gelb")+" ("+fmt0(L.ist)+" von "+fmt0(L.ref)+")").join("\n");
  showBudgetNote(body);
}
function budgetHintHtml(){
  const ym=ui.month,lights=budgetLights(S,ym,cmap(),todayStr()),fresh=freshLights(lights,ym);
  if(syncAmpelSeen(lights,ym))saveMeta();
  notifyFresh(fresh,ym);
  if(!fresh.length)return "";
  const word={y:"gelb",r:"rot"};
  return `<section class="alarm ${fresh.some(L=>L.am==="r")?"bad":"y"}" role="status"><h2>Budget-Hinweis</h2>${fresh.map(L=>`<p><b>${esc(L.name)} ist ${word[L.am]}</b><br><span>${fmt0(L.ist)} von ${fmt0(L.ref)}${L.warn?" · Prognose "+fmt0(L.pr):""}</span></p>`).join("")}<div class="row"><button class="btn s" data-a="hintDismiss">Hinweis ausblenden</button>${META.notify?"":`<button class="btn s" data-a="notifyOn">Auch als Mitteilung</button>`}</div><p class="muted small">Die Mitteilung geht nur an dieses Gerät, ohne Server, und nur solange die App geöffnet ist.</p></section>`;
}
function goalsCard(){
  const cm=cmap(),today=todayStr(),list=(S.goals||[]).map(g=>goalView(g,goalSaved(S,g,cm),today));
  if(!list.length)return `<button class="linkline" data-a="tab" data-t="goals">Sparziel anlegen (z. B. Urlaub)</button>`;
  return `<section class="card"><h2 class="sec">Sparziele</h2>${list.map(v=>{
    const pct=Math.round(v.pct*100);
    return `<button class="line" data-a="tab" data-t="goals"><span class="ln"><b>${esc(goalPhrase(v))}</b><small>${fmt0(v.saved)} von ${fmt0(v.target)}${v.done?"":(v.months!=null&&v.months>0?" · "+fmt0(v.per)+" pro Monat":"")}</small><span class="goalbar" aria-hidden="true"><s style="width:${Math.min(100,pct)}%"></s></span></span><span class="num">${pct} %</span></button>`;
  }).join("")}</section>`;
}
function subsHint(){
  const list=subscriptionRadar(S,cmap()),up=list.filter(s=>s.increased);
  if(!list.length)return "";
  if(up.length)return `<section class="card warnc"><p class="big">Abo teurer geworden</p>${up.slice(0,3).map(s=>`<p><b>${esc(s.name)}</b>: ${fmt(s.typical)} → ${fmt(s.last)}</p>`).join("")}<button class="btn w" data-a="tab" data-t="abos">Abo-Radar öffnen</button></section>`;
  return `<button class="linkline" data-a="tab" data-t="abos">Abo-Radar: ${list.length} wiederkehrende Abbuchungen</button>`;
}
function vGoals(){
  const cm=cmap(),today=todayStr();
  const cats=["",...S.cats.filter(c=>c!==INCOME&&c!==TRANSFER)];
  let h=`<button class="btn s" data-a="tab" data-t="ov">‹ Zurück zur Monatsansicht</button><h2 class="sec">Sparziele</h2>
  <p class="muted small">Zum Beispiel „Urlaub 1.500 €, noch 4 Monate“. Der Fortschritt ist der Betrag, den du schon gespart hast, plus die Buchungen der gewählten Kategorie.</p>`;
  for(const g of S.goals||[]){
    const v=goalView(g,goalSaved(S,g,cm),today),pct=Math.round(v.pct*100);
    h+=`<section class="card"><p class="big">${esc(goalPhrase(v))}</p>
      <div class="goalbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(v.name)}"><s style="width:${Math.min(100,pct)}%"></s></div>
      <p class="muted small">${fmt(v.saved)} von ${fmt(v.target)}${v.done?" · Ziel erreicht":(v.per?` · noch ${fmt(v.per)} pro Monat`:"")}${g.cat?" · "+esc(catLabel(g.cat)):""}</p>
      <button class="btn s dang" data-a="goalDel" data-id="${esc(g.id)}">Ziel löschen</button></section>`;
  }
  h+=`<section class="card"><h2 class="sec">Neues Ziel</h2>
    <label class="fld">Name<input id="gn" placeholder="Urlaub" aria-label="Name des Sparziels"></label>
    <label class="fld">Zielbetrag (€)<input id="gt" inputmode="decimal" placeholder="1500" aria-label="Zielbetrag in Euro"></label>
    <label class="fld">Zielmonat<input id="gb" type="month" aria-label="Zielmonat"></label>
    <label class="fld">Schon gespart, zusätzlich zu den Buchungen (€)<input id="gh" inputmode="decimal" placeholder="0" aria-label="Schon gespart in Euro"></label>
    <label class="fld">Kategorie, deren Buchungen mitzählen<select id="gc" aria-label="Kategorie des Sparziels">${cats.map(c=>`<option value="${esc(c)}">${c?esc(catLabel(c)):"Nur der Betrag oben"}</option>`).join("")}</select></label>
    <button class="btn p w" data-a="goalAdd">Sparziel speichern</button></section>`;
  return h;
}
function intervalLabel(n){return n===1?"monatlich":n===12?"jährlich":"alle "+n+" Monate";}
function vAbos(){
  const list=subscriptionRadar(S,cmap());
  let h=`<button class="btn s" data-a="tab" data-t="ov">‹ Zurück zur Monatsansicht</button><h2 class="sec">Abo-Radar</h2>
  <p class="muted small">Wiederkehrende Abbuchungen: gleicher Händler, etwa eine Buchung im Monat oder alle 3, 6 oder 12 Monate, mindestens drei Monate. Einkäufe mehrmals im Monat zählen nicht. Liegt der letzte Betrag mehr als 5 % über dem bisherigen typischen Betrag, ist die Erhöhung markiert.</p>`;
  if(!list.length)return h+`<div class="card"><p class="big">Noch nichts erkannt.</p><p class="muted">Importiere mindestens drei Monate. Danach stehen Miete, Abos und ähnliche Abbuchungen hier.</p></div>`;
  const up=list.filter(s=>s.increased);
  if(up.length)h+=`<section class="alarm bad" role="alert"><h2>Preis gestiegen</h2>${up.map(s=>`<p><b>${esc(s.name)}</b>: ${fmt(s.typical)} → ${fmt(s.last)} (${s.delta>0?"+":""}${fmt(s.delta)})</p>`).join("")}</section>`;
  h+=`<section class="card">`+list.map(s=>`<div class="kv"><span>${esc(s.name)}${s.cat?" · "+esc(catLabel(s.cat)):""}<br><small class="faint">${intervalLabel(s.interval)} · ${s.months} Monate · zuletzt ${dShort(s.lastDate)}</small>${s.increased?`<br><small class="warnt">Teurer: ${fmt(s.typical)} → ${fmt(s.last)}</small>`:s.decreased?`<br><small class="pos">Günstiger: ${fmt(s.typical)} → ${fmt(s.last)}</small>`:""}</span><b class="num">${fmt(s.last)}</b></div>`).join("")+`</section>`;
  return h;
}
function yearChart(R){
  const rows=R.rows.filter(r=>r.cur>0.5||r.prev>0.5).slice(0,14);
  if(!rows.length)return "";
  const max=Math.max(1,...rows.map(r=>Math.max(r.cur,r.prev)));
  const rowH=32,W=320,label=112,barW=W-label-8,H=rows.length*rowH+8;
  const bars=rows.map((r,i)=>{
    const y=4+i*rowH,w1=r.cur/max*barW,w2=r.prev/max*barW;
    const name=r.cat==="(unsortiert)"?"Unsortiert":catLabel(r.cat);
    return `<text x="0" y="${y+14}" class="dlab">${esc(name.slice(0,18))}</text><rect x="${label}" y="${y}" width="${w2.toFixed(1)}" height="8" rx="2" fill="var(--muted)" opacity="0.45"></rect><rect x="${label}" y="${y+11}" width="${w1.toFixed(1)}" height="8" rx="2" fill="var(--accent)"></rect>`;
  }).join("");
  const aria=rows.map(r=>(r.cat==="(unsortiert)"?"Unsortiert":r.cat)+" "+R.year+" "+fmt0(r.cur)+", "+R.prevYear+" "+fmt0(r.prev)).join("; ");
  return `<section class="card"><h2 class="sec">Vergleich</h2><p class="muted small"><i class="dot" style="background:var(--accent)"></i> ${R.year} · <i class="dot" style="background:var(--muted)"></i> ${R.prevYear}</p>
    <svg viewBox="0 0 ${W} ${H}" class="ybars" role="img" aria-label="Ausgaben je Kategorie: ${esc(aria)}">${bars}</svg></section>`;
}
function vYear(){
  const years=[...new Set(S.tx.map(t=>t.d.slice(0,4)).concat([todayStr().slice(0,4)]))].sort().reverse();
  if(!ui.year||!years.includes(ui.year))ui.year=years[0];
  const R=annualReview(S,cmap(),ui.year);
  let h=`<button class="btn s" data-a="tab" data-t="ov">‹ Zurück zur Monatsansicht</button><h2 class="sec">Jahresrückblick ${esc(ui.year)}</h2>
  <div class="chips" role="group" aria-label="Jahr">${years.map(y=>`<button data-a="yearPick" data-y="${y}" aria-pressed="${y===ui.year}">${y}</button>`).join("")}</div>
  <p class="muted small">Ausgaben je Kategorie gegen das Vorjahr. Umbuchungen zählen nicht. ${R.curMonths.length} Monate mit Buchungen in ${R.year}, ${R.prevMonths.length} im Jahr ${R.prevYear}.</p>`;
  h+=yearChart(R);
  h+=`<section class="card"><div class="kv"><span>Ausgaben ${R.year}</span><b class="num">${fmt0(R.curTotal)}</b></div><div class="kv"><span>Ausgaben ${R.prevYear}</span><b class="num">${fmt0(R.prevTotal)}</b></div><div class="kv"><span>Einnahmen ${R.year}</span><b class="num pos">${fmt0(R.curInc)}</b></div><div class="kv"><span>Einnahmen ${R.prevYear}</span><b class="num pos">${fmt0(R.prevInc)}</b></div></section>`;
  if(!R.rows.length)h+=`<p class="empty">Keine Ausgaben in diesen beiden Jahren.</p>`;
  else h+=`<section class="card"><h2 class="sec">Kategorien</h2><ul class="plist">${R.rows.map(r=>{
    const d=r.delta,cls=d>0.5?"neg":d<-0.5?"pos":"";
    const name=r.cat==="(unsortiert)"?"Unsortiert":catLabel(r.cat);
    return `<li><div class="lrow"><span class="pn">${esc(name)}<br><small class="faint">${R.prevYear}: ${fmt0(r.prev)}</small></span><span class="num ${cls}">${fmt0(r.cur)}</span><span class="pp num ${cls}">${Math.abs(d)>=0.5?(d>0?"+":"−")+fmt0(Math.abs(d)):"±0"}</span></div></li>`;
  }).join("")}</ul></section>`;
  return h;
}
function downloadText(name, text, mime){
  const blob=new Blob([text],{type:mime||"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},4000);
}
function doCsv(opt){
  const rows=exportRows(S,cmap(),opt);
  if(!rows.length){toast("Keine Buchungen für diesen Filter.");return;}
  const label=(opt.name||(opt.cat&&opt.cat!=="all"?opt.cat:"buchungen")).replace(/[^\wÄÖÜäöüß\-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,40)||"buchungen";
  const year=opt.year&&opt.year!=="all"?opt.year:todayStr();
  downloadText("finanzplaner-"+label+"-"+year+".csv", rowsToCSV(rows));
  toast(rows.length+(rows.length===1?" Zeile":" Zeilen")+" exportiert");
}


async function boot(){
  META=Object.assign({theme:"auto",pass:null},await kvGet("meta"));
  const raw=await kvGet("state"),was=(raw&&raw.v)||1;S=normalizeState(raw);if(raw&&was<SCHEMA){S.cfgTs=Date.now();kvSet("state",S);}
  {const cp=commonPeriod(S),lm=lastDataMonth();ui.month=lm===nowYM()?lm:((cp&&cp.lastMonth)||lm||ui.month);} /* v12: Start im laufenden Monat, wenn es dort Buchungen gibt (vorher: letzter vollständiger Monat, das sah wie "jetzt" aus) */
  applyTheme();render();maybeWizard();
  if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
  if(META.pass){if(window.FB)syncStart();else setSy("offline","Firebase wird geladen …");}
}
boot();
