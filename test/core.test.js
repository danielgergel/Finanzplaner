/* Tests für Parser, Kategorien, Duplikate, Vorzeichen und die neuen Auswertungen.
   Alle Buchungen sind erfunden. Start: node test/core.test.js */
const fs = require("fs");
const path = require("path");
const C = require("../core.js");

let n = 0, failed = 0;
function check(cond, msg){
  n++;
  if(!cond){failed++; console.error("FEHLER:", msg);}
}
function eq(a, b, msg){check(a===b, msg+" (ist "+JSON.stringify(a)+", soll "+JSON.stringify(b)+")");}
const near=(a,b)=>Math.abs(a-b)<0.02;
function read(name){return fs.readFileSync(path.join(__dirname,"fixtures",name),"utf8");}
function loadCSV(name, opt){
  const a = C.analyzeCSV(read(name));
  check(a.ok, name+" Kopfzeile erkannt");
  return C.extractRows(a, opt||{});
}
function tx(o){return Object.assign({h:"x",a:"dkb",d:"2026-03-04",amt:-10,p:"",t:"",u:1}, o);}
function catOf(p, text, amt){
  const S = C.newState();
  S.tx = [tx({h:"x",p,t:text,amt})];
  return C.resolveAll(S).get("x");
}

/* ---------- Zahlen, Datum, CSV ---------- */
eq(C.parseNum("1.234,56", true), 1234.56, "deutsche Zahl");
eq(C.parseNum("+1.234,56", true), 1234.56, "Plus vor deutscher Zahl");
eq(C.parseNum("12,99 S", true), -12.99, "Suffix S ist Ausgabe");
eq(C.parseNum("12.99 CR", false), 12.99, "Suffix CR ist Eingang");
eq(C.parseDate("01.03.2026"), "2026-03-01", "Datum TT.MM.JJJJ");
eq(C.parseDate("01.03.26"), "2026-03-01", "Datum TT.MM.JJ");
eq(C.parseDate("2026-03-01"), "2026-03-01", "Datum ISO");
eq(C.parseDate("01/03/2026"), "2026-03-01", "Datum TT/MM/JJJJ");
eq(C.parseDate("32.03.2026"), null, "ungültiges Datum");

{
  const ex = loadCSV("giro-beispiel.csv");
  eq(ex.rows.length, 6, "CSV: sechs gebuchte Zeilen");
  eq(ex.pend.length, 1, "CSV: vorgemerkte Netflix-Zeile zählt nicht mit");
  const geh = ex.rows.find(r=>/gehalt/i.test(r.t));
  check(geh&&near(geh.amt, 3100)&&geh.p.includes("Beispiel"), "CSV: Gehalt positiv, Absender Beispiel GmbH");
  const rewe = ex.rows.find(r=>/REWE/.test(r.p));
  check(rewe&&near(rewe.amt, -42.18), "CSV: REWE ist Ausgabe");
  check(ex.rows.every(r=>r.d&&r.d.startsWith("2026-03")), "CSV: alle Daten im März 2026");
  const S = C.newState();
  C.assignHashes(ex.rows, "dkb");
  for(const r of ex.rows)S.tx.push(Object.assign({a:"dkb",u:1}, r));
  const cm = C.resolveAll(S);
  eq(cm.get(geh.h), C.INCOME, "Gehalt wird als Einkommen kategorisiert");
  eq(cm.get(rewe.h), "Lebensmittel", "REWE wird Lebensmittel");
  const shell = ex.rows.find(r=>/SHELL Station/.test(r.p));
  eq(cm.get(shell.h), "Tanken", "SHELL Station wird Tanken");
  const wolter = ex.rows.find(r=>/WOLTER/.test(r.p));
  check(cm.get(wolter.h)!=="Essen gehen", "WOLTER ist nicht WOLT");
  const bar = ex.rows.find(r=>/Beach Shell/.test(r.p));
  check(cm.get(bar.h)!=="Tanken", "Beach Shell Bar ist nicht Tanken");
  const miete = ex.rows.find(r=>/Miete/.test(r.t));
  eq(cm.get(miete.h), "Miete", "Miete im Verwendungszweck");
}

{
  const ex = loadCSV("amex-beispiel.csv", {inv:true});
  check(ex.rows.length===3&&ex.rows.every(r=>r.amt<0), "Amex: positive Beträge werden mit Vorzeichenumkehr zu Ausgaben");
  check(near(ex.rows[0].amt, -42.18), "Amex: 42.18 wird -42.18");
}
{
  const ex = loadCSV("soll-haben-beispiel.csv");
  eq(ex.rows.length, 3, "Soll/Haben: drei Zeilen");
  check(near(ex.rows[0].amt, -12.5), "Soll wird Ausgabe");
  check(near(ex.rows[1].amt, 1234.56), "Haben 1.234,56 wird Eingang");
  const S = C.newState();
  C.assignHashes(ex.rows, "dkb");
  S.tx = ex.rows.map(r=>Object.assign({a:"dkb",u:1}, r));
  eq(C.resolveAll(S).get(ex.rows[1].h), C.INCOME, "Haben-Gehalt ist Einkommen");
}
{
  const buf = Buffer.from("01.03.2026;Bäcker Beispiel;-4,20\n", "latin1");
  /* Kopfzeile dazu, sonst keine Spalten */
  const text = "Buchungsdatum;Verwendungszweck;Betrag\n"+C.decodeBuf(buf);
  const a = C.analyzeCSV(text);
  check(a.ok, "Windows-1252 wird gelesen");
  const ex = C.extractRows(a);
  check(ex.rows.length===1&&ex.rows[0].t.includes("Bäcker"), "ä aus Windows-1252 bleibt im Text");
}

/* ---------- Kategorien (Wortgrenzen) ---------- */
eq(catOf("WOLT", "Essen", -18), "Essen gehen", "WOLT ist Essen gehen");
check(catOf("WOLTER", "Rechnung", -18)!=="Essen gehen", "WOLTER nicht Essen gehen");
eq(catOf("SHELLY GmbH", "Software Abo", -20)!=="Tanken"&&catOf("SHELLY GmbH","Software",-20), catOf("SHELLY GmbH","Software",-20), "SHELLY wird ausgewertet");
check(catOf("SHELLY GmbH", "Software", -20)!=="Tanken", "SHELLY ist nicht SHELL");
eq(catOf("Beispiel GmbH", "Lohn/Gehalt", 3100), C.INCOME, "Gehalt ab 500 Euro");
check(catOf("Beispiel GmbH", "Lohn/Gehalt", 400)!==C.INCOME, "kleiner Gehalts-Text unter 500 bleibt kein Einkommen");
check(catOf("Beispiel GmbH", "Lohn/Gehalt", -3100)!==C.INCOME, "negativer Gehalts-Text ist kein Einkommen");
eq(catOf("NETFLIX.COM", "Abo", -12.99), "Abos", "Netflix ist Abo");

/* ---------- Fixkosten im Verwendungszweck schlägt dm ---------- */
eq(catOf("dm", "Fixkosten", -200), null, "200 Euro Fixkosten an dm ist nicht Drogerie");
eq(catOf("DM", "Fixkosten", -200), null, "DM und Zweck Fixkosten bleibt unsortiert");
eq(catOf("dm-drogerie markt GmbH", "Fixkosten", -200), null, "dm-drogerie mit Zweck Fixkosten ist nicht Drogerie");
eq(catOf("ROSSMANN", "Fixkosten", -200), null, "Rossmann mit Zweck Fixkosten ist nicht Drogerie");
eq(catOf("dm", "Fixkosten Versicherung", -200), "Versicherungen", "Fixkosten Versicherung schlägt dm");
eq(catOf("dm-drogerie markt GmbH", "Fixkosten Miete", -200), "Miete", "Fixkosten Miete bleibt Miete");
eq(catOf("dm", "Fixkosten und Nebenkosten", -200), "Strom & Nebenkosten", "Nebenkosten im Zweck schlägt dm");
eq(catOf("DM", "Einkauf", -18.4), "Drogerie", "dm als eigenes Wort bleibt Drogerie");
eq(catOf("dm-drogerie markt GmbH", "Filiale 12", -9.5), "Drogerie", "dm-drogerie mit Filiale bleibt Drogerie");
eq(catOf("EDEKA", "Fixkosten", -200), null, "Fixkosten unterdrückt auch den Supermarkt");
eq(catOf("Stadtwerke Beispiel", "Fixkosten", -80), "Strom & Nebenkosten", "Stadtwerke bleiben Strom, auch bei Fixkosten");
eq(catOf("Allianz", "Fixkosten", -40), "Versicherungen", "Versicherer bleibt Versicherung, auch bei Fixkosten");
for(const name of ["Nordmann","Grundmann","Feldmann","Widmann","Goldmann","Admin GmbH","Endmontage"]){
  check(catOf(name, "Fixkosten", -200)!=="Drogerie", name+" mit Fixkosten ist nicht Drogerie");
}
check(catOf("GENODEM1GLS", "Fixkosten", -200)!=="Drogerie", "IBAN-Fragment DEM ist nicht dm");
eq(catOf("REWE", "Drogerie", -6), "Drogerie", "Wort Drogerie im Zweck gewinnt gegen REWE");
check(!C.kwMatch(C.kwParse("*DM*"), C.tok("NORDMANN GRUNDMANN WIDMANN ENDMONTAGE")), "dm trifft nicht innerhalb eines Wortes");
check(!C.kwMatch(C.kwParse("DM*"), C.tok("GENODEM1GLS")), "kurzes dm* trifft keine IBAN");
check(C.kwMatch(C.kwParse("DM"), C.tok("dm-drogerie markt")), "dm als eigenes Token trifft");
check(C.kwMatch(C.kwParse("*VERSICHERUNG*"), C.tok("KFZVERSICHERUNG")), "langes Versicherungswort trifft im Kompositum");
{
  const S = C.newState();
  S.rules.unshift({k:"FIXKOSTEN",c:"Miete"});
  S.tx = [tx({h:"x",p:"dm",t:"Fixkosten",amt:-200})];
  eq(C.resolveAll(S).get("x"), "Miete", "eigene Regel Fixkosten gilt vor der Laden-Regel");
  S.rules[0]={k:"DM",c:"Lebensmittel"};
  eq(C.resolveAll(S).get("x"), "Lebensmittel", "eigene Regel bleibt vor dem Zweckwort");
}

/* ---------- PDF-Text ---------- */
{
  const lines = read("pdf-auszug.txt").split(/\r?\n/);
  const res = C.parsePdfLines(lines, {fname:"kontoauszug-3-2026.pdf"});
  check(res.rows.length>=5, "PDF: mehrere Buchungen");
  const geh = res.rows.find(r=>/Gehalt/.test(r.t));
  check(geh&&geh.amt>0&&near(geh.amt, 3100), "PDF: Gehalt ohne Minus ist Eingang");
  const miete = res.rows.find(r=>/Miete/.test(r.t));
  check(miete&&near(miete.amt, -800)&&/Vermieter/.test(miete.t), "PDF: IBAN-Zeile beendet die Buchung nicht, Miete bleibt im Text");
  const shell = res.rows.find(r=>/SHELL/.test(r.t));
  check(shell&&near(shell.amt, -61.4), "PDF: SHELL bleibt Ausgabe");
  const name = C.tailAmount("Ernst-Blick- 3.130,72");
  check(name&&name.sign===0&&near(name.v, 3130.72), "Bindestrich am Wortende ist kein Minus");
  const marked = C.tailAmount("Miete 800,00 S");
  check(marked&&marked.sign<0, "PDF-Suffix S ist Ausgabe");
  const cr = C.tailAmount("Erstattung 15,00 CR");
  check(cr&&cr.sign>0, "PDF-Suffix CR ist Eingang");
}

/* ---------- Duplikate und Vorzeichen ---------- */
{
  const S = C.newState();
  const row = {d:"2026-03-03",amt:-42.18,p:"REWE Markt",t:"Kartenzahlung"};
  C.assignHashes([row], "dkb");
  S.tx = [Object.assign({a:"dkb",u:1}, row)];
  const again = {d:"2026-03-03",amt:-42.18,p:"REWE Markt",t:"Kartenzahlung"};
  C.assignHashes([again], "dkb");
  C.markDups(S, [again], "dkb");
  check(again.dup&&again.why==="hash", "gleicher Hash ist ein Duplikat");
  const other = {d:"2026-03-03",amt:-42.18,p:"REWE",t:"Kartenzahlung vom 27.09.2026"};
  C.assignHashes([other], "dkb");
  C.markDups(S, [other], "dkb");
  check(!other.dup, "gleicher Tag und Betrag, anderer Zweck, ist kein Duplikat");
  const withRef = {d:"2026-03-03",amt:-42.18,p:"REWE Filiale",t:"anderer Text",ref:"REF-REWE-001"};
  S.tx[0].ref = "REF-REWE-001";
  C.assignHashes([withRef], "dkb");
  C.markDups(S, [withRef], "dkb");
  check(withRef.dup&&withRef.why==="ref", "gleiche Kundenreferenz ist ein Duplikat");
}
{
  const t = {h:"f",a:"dkb",d:"2026-03-01",amt:-10,p:"Laden",t:"Kauf",c:"Lebensmittel",u:1};
  check(C.flipTx(t)&&t.amt===10&&t.fl&&t.oa===-10, "Umdrehen dreht das Vorzeichen");
  check(t.c===undefined, "automatische Kategorie wird beim Umdrehen geleert");
  check(C.flipTx(t)&&t.amt===-10&&!t.fl, "zweites Umdrehen stellt das Original her");
  const manual = {h:"m",a:"dkb",d:"2026-03-01",amt:-8,p:"Laden",t:"",c:"Freizeit",mn:1,u:1};
  C.flipTx(manual);
  eq(manual.c, "Freizeit", "einzeln gesetzte Kategorie bleibt beim Umdrehen");
}

/* ---------- Gehalt ohne Stichwort ---------- */
{
  const S = C.newState();
  S.tx = [1,2,3].map(i=>({h:"s"+i,a:"dkb",d:"2026-0"+i+"-28",amt:2480,p:"Beispiel Holding",t:"Dauerauftrag",u:1}));
  const cm = C.resolveAll(S);
  const sc = C.detectSalary(S, cm);
  check(sc&&sc.months>=3&&sc.amt===2480, "größter regelmäßiger Eingang wird als Gehalt vorgeschlagen");
  check(C.incKind({p:"Beispiel",t:"Lohn/Gehalt"})==="sal", "incKind Gehalt");
  check(C.incKind({p:"L-Bank",t:"AFBG"})==="foe", "incKind Förderung");
}

/* ---------- Bestehende Daten bleiben lesbar ---------- */
{
  const old = {
    v:6, r12:1, dev:"altgeraet",
    tx:[{h:"keep",a:"dkb",d:"2024-01-02",amt:-5,p:"REWE",t:"Einkauf",u:1}],
    accounts:[{id:"dkb",name:"DKB",inv:false,map:null,u:1}],
    del:[], cats:C.DEF_CATS.slice(), rules:C.expandRules(),
    budget:C.neutralBudget(),
    profile:{income:2400,setupDone:true,legacy:true,skipRec:[],myNames:[],myIbans:[],skipNames:[]},
    fixed:[], vault:{pin:null,ov:{},free:[],hist:{}},
    recur:[], delw:{}, pend:[]
  };
  const s = C.normalizeState(JSON.parse(JSON.stringify(old)));
  check(s.tx.some(t=>t.h==="keep"&&t.amt===-5), "alte Buchung bleibt nach dem Laden erhalten");
  check(Array.isArray(s.goals)&&s.goals.length===0, "fehlende Sparziele werden leer ergänzt");
  eq(s.profile.income, 2400, "eingerichtetes Einkommen bleibt");
  eq(s.v, 6, "Schema bleibt 6");
  const local = C.newState();
  local.cfgTs = 10;
  local.goals = [{id:"1",n:"Urlaub",target:1500,by:"2027-02",have:200,cat:""}];
  const remote = C.newState();
  delete remote.goals;
  remote.cfgTs = 50;
  const merged = C.mergeStates(local, remote);
  eq(merged.goals.length, 1, "Sync einer älteren Gegenstelle löscht lokale Sparziele nicht");
  eq(merged.goals[0].n, "Urlaub", "Sparziel-Name bleibt beim Sync");
  const cleared = C.newState();
  cleared.cfgTs = 80;
  cleared.goals = [];
  eq(C.mergeStates(local, cleared).goals.length, 0, "bewusst geleerte Ziele werden übernommen");
}

/* ---------- Sparziele ---------- */
{
  const g = {id:"u",n:"Urlaub",target:1500,by:"2027-02",have:0,cat:"Rücklagen"};
  const S = C.newState();
  S.tx = [
    tx({h:"r1",d:"2026-08-01",amt:-400,p:"Sparkonto",t:"Ruecklage",c:"Rücklagen"}),
    tx({h:"r2",d:"2026-09-01",amt:-350,p:"Sparkonto",t:"Ruecklage",c:"Rücklagen"})
  ];
  const cm = new Map([["r1","Rücklagen"],["r2","Rücklagen"]]);
  const saved = C.goalSaved(S, g, cm);
  eq(saved, 750, "Sparziel zählt Kategorie-Buchungen");
  const v = C.goalView(g, saved, "2026-10-22");
  eq(v.months, 4, "Oktober bis Februar sind 4 Monate");
  eq(v.left, 750, "noch 750 Euro");
  eq(v.per, 187.5, "187,50 Euro pro Monat");
  eq(C.goalPhrase(v).replace(/[\u00a0\u202f]/g," "), "Urlaub 1.500 €, noch 4 Monate", "Anzeigetext Sparziel");
  const done = C.goalView(Object.assign({}, g, {have:1500,cat:""}), 1500, "2026-10-22");
  check(done.done&&C.goalPhrase(done).includes("Ziel erreicht"), "erreichtes Ziel");
}

/* ---------- Abo-Radar ---------- */
{
  const S = C.newState();
  const rows = [];
  for(const [m, amt] of [["2026-01",-12.99],["2026-02",-12.99],["2026-03",-12.99],["2026-04",-12.99],["2026-05",-15.99]]){
    rows.push(tx({h:"n"+m,d:m+"-04",amt,p:"NETFLIX.COM",t:"Abo"}));
  }
  for(let i=1;i<=3;i++)rows.push(tx({h:"g"+i,d:"2026-0"+i+"-"+ (10+i),amt:-(20+i*3),p:"REWE Markt",t:"Einkauf "+i}));
  rows.push(tx({h:"g4",d:"2026-01-20",amt:-30,p:"REWE Markt",t:"zweiter Einkauf"}));
  S.tx = rows;
  const list = C.subscriptionRadar(S, C.resolveAll(S));
  const nflx = list.find(s=>/NETFLIX/i.test(s.name));
  check(nflx&&nflx.increased&&near(nflx.typical,12.99)&&near(nflx.last,15.99), "Netflix-Preiserhöhung wird markiert");
  check(!list.some(s=>/REWE/i.test(s.name)), "mehrere Supermarkt-Einkäufe pro Monat sind kein Abo");
  check(nflx.cat==="Abos", "Abo-Kategorie Netflix");
}

/* ---------- Jahresrückblick ---------- */
{
  const S = C.newState();
  S.tx = [
    tx({h:"a",d:"2025-05-02",amt:-100,p:"REWE",t:"Einkauf",c:"Lebensmittel"}),
    tx({h:"b",d:"2026-05-02",amt:-150,p:"REWE",t:"Einkauf",c:"Lebensmittel"}),
    tx({h:"c",d:"2026-05-03",amt:3100,p:"Beispiel GmbH",t:"Gehalt",c:"Einkommen"}),
    tx({h:"d",d:"2026-05-04",amt:-200,p:"Uebertrag",t:"Uebertrag Sparkonto",c:"Eigene Überträge"}),
    tx({h:"e",d:"2025-06-01",amt:3000,p:"Beispiel GmbH",t:"Gehalt",c:"Einkommen"})
  ];
  const cm = new Map(S.tx.map(t=>[t.h,t.c]));
  const R = C.annualReview(S, cm, 2026);
  const food = R.rows.find(r=>r.cat==="Lebensmittel");
  check(food&&near(food.cur,150)&&near(food.prev,100)&&near(food.delta,50), "Lebensmittel 2026 gegen 2025");
  check(!R.rows.some(r=>r.cat==="Eigene Überträge"), "Umbuchungen fehlen im Jahresrückblick");
  eq(R.curInc, 3100, "Einnahmen des Jahres");
  eq(R.prevInc, 3000, "Einnahmen des Vorjahres");
}

/* ---------- CSV-Export ---------- */
{
  const S = C.newState();
  S.accounts.find(a=>a.id==="dkb").name = "Beispielkonto";
  S.tx = [
    tx({h:"1",d:"2026-03-03",amt:-42.18,p:"REWE",t:"Einkauf; Filiale",c:"Lebensmittel"}),
    tx({h:"2",d:"2026-04-01",amt:-167,p:"Fernschule Beispiel",t:"Studiengebuehr",c:"Weiterbildung"}),
    tx({h:"3",d:"2025-04-01",amt:-10,p:"Kiosk",t:"Zeitung",c:"Sonstiges"}),
    tx({h:"4",d:"2026-03-05",amt:-50,p:"Sparkonto",t:"Uebertrag",c:"Eigene Überträge"})
  ];
  const cm = new Map(S.tx.map(t=>[t.h,t.c]));
  const rows = C.exportRows(S, cm, {cat:"Weiterbildung",year:"2026"});
  eq(rows.length, 1, "CSV-Filter Kategorie und Jahr");
  eq(rows[0].category, "Weiterbildung", "CSV-Kategorie");
  const csv = C.rowsToCSV(rows);
  check(csv.charCodeAt(0)===0xFEFF, "CSV hat UTF-8-BOM");
  check(csv.includes("Datum;Konto;Kategorie;Händler;Verwendungszweck;Betrag"), "CSV-Kopf");
  check(csv.includes("-167,00"), "deutscher Betrag");
  check(csv.includes("Beispielkonto"), "Kontoname");
  const all = C.exportRows(S, cm, {year:"2026"});
  check(all.length===2&&!all.some(r=>r.category==="Umbuchungen (zählen nicht)"), "ohne Filter keine Umbuchungen");
  const quoted = C.rowsToCSV(C.exportRows(S, cm, {cat:"Lebensmittel"}));
  check(quoted.includes('"Einkauf; Filiale"'), "Semikolon im Text wird quotiert");
}

/* ---------- Ampel ---------- */
{
  const S = C.newState();
  const it = S.budget.items.find(i=>i.cats.includes("Lebensmittel"));
  it.plan = 100;
  S.budget.income = 3000;
  const paint = amt=>{
    S.tx = [tx({h:"z",d:"2026-03-10",amt,p:"REWE",t:"Einkauf",c:"Lebensmittel"})];
    return C.budgetLights(S, "2026-03", new Map([["z","Lebensmittel"]]), "2026-10-22");
  };
  check(paint(-50).length===0, "unter 90 Prozent kein Hinweis");
  const yel = paint(-95);
  eq(yel.length, 1, "95 von 100 ist ein Hinweis");
  eq(yel[0].am, "y", "95 Prozent ist gelb");
  const red = paint(-120);
  eq(red[0].am, "r", "über dem Richtwert ist rot");
  eq(red[0].name, "Lebensmittel", "Hinweis nennt die Kategorie");
}

/* ---------- Sync: nur echtes Versagen ist ein Fehler, „offline“ nicht ---------- */
{
  eq(C.syncFailureKind({code:"unavailable",message:"Failed to get document because the client is offline."}), "offline", "Firestore offline ist kein Fehler");
  eq(C.syncFailureKind({message:"Could not reach Cloud Firestore backend. Connection failed"}), "offline", "Backend nicht erreichbar");
  eq(C.syncFailureKind({code:"permission-denied",message:"Missing or insufficient permissions."}), "error", "echte Sync-Fehler bleiben Fehler");
}

if(failed){
  console.error(failed+" von "+n+" Prüfungen fehlgeschlagen");
  process.exit(1);
}
console.log(n+" Prüfungen bestanden");
