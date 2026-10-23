/* ===== KERN: Parser, Kategorien, Auswertung, Krypto, Merge (ohne DOM) ===== */
const TRANSFER="Eigene Überträge", INCOME="Einkommen", UNSORTED="Zu sortieren";
const norm=s=>String(s==null?"":s).toUpperCase().replace(/Ä/g,"AE").replace(/Ö/g,"OE").replace(/Ü/g,"UE").replace(/ß/g,"SS").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();

/* ---------- Standarddaten ---------- */
const DEF_CATS=["Einkommen","Eigene Überträge","Miete","Lebensmittel","Drogerie","Tanken","Online-Shopping","Essen gehen","Abos","Versicherungen","Handy/Internet","Trading","Sparen","Rücklagen","Weiterbildung","Friseur","GEZ/Rundfunk","Reisen","Freizeit","Bekleidung","Sonstiges","Strom & Nebenkosten","Bargeld","Auto/Parken","Gesundheit","ÖPNV/Bahn"];
/* Standardregeln, geordnet nach Spezifitaet (erste passende zaehlt).
   Schluessel arbeiten auf WOERTERN (Gross/Klein, Umlaute und Satzzeichen normalisiert), nie auf Teilstrings.
   "A|B" Alternativen, "A B" Wortfolge, "A+B" beide Woerter irgendwo, "WORT!AUS1!AUS2" nicht, wenn AUS1/AUS2 vorkommt,
   "*ENDE" / "ANFANG*" / "*MITTE*" Wortteil nur bei zusammengesetzten deutschen Woertern (ab 4 Buchstaben).
   Woerter mit hoechstens 3 Buchstaben (dm, o2, jet) zaehlen nur als ganzes Wort, nie innerhalb eines anderen. Optionen: pos, neg, min (Betrag). */
const DEF_RULES=[
["Rücklagen","RUECKLAGE|RUECKLAGEN"],
["Eigene Überträge","PAYPAL INSTANT TRANSFER|INSTANT TRANSFER|AUSZAHLUNG PAYPAL|UEBERWEISUNG VON PAYPAL|PAYPAL AUSZAHLUNG"],
["Sparen","SAMMELUEBERWEISUNG|ETF|BAUSPAR*|SCALABLE|COMDIRECT|SPARPLAN*|WERTPAPIER*|TRADE REPUBLIC|TRADEREPUBLIC"],
["Eigene Überträge","UEBERTRAG|UEBERTRAGUNG|UMBUCHUNG*|ZAHLUNG ERHALTEN|TOP UP|TOPUP|AMERICAN EXPRESS|AMEX|AEME|KREDITKARTENABRECHNUNG|KREDITKARTE ABRECHNUNG|ZAHLUNG REVOLUT|REVOLUT"],
["Einkommen","GEHALT*|LOHN|BEZUEGE|BESOLDUNG|ARBEITGEBER",{pos:1,min:500}],
["Einkommen","KINDERGELD|RENTE|DEUTSCHE RENTENVERSICHERUNG|BAFOEG|BAFOG|AFBG|L BANK|STEUERERSTATTUNG|FINANZAMT|FOERDERUNG*|ELTERNGELD|ARBEITSAGENTUR|BUNDESAGENTUR",{pos:1}],
["Trading","APEXTRADERFUNDING|APEXFUTURES|APEX FUTURES|APEX TRADER|APEX|TAKEPROFIT*|TAKE PROFIT|TOPSTEP*|TRADEIFY|FTMO|WHOP|FUNDINGPIPS|FUNDEDNEXT|BULENOX|LUCID TRADING|LUCIDTRADING|ELITE TRADER FUNDING|MYFUNDEDFX|MYFUNDEDFUTURES|ALPHA FUTURES|TRADOVATE|NINJATRADER|TRADINGVIEW|ATAS|TRADERVUE|FUNDED FUTURES|TRADEDAY|FUNDINGTICKS|FUNDINGTRADERS"],
["Miete","MIETE|KALTMIETE|WARMMIETE|MIETZAHLUNG*|HAUSVERWALTUNG*|VERMIETER*|WOHNUNGSMIETE"],
["Auto/Parken","PARKHAUS*|PARKSERVICE*|PARKEN|PARKSCHEIN*|PARKGEBUEHR*|CONTIPARK|APCOA|PARKING|AUTOWAESCHE|AUTOWASCH*|WASCHPARK|WASCHANLAGE*|LADESTATION*|IONITY|FASTNED|ALLEGO|TESLA SUPERCHARGER|SUPERCHARGER|ENBW MOBILITY|WERKSTATT*|TUEV|DEKRA|ATU|REIFEN*|KFZ!VERSICHERUNG!VERS!HAFTPFLICHT!VERSICHERUNGEN|AUTOHAUS*|AUTOTEILE*"],
["Sonstiges","SANIFAIR|SANIF*"],
["Strom & Nebenkosten","STROM|GAS|WASSER|STADTWERKE*|ENBW|VATTENFALL|ENTEGA|EON|E ON|EWE|BADENOVA|WASSERVERSORGUNG*|MUELLABFUHR|ABFALL*|NEBENKOSTEN|ABSCHLAG|ENERGIE*|FERNWAERME|HEIZKOSTEN|GRUNDSTEUER"],
["Tanken","SHELL!BEACH!BAR!COCKTAIL|ARAL|ESSO|JET|TOTALENERGIES|TOTAL ENERGIES|TOTAL TANKSTELLE|TOTAL STATION|TOTAL AUTOHOF|TOTAL!MIETWAGEN!RENT!CAR!AUTOVERMIETUNG!SIXT!HERTZ!EUROPCAR!AVIS|AVIA|HEM|AGIP|ENI|OMV|TAMOIL|BFT|STAR TANK|STAR STATION|STAR TANKSTELLE|SPRINT|MARKANT|RAIFFEISEN!MARKT!BANK!BAUMARKT!VOLKSBANK!LAGERHAUS|ALLGUTH|Q1|Q8|BP|ORLEN|HOYER|REPSOL|CEPSA|GALP|MOEVE|SUNOCO|MAXXIM|CALPAM|CLASSIC TANKSTELLE|CLASSIC STATION|ROSSNAGEL|EBERHARDT|OIL|TANKSTELLE*|TANKCENTER|TANK CENTER|TANKAUTOMAT*|SB TANK|SBTANK|SB TANKSTELLE|AUTOHOF*|RASTHOF*|RASTANLAGE*|TANK RAST|GASOLINERA*|ESTACION DE SERVICIO|ESTACION SERVICIO|ESTACIO DE SERVEI|CARBURANT*|STATION SERVICE|STATION ESSENCE|GLOBUS TANKSTELLE|KAUFLAND TANKSTELLE|LECLERC STATION|GLOBUS STATION|KAUFLAND STATION"],
["Bargeld","GELDAUTOMAT*|BARGELDAUSZAHLUNG*|BARAUSZAHLUNG*|CASH ADVANCE|ATM|SPARKASSE+DEBITKARTENUMSATZ|VOLKSBANK+DEBITKARTENUMSATZ|RAIFFEISENBANK+DEBITKARTENUMSATZ|SPARDA+DEBITKARTENUMSATZ|WESTERWALD+DEBITKARTENUMSATZ|COMMERZBANK+DEBITKARTENUMSATZ|DEUTSCHE BANK+DEBITKARTENUMSATZ|POSTBANK+DEBITKARTENUMSATZ|VR BANK+DEBITKARTENUMSATZ|BBBANK+DEBITKARTENUMSATZ|PSD BANK+DEBITKARTENUMSATZ|TARGOBANK+DEBITKARTENUMSATZ|HYPOVEREINSBANK+DEBITKARTENUMSATZ",{neg:1}],
["Gesundheit","ZAHN*|ARZT|AERZTE*|PRAXIS|APOTHEKE*|OPTIKER*|OPTIK|PHYSIO*|KRANKENHAUS|KLINIK*|HEILPRAKTIKER*|ORTHOPAED*|AUGENARZT|HAUTARZT|FRAUENARZT|LABOR|SANITAETSHAUS|MEDIZIN*|ZAHNKLINIK|ZAHNMEDIZIN*"],
["Essen gehen","MCDONALD*|BURGER KING|BURGER*|KFC|SUBWAY|STARBUCKS|LIEFERANDO|WOLT|DELIVEROO|UBER EATS|EUREST|KANTINE*|MENSA|STUDENTENWERK*|SODEXO|COMPASS GROUP|CAFETERIA*|CAFE|COFFEE*|KEBAP*|KEBAB*|DOENER*|DONER*|EISCAFE*|EIS CAFE|GASTRO*|GELATERIA|TAPAS|KNEIPE*|BISTRO*|SCHNITZELHAUS|PIZZ*|PIZZERIA*|RESTAURANT*|RISTORANTE*|TRATTORIA|OSTERIA|IMBISS*|GRILL*|SUSHI*|THAI|VAPIANO|NORDSEE|BRAUHAUS*|WIRTSHAUS*|GASTSTAETTE*|GASTHOF*|BIERGARTEN*|DOMINO*|BRASSERIE|EISDIELE*|CREPERIE|STREET FOOD|STREETFOOD|FOODTRUCK|FOOD TRUCK"],
["ÖPNV/Bahn","DEUTSCHE BAHN|DB VERTRIEB|DB AUTOMAT|DB FERNVERKEHR|DB REGIO|BAHN|FLIXBUS|DOTT|LIME|BOLT|NAHVERKEHR*|TAXI*|UBER|FREENOW|KVV|VRR|MVG|BVG|RMV|HVV|VGN|VVS|SBB|OEBB|SNCF|TRENITALIA|EUROSTAR|DEUTSCHLANDTICKET|DEUTSCHLAND TICKET|MOBILITAET*|TIER|BIRD|SHARENOW|FLINKSTER|NEXTBIKE|CALL A BIKE|VOI"],
["Lebensmittel","REWE|EDEKA|ALDI|LIDL|KAUFLAND|PENNY|NETTO|NORMA|DENNS|BIOMARKT*|ALNATURA|TEGUT|GLOBUS|MARKTKAUF|NAHKAUF|NAH UND GUT|SPAR|MERCADONA|CARREFOUR|LECLERC|AUCHAN|TESCO|CONAD|COOP|MIGROS|BAECKER*|BAECKEREI*|BACKWERK|BACKSHOP|BREZEL*|METZGER*|FLEISCHEREI*|KIOSK|GETRAENKE*|LEBENSMITTEL*|SUPERMARKT*|SUPERMERCADO*|SUPERMERCAT*|ALIMENTATION|EPICERIE|BOULANGERIE|PANADERIA|HOFLADEN|WOCHENMARKT"],
["Drogerie","DM|DROGERIE*|ROSSMANN|MUELLER DROGERIE|MUELLER DROGERIEMARKT|BUDNI|LUSH|RITUALS|FARMACIA*|TEDI|PARFUEMERIE*|DOUGLAS|FLACONI"],
["Abos","NETFLIX|SPOTIFY|DAZN|PLAYSTATION|SONY INTERACTIVE|ICLOUD|ANTHROPIC|CLAUDE|KINGSIZE|DISNEY|PRIME VIDEO|AMAZON PRIME|YOUTUBE|GOOGLE ONE|GOOGLE STORAGE|TWITCH|AUDIBLE|DEEZER|WAIPU|SKY|PARAMOUNT|CRUNCHYROLL|DUOLINGO|OPENAI|CHATGPT|MICROSOFT 365|DROPBOX|NORDVPN|PATREON|APPLE COM BILL|CANVA|ADOBE|NOTION|GITHUB|JETBRAINS|ZOOM"],
["Online-Shopping","AMAZON|EBAY|ZALANDO|ABOUT YOU|OTTO|SHEIN|TEMU|ALIEXPRESS|KLEINANZEIGEN|VINTED|MEDIAMARKT|SATURN|CYBERPORT|NOTEBOOKSBILLIGER|GALAXUS|IKEA|HORNBACH|BAUHAUS|TOOM|HAGEBAU|OBI|DECATHLON|BOOKS|THALIA|HUGENDUBEL|COMTRADA|BUHL DATA|BUHL|SOFTWARE*|ALTERNATE|CONRAD|REICHELT"],
["Bekleidung","NIKE|ADIDAS|H M HENNES|H M MAURITZ|H M MODE|H M STORE|H M FILIALE|H M ONLINE|ZARA|PRIMARK|C A MODE|C A FILIALE|C A DEUTSCHLAND|C A ONLINE|PEEK CLOPPENBURG|PEEK|JACK|SPORT SCHECK|TITUS|ZUMIEZ|FOOTLOCKER|DEICHMANN|VERO MODA|TOMMY|BERSHKA|TK MAXX|ESPRIT|S OLIVER|MANGO|UNIQLO|PULL BEAR|SNIPES|STRADIVARIUS|MASSIMO DUTTI|ONLY SONS|C A!PAYPAL!CIE!ET!SARL"],
["Versicherungen","*VERSICHERUNG*|HAFTPFLICHT*|CHECK24|NUERNBERGER|GOTHAER|AXA|DEBEKA|SIGNAL IDUNA|BARMER|TECHNIKER KRANKENKASSE|AOK|KRANKENKASSE*|DAK GESUND|GENERALI|CONCORDIA|WGV|HUK COBURG|HUK|ADAC|ALLIANZ|DEVK|HDI|LVM|VERS AG|VERS GMBH|VHV|BARMENIA|WALDENBURGER|ERGO|ARAG|PROVINZIAL|CONTINENTALE|WUERTTEMBERGISCHE"],
["Handy/Internet","TELEKOM|VODAFONE|O2|1UND1|FREENET|TELEFONICA|CONGSTAR|MOBILCOM|DEUTSCHE GLASFASER|SIMYO|LEBARA|PYUR|UNITYMEDIA|KABEL DEUTSCHLAND|FRAENK|NETZCLUB|WINSIM|CALLYA|IONOS"],
["Weiterbildung","KLETT|ILS|FERNSCHULE*|UDEMY|COURSERA|SKILLSHARE|SEMINAR*|FORTBILDUNG*|UNIVERSITAET*|HOCHSCHULE*|VOLKSHOCHSCHULE*|COPECART|COPE CART"],
["Friseur","FRISEUR*|COIFFEUR|BARBER*|KOSMETIK*|NAGELSTUDIO|HAIR"],
["GEZ/Rundfunk","GEZ|RUNDFUNK*|BEITRAGSSERVICE|ARD ZDF"],
["Reisen","BOOKING|AIRBNB*|FLUG*|FLUEGE|LUFTHANSA|RYANAIR|EASYJET|EUROWINGS|CONDOR|TUI|SIXT|EUROPCAR|HERTZ|AVIS|HOSTEL*|*HOTEL*|EXPEDIA|TRIVAGO|AIRLINE*|MIETWAGEN*|FERIENWOHNUNG*|CAMPING*|URLAUB*"],
["Freizeit","KARTBAHN|KARTING|KART|KINO*|CINEMAXX|CINESTAR|UCI|FILMPALAST|CINEORDER|CINEPLEX|KINOPOLIS|GYM|FITNESS*|MCFIT|URBAN SPORTS|FITX|CLEVER FIT|FITSTAR|JOHN REED|SPORTWELT|SCHWIMMBAD*|THERME*|FREIZEITPARK*|ZOO|THEATER*|KONZERT*|EVENTIM|TICKETMASTER|BOWLING|ESCAPE|STEAM|EPIC GAMES|NINTENDO|GAMES|GOLF|TENNIS|KLETTERN|BOULDER*|SAUNA*"],
["Sonstiges","ENTGELT|GEBUEHR*|KONTOFUEHRUNG*|KREDITKARTENGEBUEHR|DHL|POST|HERMES|DPD|UPS|REPARATUR*|COPYSHOP|COPYCART"],
["Online-Shopping","PAYPAL",{neg:1}]
];
const expandRules=()=>{const o=[];for(const [c,ks,opt] of DEF_RULES)for(const k of ks.split("|")){const r={k,c};if(opt){if(opt.pos)r.pos=1;if(opt.neg)r.neg=1;if(opt.min)r.min=opt.min;}o.push(r);}return o;};
const DEFKEYS=new Set(expandRules().map(r=>norm(r.k)+"|"+r.c));
/* v12: geaenderte Standardregeln. Die Migration ersetzt alte Schluessel und ordnet neue an ihrer Stelle ein (eigene Regeln bleiben vorn). */
const V12_REMOVED=new Set(["KFZ|Auto/Parken"]);
const V12_ADDED=new Set([["Auto/Parken","KFZ!VERSICHERUNG!VERS!HAFTPFLICHT!VERSICHERUNGEN"],["Sonstiges","SANIFAIR|SANIF*"],["Essen gehen","STREET FOOD|STREETFOOD|FOODTRUCK|FOOD TRUCK"],["Bekleidung","C A!PAYPAL!CIE!ET!SARL"],["Versicherungen","VERS AG|VERS GMBH|VHV|BARMENIA|WALDENBURGER|ERGO|ARAG|PROVINZIAL|CONTINENTALE|WUERTTEMBERGISCHE"]].flatMap(([c,ks])=>ks.split("|").map(k=>norm(k)+"|"+c)));
const DEF_BUDGET={
  income:null, planIncome:3100, mode:"plan", g:90, r:100,
  items:[
    {n:"Miete (eigener Anteil)",cats:["Miete"],plan:800,pct:32.5,fix:1},
    {n:"Lebensmittel",cats:["Lebensmittel"],plan:160,pct:11},
    {n:"Tanken",cats:["Tanken"],plan:300,pct:13},
    {n:"Essen gehen",cats:["Essen gehen"],plan:200,pct:4.5},
    {n:"Freizeit",cats:["Freizeit"],plan:100,pct:9},
    {n:"Online-Shopping",cats:["Online-Shopping"],plan:150,pct:null},
    {n:"Drogerie",cats:["Drogerie"],plan:50,pct:null},
    {n:"Sonstiges",cats:["Sonstiges"],plan:100,pct:null},
    {n:"Bekleidung",cats:["Bekleidung"],plan:50,pct:4},
    {n:"Versicherungen",cats:["Versicherungen"],plan:250,pct:null,fix:1},
    {n:"Handy/Internet",cats:["Handy/Internet"],plan:80,pct:null,fix:1},
    {n:"Abos",cats:["Abos"],plan:100,pct:null,fix:1,note:"Spotify, iCloud, PlayStation, Claude, Kingsize"},
    {n:"Weiterbildung",cats:["Weiterbildung"],plan:167,pct:null,fix:1},
    {n:"Friseur",cats:["Friseur"],plan:40,pct:null},
    {n:"GEZ/Rundfunk",cats:["GEZ/Rundfunk"],plan:null,pct:null,fix:1},
    {n:"Reisen",cats:["Reisen"],plan:null,pct:null},
    {n:"Strom & Nebenkosten",cats:["Strom & Nebenkosten"],plan:null,pct:null,fix:1},
    {n:"Bargeld",cats:["Bargeld"],plan:null,pct:null},
    {n:"Auto/Parken",cats:["Auto/Parken"],plan:null,pct:null},
    {n:"Gesundheit",cats:["Gesundheit"],plan:null,pct:null},
    {n:"ÖPNV/Bahn",cats:["ÖPNV/Bahn"],plan:null,pct:null},
    {n:"Sparen / ETF",cats:["Sparen"],plan:200,pct:12.5,fix:1,goal:1},
    {n:"Rücklagen",cats:["Rücklagen"],plan:350,pct:null,fix:1,goal:1,note:"Urlaub 110, Hannover 90, Auto 85, Handy 65"},
    {n:"Trading-Ausgaben",cats:["Trading"],plan:666,pct:null,fix:1,note:"laufen über Trade Republic"}
  ]
};
/* Neue Nutzer starten OHNE persoenlichen Plan: alle Plan-Werte leer, kein Gehalt, keine persoenlichen Hinweise. */
function neutralBudget(){
  const b=JSON.parse(JSON.stringify(DEF_BUDGET));
  b.planIncome=null;b.income=null;
  for(const it of b.items){it.plan=null;delete it.note;}
  return b;
}
const LEGACY_PLAN=(()=>{const m={};for(const it of DEF_BUDGET.items)m[it.cats[0]]=it.plan;return m;})();
const HINTS={
 "Miete":"Prüfe, ob sich der eigene Anteil an Miete und Nebenkosten neu verhandeln lässt.",
 "Lebensmittel":"Plane die Woche mit Einkaufsliste und greife zu Eigenmarken, das spart oft ein Viertel.",
 "Tanken":"Vergleiche Tankstellenpreise per App, tanke abends und bündle Fahrten.",
 "Essen gehen":"Koche zwei Mal pro Woche vor, dann fällt Lieferdienst und Restaurant weg.",
 "Freizeit":"Setze ein festes Wochenbudget für Freizeit und zahle es bar oder per Prepaid-Karte.",
 "Online-Shopping":"Lege jeden Kauf 48 Stunden in den Warenkorb, bevor du bezahlst.",
 "Versicherungen":"Vergleiche Tarife und kündige doppelte oder unnötige Policen.",
 "Handy/Internet":"Ein Tarifwechsel oder Kündigung zum Laufzeitende bringt meist einen günstigeren Vertrag.",
 "Abos":"Gehe alle Abos durch und kündige, was du seit Wochen nicht genutzt hast.",
 "Weiterbildung":"Prüfe, ob Teile der Kosten steuerlich absetzbar sind.",
 "Friseur":"Ein längerer Rhythmus zwischen den Terminen spart auf das Jahr gesehen spürbar.",
 "Trading":"Begrenze die Gebühren für Konten und Tools auf das, was du wirklich handelst.",
 "Reisen":"Buche früh und aus der Rücklage statt aus dem laufenden Budget."
};

/* ---------- Hilfen ---------- */
const SCHEMA=6; /* Schema bleibt 6. Zusaetzliche optionale Felder: ref, src, gs an Buchungen; pend, r12 am Zustand; goals[] (Sparziele). Aeltere Versionen lesen die Daten weiter. */
const catLabel=c=>c===TRANSFER?"Umbuchungen (zählen nicht)":c;
const SAVECATS=["Sparen","Rücklagen"];
const fixedSum=(S,it)=>{let s=0;for(const f of S.fixed||[])if(it.cats.includes(f.cat))s+=+f.amt||0;return s;};
const isFixItem=(S,it)=>!!it.fix||fixedSum(S,it)>0;
function groupOf(S,c){ if(c==="Trading")return "var"; if(SAVECATS.includes(c))return "save"; for(const it of S.budget.items)if(isFixItem(S,it)&&!it.goal&&it.cats.includes(c))return "fix"; return "var"; }
const suggestFor=(it,income)=>it.pct>0&&income>0?Math.round(income*it.pct/100):null;
function ensureItems(S){
  const have=new Set(S.budget.items.flatMap(i=>i.cats));
  for(const c of S.cats){ if(c===INCOME||c===TRANSFER||have.has(c))continue; S.budget.items.push(c==="Strom & Nebenkosten"?{n:c,cats:[c],plan:null,pct:null,fix:1}:{n:c,cats:[c],plan:null,pct:null}); have.add(c); }
}
const mkey=t=>t.mo||t.d.slice(0,7);
const takeRows=(rows,takeMaybe)=>rows.filter(r=>!r.dup&&(!r.maybe||takeMaybe||r.amt>0)); /* moegliche Duplikate: Eingaenge nie still verwerfen */
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const pad2=n=>String(n).padStart(2,"0");
const dayNum=d=>Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))/864e5;
const ymOf=d=>d.slice(0,7);
const shiftYM=(ym,k)=>{let y=+ym.slice(0,4),m=+ym.slice(5,7)-1+k;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+"-"+pad2(m+1);};
const daysIn=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
const todayStr=()=>{const t=new Date();return t.getFullYear()+"-"+pad2(t.getMonth()+1)+"-"+pad2(t.getDate());};
function cyrb53(str,seed=0){let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);}

/* ---------- CSV ---------- */
function decodeBuf(buf){
  const u=buf instanceof Uint8Array?buf:new Uint8Array(buf);
  try{return new TextDecoder("utf-8",{fatal:true}).decode(u);}catch(e){return new TextDecoder("windows-1252").decode(u);}
}
function parseCSV(text,delim){
  const rows=[];let row=[],f="",q=false;const n=text.length;
  for(let i=0;i<n;i++){
    const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){f+='"';i++;} else q=false; } else f+=ch; }
    else if(ch==='"'&&f.trim()===""){q=true;f="";}
    else if(ch===delim){row.push(f);f="";}
    else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&text[i+1]==="\n")i++; row.push(f);f="";rows.push(row);row=[]; }
    else f+=ch;
  }
  if(f!==""||row.length){row.push(f);rows.push(row);}
  return rows.map(r=>r.map(x=>x.trim())).filter(r=>r.some(x=>x!==""));
}
function detectDelim(text){
  const sample=text.slice(0,6000);let best=";",bs=-1;
  for(const d of [";",",","\t","|"]){
    const rows=parseCSV(sample,d).filter(r=>r.length>1);if(!rows.length)continue;
    const cnt={};for(const r of rows)cnt[r.length]=(cnt[r.length]||0)+1;
    let mod=0,mc=0;for(const k in cnt)if(cnt[k]>mc||(cnt[k]===mc&&+k>mod)){mc=cnt[k];mod=+k;}
    const s=mc*(mod-1);if(s>bs){bs=s;best=d;}
  }
  return best;
}
function parseNum(s,de){
  if(s==null)return NaN;s=String(s).trim();if(!s)return NaN;
  let neg=false;
  if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}
  if(/\d\s*(S|DR)$/i.test(s))neg=true;
  s=s.replace(/[−–—]/g,"-").replace(/[^\d.,+\-]/g,"");
  if(s.includes("-"))neg=true;
  s=s.replace(/[+\-]/g,"");
  if(!/\d/.test(s))return NaN;
  const lc=s.lastIndexOf(","),ld=s.lastIndexOf("."),nc=(s.match(/,/g)||[]).length,nd=(s.match(/\./g)||[]).length;
  let dec=null;
  if(lc>=0&&ld>=0)dec=lc>ld?",":".";
  else if(lc>=0){ if(nc>1)dec=null; else dec=(/^\d{1,3},\d{3}$/.test(s)&&!de)?null:","; }
  else if(ld>=0){ if(nd>1)dec=null; else dec=(/^\d{1,3}\.\d{3}$/.test(s)&&de)?null:"."; }
  let t;
  if(dec===",")t=s.replace(/\./g,"").replace(",",".");
  else if(dec===".")t=s.replace(/,/g,"");
  else t=s.replace(/[.,]/g,"");
  const v=parseFloat(t);if(isNaN(v))return NaN;
  return Math.round((neg?-v:v)*100)/100;
}
function parseDate(s){
  s=String(s||"").trim();let m,y,mo,d;
  if((m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s))){d=+m[1];mo=+m[2];y=+m[3];}
  else if((m=/^(\d{1,2})\.(\d{1,2})\.(\d{2})(?!\d)/.exec(s))){d=+m[1];mo=+m[2];y=2000+ +m[3];}
  else if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))){y=+m[1];mo=+m[2];d=+m[3];}
  else if((m=/^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(s))){y=+m[1];mo=+m[2];d=+m[3];}
  else if((m=/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(s))){d=+m[1];mo=+m[2];y=+m[3];}
  else if((m=/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2})(?!\d)/.exec(s))){d=+m[1];mo=+m[2];y=2000+ +m[3];}
  else return null;
  if(mo<1||mo>12||d<1||d>31||y<1990||y>2100)return null;
  return y+"-"+pad2(mo)+"-"+pad2(d);
}
const normHead=h=>String(h||"").toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]/g,"");
const FIELD_PATS=[
 ["date",[/^buchungsdatum/,/^buchungstag/,/^buchung$/,/^completed/,/^datum$/,/^date$/,/^transaktionsdatum|^belegdatum|^transactiondate/,/^started/,/^wertstellung|^valuta/]],
 ["amount",[/^(betrag|amount|umsatz|summe)(eur|euro|ineur|ineuro)?$/,/^betrag/]],
 ["soll",[/^(soll|belastung|debit|moneyout|ausgabe|ausgaben)$/]],
 ["haben",[/^(haben|gutschrift|credit|moneyin|einnahme|einnahmen)$/]],
 ["payeeOut",[/^(zahlungsempf|empfaenger)/]],
 ["payeeIn",[/^(zahlungspflichtige|auftraggeber)/]],
 ["payee",[/^(beguenstigter|name$|partner|counterparty|haendler|merchant|payee|sender)/]],
 ["ref",[/^kundenreferenz$/,/^endtoend(referenz|reference|id)?$/]],
 ["text",[/^verwendungszweck/,/^(description|beschreibung)/,/^(zweck|details|memo|reference|referenz)/,/^buchungstext/]],
 ["iban",[/^(iban|kontonummeriban)$/]],
 ["cred",[/^glaeubiger/]],
 ["type",[/^(umsatztyp|umsatzart|buchungsart)$/]],
 ["btext",[/^buchungstext$/,/^type$/,/^transactiontype$/,/^transaktionsart$/]],
 ["bal",[/^(saldo|balance|kontostand)/]],
 ["fee",[/^(fee|gebuehr)/]],
 ["state",[/^(state|status)$/]]
];
function mapHeader(row){
  const hs=row.map(normHead),used=new Set(),cols={};
  for(const [f,pats] of FIELD_PATS){
    let found=null;
    for(const p of pats){ for(let i=0;i<hs.length;i++){ if(used.has(i)||!hs[i]||(/iban|bic/.test(hs[i])&&f!=="iban"))continue; if(p.test(hs[i])){found=i;break;} } if(found!=null)break; }
    if(found!=null){cols[f]=found;used.add(found);}
  }
  return cols;
}
const headerOk=c=>c&&c.date!=null&&(c.amount!=null||c.soll!=null||c.haben!=null);
function analyzeCSV(text,saved){
  text=String(text).replace(/^﻿/,"");
  const delim=detectDelim(text),rows=parseCSV(text,delim);
  let hr=-1,cols=null;
  if(saved&&saved.cols&&saved.hr!=null&&rows[saved.hr]&&rows[saved.hr].length===saved.n&&headerOk(saved.cols)){hr=saved.hr;cols=saved.cols;}
  else for(let i=0;i<Math.min(rows.length,80);i++){ if(rows[i].length<3)continue; const c=mapHeader(rows[i]); if(headerOk(c)){hr=i;cols=c;break;} }
  return {delim,rows,hr,cols,ok:hr>=0};
}
function extractRows(a,opt){
  opt=opt||{};const {rows,hr,cols,delim}=a,de=delim===";"||opt.de;
  const out=[],pend=[];let skipped=0,cn=0,cb=0;
  const NEGW=/lastschrift|abbuchung|ausgang|belastung|entgelt|gebuehr|kartenzahlung|dauerauftrag|bargeld|abgang|card_payment|^atm$|^fee$|^debit$/,POSW=/gutschrift|eingang|zahlungseingang|zugang|erstattung|^topup$|card_refund|^refund$|^credit$/;
  const get=(r,k)=>cols[k]!=null?(r[cols[k]]||""):"";
  for(let i=hr+1;i<rows.length;i++){
    const r=rows[i];const d=parseDate(get(r,"date"));
    if(!d){skipped++;continue;}
    const st=get(r,"state").toLowerCase();
    if(/revert|declin|fail|abgelehnt|storniert/.test(st)){skipped++;continue;}
    const isPend=/pending|vorgemerkt|ausstehend/.test(st); /* noch nicht gebucht: getrennt sammeln, zaehlt nicht */
    let amt;
    if(cols.amount!=null)amt=parseNum(get(r,"amount"),de);
    else{
      const s=parseNum(get(r,"soll"),de),h=parseNum(get(r,"haben"),de);
      if(isNaN(s)&&isNaN(h))amt=NaN;else amt=(isNaN(h)?0:Math.abs(h))-(isNaN(s)?0:Math.abs(s));
    }
    if(isNaN(amt)){skipped++;continue;}
    if(cols.type!=null){const ty=get(r,"type").toLowerCase();if(/ausgang|belastung|abbuchung|abgang|^soll$|^debit$/.test(ty))amt=-Math.abs(amt);else if(/eingang|gutschrift|zugang|^haben$|^credit$/.test(ty))amt=Math.abs(amt);}
    if(cols.fee!=null){const f=parseNum(get(r,"fee"),de);if(!isNaN(f))amt-=Math.abs(f);}
    amt=Math.round(amt*100)/100;
    if(opt.inv)amt=-amt;
    const pOut=get(r,"payeeOut"),pIn=get(r,"payeeIn"),pg=get(r,"payee");
    const p=amt<0?(pOut||pg||pIn):(pIn||pg||pOut);
    const bal=cols.bal!=null?parseNum(get(r,"bal"),de):NaN;
    const ibr=get(r,"iban").replace(/\s/g,"").toUpperCase(),cr=get(r,"cred").trim(),rf=get(r,"ref").replace(/\s/g,"");
    const row={d,amt,p:p||"",t:get(r,"text"),b:isNaN(bal)?undefined:(opt.inv?-bal:bal),x:(amt<0?pIn:pOut)||undefined,ib:ibr.length>=10?cyrb53(ibr):undefined,g:cr||undefined};
    if(rf.length>=6&&!/^(NOTPROVIDED|NONREF|0+)$/i.test(rf))row.ref=rf;
    if(isPend){row.pv=1;pend.push(row);continue;}
    if(cols.btext!=null){const w=norm(get(r,"btext")).toLowerCase();const neg=NEGW.test(w),pos=POSW.test(w);if(neg!==pos){cn++;if((neg&&amt>0)||(pos&&amt<0))cb++;}}
    out.push(row);
  }
  /* Reihenfolge: o = je höher, desto neuer (Dateien sind oft neueste zuerst) */
  const newestFirst=out.length>1&&out[0].d>=out[out.length-1].d;
  out.forEach((x,i)=>{x.o=newestFirst?out.length-1-i:i;});
  return {rows:out,skipped,conf:{n:cn,bad:cb},pend};
}
/* Saldo-Differenz-Pruefung: passt die Saldo-Spalte nur mit umgekehrten Vorzeichen? */
function signCheck(rows){
  const r=rows.filter(x=>x.b!=null);if(r.length<6||r.length<rows.length*0.7)return null;
  const run=list=>{let fwd=0,inv=0,n=0;for(let i=1;i<list.length;i++){const diff=Math.round((list[i].b-list[i-1].b)*100)/100,a=list[i].amt;n++;if(Math.abs(diff-a)<0.015)fwd++;else if(Math.abs(diff+a)<0.015)inv++;}return {fwd,inv,n};};
  const A=run(r),B=run([...r].reverse()),x=A.fwd+A.inv>=B.fwd+B.inv?A:B;
  return {n:x.n,fwd:x.fwd,inv:x.inv,suggestInv:x.n>=5&&x.inv>=x.n*0.7&&x.fwd<x.n*0.2};
}
function assignHashes(rows,accId){
  const seen={};
  for(const r of rows){
    const base=cyrb53(r.d+"|"+Math.round(r.amt*100)+"|"+norm((r.p||"")+" "+(r.t||""))+"|"+accId);
    const n=seen[base]=(seen[base]||0)+1;
    r.h=n>1?base+"#"+(n-1):base;
  }
  return rows;
}

/* ---------- Kategorisierung ---------- */
/* ---------- Wort-Matching (keine Teilstrings) ---------- */
const kwCache=new Map();
const tok=s=>norm(s).split(/[^A-Z0-9]+/).filter(Boolean);
function kwParse(k){
  let r=kwCache.get(k);if(r)return r;
  const [main,...ex]=String(k).split("!");
  const parts=main.split("+").map(x=>{x=x.trim();const pre=x.startsWith("*"),suf=x.endsWith("*"),core=x.replace(/^\*+|\*+$/g,"").replace(/[\^$]/g,"");return {seq:tok(core),pre,suf};}).filter(p=>p.seq.length);
  r={parts,ex:ex.flatMap(tok)};kwCache.set(k,r);return r;
}
function partMatch(p,toks){
  const n=p.seq.length;
  for(let i=0;i+n<=toks.length;i++){
    let ok=true;
    for(let j=0;j<n;j++){
      const t=toks[i+j],w=p.seq[j];
      const hit=w.length<=3||n!==1?t===w:(p.pre&&p.suf?t.includes(w):p.pre?t.endsWith(w):p.suf?t.startsWith(w):t===w);
      if(!hit){ok=false;break;}
    }
    if(ok)return true;
  }
  return false;
}
function kwMatch(r,toks){
  if(!r.parts.length)return false;
  if(!r.parts.every(p=>partMatch(p,toks)))return false;
  if(r.ex.length&&r.ex.some(e=>toks.includes(e)))return false;
  return true;
}
function kwRe(k){const r=kwParse(k);return {test:s=>kwMatch(r,tok(s))};}
function merchantKey(t){
  let raw=t.p||t.t||"";
  if(/^(PAYPAL|KLARNA|SUMUP|ZETTLE)/.test(norm(raw))){const m=/EINKAUF BEI\s+(.+)$/.exec(norm(t.t||""));if(m&&m[1].length>2)raw=m[1];}
  const src=norm(raw).replace(/[^A-Z ]/g," ").replace(/\s+/g," ").trim();
  const stop=new Set(["KARTENZAHLUNG","LASTSCHRIFT","SAGT","DANKE","GMBH","MARKT","SE","AG","KG","UND","ONLINE","PURCHASE","EC","SEPA","ZAHLUNG","MIT","GIROCARD","VISA","DEBIT"]);
  const w=src.split(" ").filter(x=>x.length>=2&&!stop.has(x)).slice(0,2);
  return w.join(" ")||src.slice(0,20);
}
const SALARY_TXT=/GEHALT|(?:^|[^A-Z])LOHN|BEZUEGE|BESOLDUNG|ARBEITGEBER|(?:^|[^A-Z])RENTE(?:[^A-Z]|$)/;
const TRANSFER_TXT=/UEBERTRAG|UMBUCHUNG|EIGEN|SPARKONTO|TAGESGELD|KREDITKARTE|AMEX|AMERICAN EXPRESS|REVOLUT|TOP-?UP|AUSGLEICH|DAUERAUFTRAG|ZAHLUNG ERHALTEN/;
const isCardPay=t=>/AMEX|AMERICAN EXPRESS|KREDITKARTE|ZAHLUNG ERHALTEN|AEME/.test(norm((t.p||"")+" "+(t.t||"")));
const SAL_TOK=toks=>toks.some(t=>t.startsWith("GEHALT")||t==="LOHN"||t==="BEZUEGE"||t==="BESOLDUNG"||t==="ARBEITGEBER"||t==="RENTE");
const HOUS_TXT=toks=>toks.some(t=>t.endsWith("MIETE")||t==="MIETZAHLUNG"||t==="HAUSVERWALTUNG"||t==="VERMIETER"||t==="WOHNUNGSMIETE");
const HOUS_PAY=toks=>toks.some(t=>t==="HAUSVERWALTUNG"||t==="VERMIETER"||t.startsWith("WOHNUNGSBAU")||t.startsWith("IMMOBILIEN")||t==="WOHNBAU"||t==="GENOSSENSCHAFT");
/* Kategorie-Woerter, die im Verwendungszweck als ganzes Wort stehen. Sie schlagen Laden-Regeln (dm, REWE, PayPal).
   Zusammensetzungen nur bei langen, eindeutigen Woertern (Kaltmiete, Kfzversicherung), nie bei dm/o2/jet. */
const PURPOSE_MAP=[
  ["Miete",["MIETE","KALTMIETE","WARMMIETE","MIETZAHLUNG","WOHNUNGSMIETE","HAUSVERWALTUNG","VERMIETER"]],
  ["Versicherungen",["VERSICHERUNG","VERSICHERUNGEN","HAFTPFLICHT","KRANKENKASSE"]],
  ["Strom & Nebenkosten",["NEBENKOSTEN","HEIZKOSTEN","FERNWAERME","STROM","STADTWERKE","GRUNDSTEUER","MUELLABFUHR","WASSER","GAS"]],
  ["Lebensmittel",["LEBENSMITTEL"]],
  ["Drogerie",["DROGERIE"]],
  ["Tanken",["TANKEN","TANKSTELLE"]],
  ["GEZ/Rundfunk",["GEZ","RUNDFUNK","BEITRAGSSERVICE"]],
  ["Friseur",["FRISEUR"]],
  ["Weiterbildung",["WEITERBILDUNG","FORTBILDUNG"]],
  ["Sparen",["SPAREN","SPARPLAN"]],
  ["Rücklagen",["RUECKLAGE","RUECKLAGEN"]],
  ["Abos",["ABONNEMENT","ABOS"]],
  ["Bekleidung",["BEKLEIDUNG"]],
  ["Freizeit",["FREIZEIT"]],
  ["Bargeld",["BARGELDAUSZAHLUNG","GELDAUTOMAT"]]
];
const PURPOSE_COMPOUND=new Set(["MIETE","VERSICHERUNG","VERSICHERUNGEN","HAFTPFLICHT","KRANKENKASSE","NEBENKOSTEN","HEIZKOSTEN","FERNWAERME","MIETZAHLUNG","WOHNUNGSMIETE","HAUSVERWALTUNG","FIXKOSTEN","FIXKOSTENANTEIL"]);
const FIX_WORDS=["FIXKOSTEN","FIXKOSTENANTEIL"];
const SHOP_CATS=new Set(["Drogerie","Lebensmittel","Online-Shopping","Essen gehen","Bekleidung","Freizeit","Friseur","Tanken","Bargeld","Gesundheit","Reisen"]);
function wordHit(toks,w){
  for(const t of toks){
    if(t===w)return true;
    if(w.length<=3||!PURPOSE_COMPOUND.has(w)||t.length<=w.length)continue;
    if(t.startsWith(w)||t.endsWith(w)||(w.length>=8&&t.includes(w)))return true;
  }
  return false;
}
function purposeSignal(text){
  const toks=tok(text||"");
  for(const [cat,words] of PURPOSE_MAP)if(words.some(w=>wordHit(toks,w)))return {cat};
  if(FIX_WORDS.some(w=>wordHit(toks,w)))return {fix:1};
  return null;
}
function purposeKey(t){
  const stop=new Set(["UND","ODER","DER","DIE","DAS","DEN","DEM","DES","EIN","EINE","EINER","EINEM","VON","MIT","FUER","FUR","AUF","AUS","ZUM","ZUR","SEPA","SVWZ","UEBERWEISUNG","DAUERAUFTRAG","LASTSCHRIFT","RECHNUNG","ZAHLUNG","BETRAG","EURO","EUR","KARTE","KARTENZAHLUNG","GUTSCHRIFT","BASISLASTSCHRIFT","FOLGELASTSCHRIFT","EINZELLASTSCHRIFT","REFERENZ","KUNDENREFERENZ","MANDATSREFERENZ","GLAEUBIGER","NOTPROVIDED","EREF","KREF","MREF","WOHNUNG"]);
  const words=tok(t&&t.t||"").filter(w=>w.length>=4&&!stop.has(w)&&!/^\d+$/.test(w));
  const prefer=["FIXKOSTEN","FIXKOSTENANTEIL","MIETE","KALTMIETE","WARMMIETE","MIETZAHLUNG","WOHNUNGSMIETE","VERSICHERUNG","VERSICHERUNGEN","HAFTPFLICHT","NEBENKOSTEN","HEIZKOSTEN"];
  return words.find(w=>prefer.some(p=>wordHit([w],p)))||words[0]||"";
}
/* Beträge ab 400 Euro im Monatsturnus (gleicher Empfaenger, +-10 %, mindestens 3 Monate): nur fuer unsortierte Buchungen -> Miete */
function recurringBig(S){
  const g=new Map(),out=new Set();
  for(const t of S.tx){if(t.amt<=-400&&!t.man){const k=norm(t.p||"").slice(0,30);if(k)(g.get(k)||g.set(k,[]).get(k)).push(t);}}
  for(const arr of g.values()){
    for(const a of arr){
      const ms=new Set(arr.filter(o=>Math.abs(o.amt-a.amt)<=Math.abs(a.amt)*0.10).map(o=>o.d.slice(0,7)));
      if(ms.size>=3)out.add(a.h);
    }
  }
  return out;
}
function ruleHit(rules,amt,toksAll,toksP){
  for(const r of rules){
    if(r.pos&&!(amt>0))continue;if(r.neg&&!(amt<0))continue;if(r.min&&Math.abs(amt)<r.min)continue;if(r.in&&!(amt>0))continue;
    if(kwMatch(r.p,r.in?toksP:toksAll))return r;
  }
  return null;
}
/* Pruefreihenfolge: (1) Einzelzuordnung des Nutzers, Nutzerregeln; (2) Kategorie-Wort im Verwendungszweck
   (Miete, Versicherung, Fixkosten schlaegt dm); (3) Standardregeln; (4) Gehalt; (5) Wohnen;
   (6) eigene Konten/Umbuchung; (7) Rest unsortiert. */
function resolveAll(S){
  const cats=new Set(S.cats),userR=[],defR=[];
  for(const r of S.rules){
    if(!cats.has(r.c))continue;
    const pr={p:kwParse(r.k),c:r.c,in:!!r.in,pos:!!r.pos,neg:!!r.neg,min:r.min||0};
    (DEFKEYS.has(norm(r.k)+"|"+r.c)?defR:userR).push(pr);
  }
  const mBig=cats.has("Miete")?recurringBig(S):new Set();
  const myN=((S.profile&&S.profile.myNames)||[]).map(norm).filter(x=>x.length>=5),myI=new Set((S.profile&&S.profile.myIbans)||[]);
  const out=new Map(),manual=new Set();
  for(const t of S.tx){
    let c=null,user=false;
    const tp=tok(t.p||""),ta=tok((t.p||"")+" "+(t.t||""));
    if(t.c&&cats.has(t.c)){c=t.c;manual.add(t.h);}
    else{
      const h1=ruleHit(userR,t.amt,ta,tp);
      if(h1){c=h1.c;user=true;}
      else{
        const sig=purposeSignal(t.t||"");
        if(sig&&sig.cat&&cats.has(sig.cat))c=sig.cat;
        else{const h2=ruleHit(defR,t.amt,ta,tp);if(h2&&!(sig&&sig.fix&&SHOP_CATS.has(h2.c)))c=h2.c;}
      }
    }
    if(t.nt&&c===TRANSFER&&!manual.has(t.h))c=null; /* vom Nutzer zurückgeholt */
    const auto=!manual.has(t.h);
    /* Gehalt: Stichwort + positiv + mindestens 500 Euro; nie Umbuchung oder Sparen */
    if(auto&&!user&&t.amt>=500&&(c==null||c===TRANSFER||c==="Sparen"||c==="Rücklagen")&&SAL_TOK(ta))c=INCOME;
    /* Wohnen: Vermieter-/Miet-Woerter schlagen Namens-Treffer anderer Regeln */
    if(auto&&t.amt<0&&cats.has("Miete")){
      if(Math.abs(t.amt)>=200&&c!==TRANSFER&&c!=="Sparen"&&c!=="Rücklagen"&&(HOUS_TXT(tok(t.t||""))||HOUS_PAY(tp)))c="Miete";
      else if(c==null&&Math.abs(t.amt)>=400&&mBig.has(t.h))c="Miete";
    }
    /* Eigene Konten: Gegenueber ist der Kontoinhaber (Name) oder ein eigenes Konto (IBAN) */
    const who=t.p?norm(t.p):(t.src==="pdf"||!t.p)?norm(t.t||"").slice(0,40):""; /* PDF: Gegenueber steht am Anfang des Textes */
    if(auto&&!user&&!t.nt&&!(c===INCOME&&SAL_TOK(ta))&&((myN.length&&myN.some(n=>who.includes(n)))||(t.ib&&myI.has(t.ib))))c=TRANSFER;
    out.set(t.h,c);
  }
  /* Umbuchungen zwischen eigenen Konten: exakt gleicher Betrag, gegenläufig, verschiedene Konten, max. 3 Tage,
     und der Text sieht nach Übertrag aus ODER es gibt genau einen Kandidaten. */
  const flex=new Set([null,TRANSFER,"Sparen","Rücklagen"]);
  const COMPANY=/(^|[^A-Z])(GMBH|MBH|AG|UG|KG|GBR|OHG|SE|E.V.?|STADT|LAND|BUNDESAGENTUR|FINANZAMT|UNIVERSITAET)([^A-Z]|$)/;
  const cand=S.tx.filter(t=>!manual.has(t.h)&&!t.nt&&Math.abs(t.amt)>=5&&flex.has(out.get(t.h))&&!(t.amt>0&&COMPANY.test(norm((t.p||"")+" "+(t.t||"")))&&!TRANSFER_TXT.test(norm((t.p||"")+" "+(t.t||""))))).sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
  const buckets=new Map();
  for(const t of cand){const k=Math.round(Math.abs(t.amt)*100);(buckets.get(k)||buckets.set(k,{neg:[],pos:[]}).get(k))[t.amt<0?"neg":"pos"].push(t);}
  const near=(x,y)=>x.a!==y.a&&Math.abs(dayNum(x.d)-dayNum(y.d))<=3;
  const txt=t=>TRANSFER_TXT.test(norm((t.p||"")+" "+(t.t||"")));
  const used=new Set();
  for(const b of buckets.values()){
    for(const n of b.neg){
      const cs=b.pos.filter(p=>!used.has(p.h)&&near(n,p));
      if(!cs.length)continue;
      let best=cs[0],bd=1e9;for(const p of cs){const dd=Math.abs(dayNum(n.d)-dayNum(p.d));if(dd<bd){bd=dd;best=p;}}
      const rev=b.neg.filter(x=>x!==n&&!used.has(x.h)&&near(x,best)).length;
      const ok=txt(n)||txt(best)||(cs.length===1&&rev===0&&Math.abs(n.amt)<500);
      if(!ok)continue;
      used.add(best.h);used.add(n.h);
      const cn=out.get(n.h),cp=out.get(best.h);
      out.set(best.h,TRANSFER);
      out.set(n.h,cn==="Sparen"||cp==="Sparen"?"Sparen":(cn==="Rücklagen"||cp==="Rücklagen"?"Rücklagen":TRANSFER));
    }
  }
  /* Dauerauftrag auf ein eigenes Konto ("Versicherungen Wohnung" an dich selbst): Die Gutschrift im anderen Konto ist eine
     Eigenueberweisung, gleicher Betrag, gleicher Verwendungszweck, max. 3 Tage. Dann ist auch die Abbuchung eine Umbuchung,
     selbst wenn eine Regel (z. B. "Versicherung") traf. Die echte Ausgabe zaehlt dort, wo sie abgebucht wird. */
  const nz=t=>norm(t.t||"").replace(/[^A-Z0-9]/g,"");
  const posT=S.tx.filter(t=>t.amt>0&&out.get(t.h)===TRANSFER&&!used.has(t.h)&&nz(t).length>=5);
  if(posT.length){
    const idx=new Map();for(const p of posT){const k=Math.round(p.amt*100)+"|"+nz(p);(idx.get(k)||idx.set(k,[]).get(k)).push(p);}
    for(const n of S.tx){
      if(n.amt>=0||manual.has(n.h)||n.nt||used.has(n.h))continue;const c=out.get(n.h);if(c===TRANSFER||c===INCOME)continue;
      const arr=idx.get(Math.round(-n.amt*100)+"|"+nz(n));if(!arr)continue;
      const p=arr.find(p=>!used.has(p.h)&&near(n,p));if(!p)continue;
      used.add(p.h);used.add(n.h);out.set(n.h,c==="Sparen"||c==="Rücklagen"?c:TRANSFER);
    }
  }
  return out;
}
let _catCache={ver:-1,map:null};
function catsOf(S,ver){ if(_catCache.ver!==ver||_catCache.S!==S){_catCache={ver,S,map:resolveAll(S)};} return _catCache.map; }

/* ---------- Auswertung ---------- */
/* Einnahmen = nur Kategorie Einkommen. Alle anderen positiven Betraege (Rueckzahlungen, Beitraege, Gutschriften) sind
   "Weitere Eingaenge" (other): sie zaehlen in Uebrig als Geldzufluss, nie in Einnahmen. Nichts wird mit Ausgaben verrechnet. */
/* Art eines Einkommens: Gehalt (Lohn, Gehalt, Bezuege, Rente, eigene Gehaltsregel), Foerderung (AFBG, BAfoeG ...), sonstiges (Kindergeld, Steuer) */
const FOE_TOK=toks=>toks.some(t=>t==="AFBG"||t.startsWith("BAFOEG")||t==="BAFOG"||t.startsWith("FOERDERUNG")||t==="ELTERNGELD"||t==="ARBEITSAGENTUR"||t==="BUNDESAGENTUR"||t==="AUFSTIEGSBAFOEG")||/(^| )L BANK( |$)/.test(toks.join(" "));
const OTH_TOK=toks=>toks.some(t=>t==="KINDERGELD"||t==="STEUERERSTATTUNG"||t==="FINANZAMT"||t==="FAMILIENKASSE");
function incKind(t){const tk=tok((t.p||"")+" "+(t.t||""));if(SAL_TOK(tk))return "sal";if(FOE_TOK(tk))return "foe";if(OTH_TOK(tk))return "oth";return "sal";}
const MONTHS_SHORT=["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const INC_KIND_LABEL={sal:"Gehalt",foe:"Förderung (AFBG, BAföG …)",oth:"Sonstiges Einkommen (Kindergeld, Steuer …)"};
function monthAgg(S,ym,cmap){
  const a={inc:0,other:0,exp:0,byCat:{},unsorted:[],n:0,tx:[],incTx:[],trans:[],transSum:0,fix:0,var:0,save:0,unsOut:0,unsIn:0,tradeIn:0,tradeOut:0,last:"",ins:[],insSum:0,sal:0,foe:0,incOth:0,pend:[]};
  for(const p of S.pend||[])if(mkey(p)===ym)a.pend.push(p);
  for(const t of S.tx){
    if(mkey(t)!==ym)continue;
    a.n++;if(t.d>a.last)a.last=t.d;
    const c=cmap.get(t.h);
    if(c===TRANSFER){a.trans.push(t);continue;}
    a.tx.push(t);
    if(c===INCOME){a.inc+=t.amt;if(t.amt>0)a.incTx.push(t);const k=incKind(t);if(k==="sal")a.sal+=t.amt;else if(k==="foe")a.foe+=t.amt;else a.incOth+=t.amt;continue;}
    if(t.amt>0){
      a.other+=t.amt;a.ins.push(t);a.insSum+=t.amt;
      if(c==null){a.unsIn+=t.amt;a.unsorted.push(t);}
      else{const b=a.byCat[c]||(a.byCat[c]={net:0,tx:[]});b.tx.push(t);if(c==="Trading")a.tradeIn+=t.amt;}
      continue;
    }
    if(c==null){a.unsOut-=t.amt;a.exp-=t.amt;a.unsorted.push(t);continue;}
    const b=a.byCat[c]||(a.byCat[c]={net:0,tx:[]});b.tx.push(t);
    if(c==="Trading")a.tradeOut-=t.amt;
    a.exp-=t.amt;b.net-=t.amt;a[groupOf(S,c)]-=t.amt;
  }
  const neg=a.trans.filter(t=>t.amt<0).reduce((s,t)=>s-t.amt,0),pos=a.trans.filter(t=>t.amt>0).reduce((s,t)=>s+t.amt,0);
  a.transSum=Math.max(neg,pos);
  a.saldo=a.inc+a.other-a.exp;
  return a;
}
/* Gehalt, das kurz vor Monatsende bzw. zu Monatsbeginn gebucht wurde und deshalb im Nachbarmonat steht */
function boundaryIncome(S,ym,cmap){
  const out=[];
  for(const t of S.tx){
    if(t.amt<=0||cmap.get(t.h)!==INCOME||t.mo)continue;
    const k=t.d.slice(0,7),day=+t.d.slice(8,10);
    if(k===shiftYM(ym,-1)&&day>=daysIn(k)-2)out.push(t);
    else if(k===shiftYM(ym,1)&&day<=3)out.push(t);
  }
  return out.sort((a,b)=>b.amt-a.amt);
}
/* Dauerposten: je Monat ab Startdatum bis Enddatum (max. laufender Monat) eine Buchung mit festem Hash erzeugen */
function materializeRecur(S,today){
  let ch=false;const have=new Set(S.tx.map(t=>t.h)),del=new Set(S.del||[]),cur=today.slice(0,7);
  for(const r of S.recur||[]){
    const end=r.end?r.end.slice(0,7):cur,last=end<cur?end:cur,sd=+r.start.slice(8,10);let m=r.start.slice(0,7);
    while(m<=last){
      const h="rec-"+r.id+"-"+(r.rev||1)+"-"+m,d=m+"-"+pad2(Math.min(sd,daysIn(m)));
      if(!have.has(h)&&!del.has(h)&&d>=r.start&&!(r.end&&d>r.end)){S.tx.push({h,a:r.a||"man",d,amt:r.amt,p:r.n,t:"Dauerposten",c:r.cat,man:true,rec:r.id,u:Date.now()});have.add(h);ch=true;}
      m=shiftYM(m,1);
    }
  }
  return ch;
}
function removeRecurTx(S,id){
  const gone=S.tx.filter(t=>t.rec===id).map(t=>t.h);
  S.tx=S.tx.filter(t=>t.rec!==id);for(const h of gone)S.del.push(h);
}
/* Nur importierte Buchungen loeschen: manuelle Buchungen und Dauerposten bleiben, Einstellungen bleiben */
function wipeImported(S,now){
  let n=0;
  for(const t of S.tx)if(!t.man){S.delw[t.h]=now;n++;}
  S.tx=S.tx.filter(t=>t.man);
  S.del=S.del.filter(x=>x.startsWith("acc:")||x.startsWith("rec-"));
  return n;
}
/* Gemeinsamer Zeitraum aller (aktiven) Konten */
function commonPeriod(S){
  const cov=coverage(S);
  const accs=S.accounts.filter(a=>!a.virtual&&cov[a.id]).map(a=>({id:a.id,name:a.name,first:cov[a.id].first,last:cov[a.id].last,complete:cov[a.id].complete}));
  if(!accs.length)return null;
  const maxLast=accs.reduce((m,a)=>a.last>m?a.last:m,"");
  const act=accs.filter(a=>dayNum(maxLast)-dayNum(a.last)<=62); /* lange nicht mehr importierte Konten blockieren nicht */
  const from=act.reduce((m,a)=>a.first>m?a.first:m,"0000-00-00"),to=act.reduce((m,a)=>a.last<m?a.last:m,"9999-99-99");
  const lf=act.find(a=>a.first===from),lt=act.find(a=>a.last===to);
  const spans=act.map(a=>dayNum(a.last)-dayNum(a.first)).sort((x,y)=>x-y),med=spans[Math.floor(spans.length/2)];
  const warn=[];
  if(act.length>1)for(const a of act){const sp=dayNum(a.last)-dayNum(a.first);if(Math.abs(sp-med)>45)warn.push({id:a.id,name:a.name,kind:sp<med?"kürzer":"länger"});}
  const months=act.map(a=>a.complete).reduce((x,y)=>x.filter(m=>y.includes(m)));
  return {accs,act,from,to,ok:from<=to,limFrom:lf&&lf.name,limTo:lt&&lt.name,warn,months,lastMonth:months.length?months[months.length-1]:null,inactive:accs.filter(a=>!act.includes(a))};
}
/* Kreisdiagramm: stabile Farben je Kategorie */
const PALETTE=["#4f46e5","#0ea5e9","#14b8a6","#22c55e","#eab308","#f97316","#ef4444","#ec4899","#a855f7","#8b5cf6","#06b6d4","#84cc16","#f59e0b","#64748b","#d946ef","#10b981","#3b82f6","#e11d48","#7c3aed","#0d9488","#ca8a04"];
function catColor(k){
  if(k==null||k==="(unsortiert)")return "#9ca3af";if(k==="__more")return "#94a3b8";if(k==="__other")return "#38bdf8";
  let i=DEF_CATS.indexOf(k);if(i<0)i=parseInt(cyrb53(String(k)),36);
  return PALETTE[i%PALETTE.length];
}
function donutData(S,ym,cmap,mode){
  const sums=new Map();
  for(const t of S.tx){
    if(mkey(t)!==ym)continue;const c=cmap.get(t.h);if(c===TRANSFER)continue;
    let key,v;
    if(mode==="in"){if(t.amt<=0)continue;key=c===INCOME?INCOME:"__other";v=t.amt;}
    else if(mode==="acc"){if(t.amt>=0)continue;key=t.a;v=-t.amt;}
    else{if(t.amt>=0)continue;key=c==null?"(unsortiert)":c;v=-t.amt;}
    sums.set(key,(sums.get(key)||0)+v);
  }
  const total=[...sums.values()].reduce((a,b)=>a+b,0);
  let segs=[...sums.entries()].map(([key,amt])=>({key,amt,pct:total?amt/total*100:0,color:mode==="acc"?PALETTE[Math.max(0,S.accounts.findIndex(a=>a.id===key))%PALETTE.length]:catColor(key)})).sort((a,b)=>b.amt-a.amt);
  const small=segs.filter(s=>s.pct<3&&s.key!=="(unsortiert)"),big=segs.filter(s=>!(s.pct<3&&s.key!=="(unsortiert)"));
  let more=[];
  if(small.length>=2){more=small;const amt=small.reduce((s,x)=>s+x.amt,0);big.push({key:"__more",amt,pct:total?amt/total*100:0,color:catColor("__more"),members:small});segs=big.sort((a,b)=>(a.key==="__more")-(b.key==="__more")||b.amt-a.amt);}
  return {total,segs,more};
}
/* Ø pro Monat: Aufteilung des Einkommens fuer den kleinen Donut */
function incomeSplit(R){
  const parts=[["fix","Fixkosten",R.fix,"#4f46e5"],["var","Variabel",R.var,"#f97316"],["save","Sparen / Anlegen",R.save,"#22c55e"],["uns","Unsortiert",R.uns,"#9ca3af"],["left","Übrig",Math.max(0,R.left),"#14b8a6"]].filter(p=>p[2]>0.005);
  const total=parts.reduce((s,p)=>s+p[2],0);
  return {total,over:R.left<0,segs:parts.map(([key,label,amt,color])=>({key,label,amt,pct:total?amt/total*100:0,color}))};
}
/* Kontoinhaber aus den Daten ableiten: Name, der als Gegenueber der "eigenen Seite" (Zahlungspflichtige*r bei Ausgang, Empfaenger*in bei Eingang) haeufig vorkommt */
function detectOwnNames(rows){
  const cnt=new Map();
  for(const r of rows){const k=norm(r.x||"");if(!k||k==="ISSUER"||k.length<5)continue;cnt.set(k,(cnt.get(k)||0)+1);}
  const arr=[...cnt.entries()].sort((a,b)=>b[1]-a[1]);
  if(!arr.length||arr[0][1]<4)return {names:[],ibans:[]};
  const names=arr.filter(([,n],i)=>i<3&&n>=Math.max(4,arr[0][1]*0.5)).map(([k])=>k);
  const ib=new Set();for(const r of rows){if(!r.ib)continue;const np=norm(r.p||"");if(names.some(n=>np.includes(n)))ib.add(r.ib);}
  const first=names[0].split(" ")[0];
  if(first.length>=3){
    const gr=new Map();
    for(const r of rows){if(!r.ib||!r.p)continue;const np=norm(r.p);if(names.some(n=>np.includes(n))||!np.split(" ").includes(first))continue;gr.set(r.ib,(gr.get(r.ib)||0)+1);}
    for(const [k,n] of gr)if(n>=3)ib.add(k); /* gleiche IBAN, mehrfach, Empfaenger traegt den Vornamen: eigenes Konto */
  }
  return {names,ibans:[...ib]};
}
/* Fuer bereits importierte Daten (ohne gespeicherten Namen): Gegenueber, das als Person haeufig Eingaenge UND Ausgaenge hat = vermutlich der Kontoinhaber (nur Vorschlag mit Rueckfrage) */
const COMP_RE=/(^| )(GMBH|MBH|AG|KG|UG|BANK|MARKT|SHOP|STORE|VERSICHERUNG|SPARKASSE|STADT|LTD|INC|EUROPE|LUXEMBOURG|ONLINE|PAYMENTS|EG|CO|SERVICE|DEUTSCHLAND)( |$)/;
const PAYPROC=/^(PAYPAL|KLARNA|SUMUP|SQUARE|STRIPE|MOLLIE|RATEPAY|PAYONE|AMAZON PAYMENTS|APPLE|GOOGLE|VISA|MASTERCARD|SEPA|LASTSCHRIFT)/;
function detectOwnCandidate(S){
  if(S.profile&&(S.profile.myNames||[]).length)return null;
  const skip=new Set((S.profile&&S.profile.skipNames)||[]),g=new Map();
  for(const t of S.tx){
    if(t.man||!t.p)continue;const k=norm(t.p).slice(0,40);
    if(!k||skip.has(k)||PAYPROC.test(k)||COMP_RE.test(k)||!/^[A-Z][A-Z.\-]*( [A-Z.\-]+)+$/.test(k))continue;
    const e=g.get(k)||g.set(k,{pos:0,neg:0}).get(k);if(t.amt>0)e.pos++;else e.neg++;
  }
  for(const [k,e] of g)if(e.pos>=3&&e.neg===0){e.neg=S.tx.filter(t=>t.amt<0&&!t.man&&norm(t.p||"").startsWith(k+" ")).length;} /* z. B. Ausgang an "Name Sparkonto" */
  let best=null;for(const [k,e] of g)if(e.pos>=3&&e.neg>=1&&(!best||e.pos+e.neg>best.n))best={k,pos:e.pos,neg:e.neg,n:e.pos+e.neg};
  return best;
}
/* Gehaltsvorschlag ohne Stichwort: groesster regelmaessig wiederkehrender Eingang gleicher Absender (ein Eingang pro Monat) */
function detectSalary(S,cmap){
  const g=new Map();
  for(const t of S.tx){
    if(t.amt<=0)continue;const cat=cmap.get(t.h);if(cat===TRANSFER)continue;
    const k=norm(t.p||"").slice(0,30);if(!k)continue;(g.get(k)||g.set(k,[]).get(k)).push(t);
  }
  let best=null;
  for(const [k,arr] of g){
    const months=new Set(arr.map(t=>t.d.slice(0,7)));
    if(months.size<2||arr.length>months.size*1.6)continue;
    const am=arr.map(t=>t.amt).sort((a,b)=>a-b),med=am[Math.floor(am.length/2)];
    if(med<300||(months.size<3&&med<1000))continue;
    const score=med*Math.min(months.size,12);
    if(!best||score>best.score)best={k,name:(arr[0].p||k).slice(0,30),amt:Math.round(med),months:months.size,score};
  }
  return best;
}
/* Warnung beim Anlegen: trifft eine Regel sehr viele Buchungen oder Haendler? */
function ruleBreadth(S,k){
  const s=norm(k).replace(/^\^/,"").replace(/\$$/,""),re=kwRe(k),keys=new Set();let n=0;
  for(const t of S.tx){if(re.test(norm((t.p||"")+" "+(t.t||"")))){n++;keys.add(merchantKey(t));}}
  return {n,d:keys.size,short:s.length<4,broad:s.length<4||keys.size>30};
}
/* Regeln neu anwenden: Zuordnungen, die aus Regeln stammen (rl) oder von einer eigenen Regel gleicher Kategorie getragen werden, werden geloescht und neu berechnet. Einzeln gesetzte (mn) und alte Zuordnungen ohne passende Regel bleiben. */
function reapplyRules(S){
  const defs=new Set(expandRules().map(r=>norm(r.k)+"|"+r.c)),ur=S.rules.filter(r=>!defs.has(norm(r.k)+"|"+r.c)).map(r=>({re:kwRe(r.k),c:r.c,in:!!r.in}));
  let n=0;
  for(const t of S.tx){
    if(!t.c||t.mn||t.man)continue;
    const hs=norm((t.p||"")+" "+(t.t||"")),hp=norm(t.p||"");
    const derived=t.rl||ur.some(r=>r.c===t.c&&(!r.in||t.amt>0)&&r.re.test(r.in?hp:hs));
    if(derived){t.c=undefined;t.rl=undefined;t.u=Date.now();n++;}
  }
  return n;
}
/* Miete mit Monatsangabe im Verwendungszweck ("Miete Oktober", gebucht am 29.09.): zaehlt im genannten Monat (Feld mo) */
const MONTHS_DE={JANUAR:1,JAN:1,FEBRUAR:2,FEB:2,MAERZ:3,MRZ:3,APRIL:4,APR:4,MAI:5,JUNI:6,JUN:6,JULI:7,JUL:7,AUGUST:8,AUG:8,SEPTEMBER:9,SEPT:9,SEP:9,OKTOBER:10,OKT:10,NOVEMBER:11,NOV:11,DEZEMBER:12,DEZ:12};
function applyRentMonths(S,cm){
  let n=0;
  for(const t of S.tx){
    if(t.mo||t.amt>=0||cm.get(t.h)!=="Miete")continue;
    let mo=null;for(const w of tok(t.t||""))if(MONTHS_DE[w]){mo=MONTHS_DE[w];break;}
    if(!mo)continue;
    const by=+t.d.slice(0,4),bm=+t.d.slice(5,7);let best=null,bd=99;
    for(const y of [by-1,by,by+1]){const d=Math.abs((y*12+mo)-(by*12+bm));if(d<bd){bd=d;best=y;}}
    if(best==null||bd>3)continue;
    const key=best+"-"+pad2(mo);
    if(key!==t.d.slice(0,7)){t.mo=key;t.u=Date.now();n++;}
  }
  return n;
}
/* Plus/Minus einer Buchung umdrehen (Feld fl, Original oa). Ausgabe <-> Eingang; Kategorie wird neu berechnet:
   nur eine einzeln gesetzte Zuordnung (mn) bleibt, sonst wird sie geleert (merkt sich pc fuer das Zurueckdrehen).
   Nochmal umdrehen stellt das Original wieder her. Dauerposten sind ausgenommen. */
function flipTx(t){
  if(!t||t.rec)return false;
  if(t.fl){t.amt=t.oa;delete t.fl;delete t.oa;if(t.pc!==undefined){if(!t.c)t.c=t.pc;delete t.pc;}}
  else{t.oa=t.amt;t.amt=-t.amt;t.fl=true;if(t.c&&!t.mn){t.pc=t.c;t.c=undefined;t.rl=undefined;}}
  t.u=Date.now();return true;
}
/* Alle Buchungen desselben Gegenuebers (gleicher Haendler-Schluessel, gleiches Konto), die gleich "stehen" wie t:
   t umgedreht -> alle umgedrehten zurueck; t normal -> alle normalen umdrehen */
function flipGroup(S,t){
  const k=merchantKey(t),want=!!t.fl;
  return S.tx.filter(x=>x.a===t.a&&!x.rec&&merchantKey(x)===k&&!!x.fl===want);
}
/* Alle Buchungen eines Kontos in einem Monatsbereich (von..bis, YYYY-MM; leer = offen) */
function flipRangeList(S,accId,from,to){
  return S.tx.filter(x=>x.a===accId&&!x.man&&!x.rec&&(!from||mkey(x)>=from)&&(!to||mkey(x)<=to));
}
/* Diagnose je Konto: nur Zahlen, keine Texte oder Namen aus Buchungen */
function importDiag(S){
  return S.accounts.map(a=>{
    let n=0,pos=0,neg=0,np=0,nn=0,min="",max="";
    for(const t of S.tx){if(t.a!==a.id)continue;n++;if(t.amt>0){pos+=t.amt;np++;}else if(t.amt<0){neg+=t.amt;nn++;}if(!min||t.d<min)min=t.d;if(t.d>max)max=t.d;}
    return {id:a.id,name:a.name,inv:!!a.inv,n,pos,neg,np,nn,min,max};
  }).filter(x=>x.n>0);
}
function latestBal(S,accId){
  let best=null;
  for(const t of S.tx){ if(t.a!==accId||t.b==null)continue; if(!best||t.d>best.d||(t.d===best.d&&(t.o||0)>=(best.o||0)))best=t; }
  return best?best.b:null;
}
function incomeOf(S,ym,cmap){let s=0;for(const t of S.tx)if(mkey(t)===ym&&cmap.get(t.h)===INCOME)s+=t.amt;return s;}
/* Abdeckung je Konto: erstes bis letztes Buchungsdatum. Ein Monat ist fuer ein Konto nur "vollstaendig",
   wenn er komplett in diesem Zeitraum liegt (erster/letzter Monat meist nicht). */
function coverage(S){
  const o={};
  for(const t of S.tx){if(t.man||t.a==="man")continue;const e=o[t.a];if(!e)o[t.a]={first:t.d,last:t.d};else{if(t.d<e.first)e.first=t.d;if(t.d>e.last)e.last=t.d;}}
  for(const a in o){
    const e=o[a],cm=[];let m=e.first.slice(0,7);const end=e.last.slice(0,7);
    while(m<=end){if(e.first<=m+"-01"&&e.last>=m+"-"+pad2(daysIn(m)))cm.push(m);m=shiftYM(m,1);}
    e.complete=cm;
  }
  const un=new Set();for(const a in o)for(const m of o[a].complete)un.add(m);
  if(un.size)o.man={first:"",last:"",complete:[...un].sort()}; /* Manuell: voll abgedeckt in allen vollstaendigen Monaten */
  return o;
}
function coverageGaps(S,ym,cov){
  cov=cov||coverage(S);const out=[];
  for(const a of S.accounts){const e=cov[a.id];if(a.virtual||!e||e.complete.includes(ym))continue;out.push({id:a.id,name:a.name,first:e.first,last:e.last});}
  return out;
}
/* Gehalt je Monat ueber alle Konten. Ein Monat zaehlt, wenn er fuer das Konto der Gehaltsbuchung vollstaendig ist.
   Nur Gehalt (Lohn/Gehalt/Bezuege/Rente/eigene Gehaltsregel); Foerderung (AFBG, BAfoeG) und Kindergeld/Steuer stehen getrennt.
   Gibt es gar kein Gehalt, zaehlt alles Einkommen (z. B. nur BAfoeG). Dieselbe Zahlung in zwei Konten (gleicher Betrag, max. 3 Tage) zaehlt einmal. */
function salaryMonths(S,cmap){
  const cov=coverage(S),inc=S.tx.filter(t=>t.amt>0&&cmap.get(t.h)===INCOME).sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
  const hasSal=inc.some(t=>incKind(t)==="sal"),use=inc.filter(t=>!hasSal||incKind(t)==="sal");
  const seen=[],twins=[],by=new Map();
  for(const t of use){
    const tw=seen.find(x=>x.a!==t.a&&x.amt===t.amt&&Math.abs(dayNum(x.d)-dayNum(t.d))<=3);
    if(tw){twins.push([tw,t]);continue;}seen.push(t);
    const m=mkey(t),e=cov[t.a];if(!t.man&&!(e&&e.complete.includes(m)))continue;
    const o=by.get(m)||by.set(m,{m,v:0,tx:[]}).get(m);o.v+=t.amt;o.tx.push(t);
  }
  return {months:[...by.values()].sort((a,b)=>a.m<b.m?-1:1),twins,hasSal};
}
/* Typisches Gehalt bis anchor: Ø der letzten K Monate mit Gehalt; Sonderzahlungen (ueber 125 % des Medians der letzten 12 Monate) bleiben aussen vor */
function incomeAvgComplete(S,cmap,anchor,K){
  const sm=salaryMonths(S,cmap),all=sm.months.filter(o=>o.m<=anchor&&o.v>0);if(!all.length)return null;
  const ref=all.slice(-12).map(o=>o.v),med=ref.length>=3?medianOf2(ref):0;
  const isB=o=>med>0&&o.v>med*1.25,norm3=all.filter(o=>!isB(o)).slice(-K),use=norm3.length?norm3:all.slice(-K);
  const bonus=all.filter(o=>isB(o)&&o.m>=use[0].m).map(o=>o.m);
  return {v:use.reduce((s,o)=>s+o.v,0)/use.length,n:use.length,bonus,med,months:all,twins:sm.twins};
}
/* Einnahmen-Statistik fuer die Anzeige: je Monat Gehalt, typisch, Spanne, Sonderzahlungs-Monate */
function salaryStats(S,cmap,anchor){
  const sm=salaryMonths(S,cmap),ms=sm.months.filter(o=>o.m<=anchor&&o.v>0).slice(-12);if(!ms.length)return null;
  const vals=ms.map(o=>o.v),med=medianOf2(vals);
  return {months:ms,med,min:Math.min(...vals),max:Math.max(...vals),bonus:vals.length>=3?ms.filter(o=>o.v>med*1.25).map(o=>o.m):[],twins:sm.twins};
}
const medianOf2=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length;return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):0;};
function effIncome(S,ym,cmap,today){
  today=today||todayStr();
  if(S.budget.income>0)return {v:S.budget.income,src:"manuell"};
  const cur=today.slice(0,7),start=ym===cur?shiftYM(ym,-1):ym; /* laufender Teilmonat zaehlt nicht */
  const ic=incomeAvgComplete(S,cmap,start,3);
  if(ic)return {v:ic.v,src:"aus Buchungen (Ø "+ic.n+" Monate"+(ic.bonus.length?", ohne Sonderzahlung "+ic.bonus.map(m=>MONTHS_SHORT[+m.slice(5,7)-1]).join("/"):"")+")",bonus:ic.bonus,n:ic.n};
  for(let k=0;k<3;k++){const v=incomeOf(S,shiftYM(start,-k),cmap);if(v>0)return {v,src:"aus Buchungen (Monat unvollständig)"};}
  const v=incomeOf(S,ym,cmap);if(v>0)return {v,src:"aus Buchungen, laufender Monat"};
  if(S.profile&&S.profile.income>0)return {v:S.profile.income,src:"aus deiner Einrichtung"};
  if(S.budget.planIncome>0)return {v:S.budget.planIncome,src:"Plan"};
  return {v:0,src:"fehlt",missing:true};
}
/* Ø pro Monat: je Konto nur dessen vollstaendige Monate (letzte N, N=0: alle), Ø = Summe / Anzahl dieser Monate.
   Betraege stehen so, wie sie gebucht wurden. Fixkosten werden je Haendler/Empfaenger und Betrag (+-10 %) zu Posten
   zusammengefasst: Betrag = zuletzt gebuchter regelmaessiger Betrag, Einmalzahlungen bleiben einfach aussen vor.
   Einnahmen = nur Kategorie Einkommen, "other" = weitere Eingaenge. */
const medianOf=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0;};
function fixPosts(arr,allArr,n){
  const need=n>=2?Math.max(2,Math.ceil(n*0.5)):1,byK=new Map(),posts=[];
  for(const o of arr)(byK.get(o.key)||byK.set(o.key,[]).get(o.key)).push(o);
  for(const [key,list] of byK){
    const used=new Set(),sorted=[...list].sort((x,y)=>x.amt-y.amt);
    for(const a of sorted){
      if(used.has(a.h))continue;
      const cl=sorted.filter(o=>!used.has(o.h)&&Math.abs(o.amt-a.amt)<=a.amt*0.10),ms=new Set(cl.map(o=>o.m));
      if(ms.size<need)continue;
      cl.forEach(o=>used.add(o.h));
      const med=medianOf(cl.map(o=>o.amt));
      const latest=allArr.filter(o=>o.key===key&&Math.abs(o.amt-med)<=med*0.25).sort((x,y)=>x.d<y.d?1:-1)[0];
      const per=Math.max(1,medianOf([...ms].map(m=>cl.filter(o=>o.m===m).length)));
      posts.push({key,name:cl[0].name,amt:(latest?latest.amt:med)*per,count:per});
    }
  }
  return posts.sort((x,y)=>y.amt-x.amt);
}
function avgReport(S,cmap,N,opt,today){
  const cov=coverage(S),rows={},accs=[];
  let inc=0,incN=0,nMin=0,tradeIn=0,other=0,moved=0;
  for(const a of S.accounts){
    const e=cov[a.id];if(!e||!e.complete.length)continue;
    const ms=N?e.complete.slice(-N):e.complete,set=new Set(ms),n=ms.length;
    accs.push({id:a.id,name:a.name,n,first:e.first,last:e.last});
    nMin=nMin?Math.min(nMin,n):n;
    const winOut={},allOut={};let ai=0,ao=0,mv=0;
    for(const t of S.tx){
      if(t.a!==a.id)continue;
      const cat=cmap.get(t.h),m=mkey(t);
      if(cat===TRANSFER){if(t.amt<0&&set.has(m)&&!isCardPay(t))mv-=t.amt;continue;}
      if(t.amt<0){
        const k=cat==null?"(unsortiert)":cat,o={h:t.h,d:t.d,m,amt:-t.amt,key:merchantKey(t),name:(t.p||t.t||"").slice(0,30)};
        (allOut[k]||(allOut[k]=[])).push(o);if(set.has(m))(winOut[k]||(winOut[k]=[])).push(o);
      }else if(set.has(m)){
        if(cat===INCOME)ai+=t.amt;else{ao+=t.amt;if(cat==="Trading")tradeIn+=t.amt/n;}
      }
    }
    if(ai>0){inc+=ai/n;incN=incN?Math.min(incN,n):n;}
    other+=ao/n;moved+=mv/n;
    for(const k in winOut){
      const grp=k==="(unsortiert)"?"uns":groupOf(S,k),arr=winOut[k];
      let val=arr.reduce((s,o)=>s+o.amt,0)/n,posts=[];
      if(grp==="fix"){posts=fixPosts(arr,allOut[k],n);if(posts.length||n>=2)val=posts.reduce((s,p)=>s+p.amt,0);}
      const r0=rows[k]||(rows[k]={cat:k,avg:0,val:0,n,posts:[]});
      r0.avg+=val;r0.val+=val;r0.n=Math.min(r0.n,n);for(const p of posts)r0.posts.push(p);
    }
  }
  const list=Object.values(rows).map(r=>Object.assign(r,{group:r.cat==="(unsortiert)"?"uns":groupOf(S,r.cat),posts:r.posts.sort((x,y)=>y.amt-x.amt)})).sort((x,y)=>y.val-x.val);
  const sum=g=>list.filter(r=>r.group===g).reduce((s,r)=>s+r.val,0);
  const fix=sum("fix"),vr=sum("var"),save=sum("save"),uns=sum("uns"),tc=list.find(r=>r.cat==="Trading");
  return {rows:list,accs,inc,incN,other,moved,fix,var:vr,save,uns,left:inc+other-fix-vr-save-uns,nMin,tradeIn,tradeCost:tc?tc.val:0};
}

function refOf(S,it,income){
  const fs=fixedSum(S,it),plan=fs>0?fs:(it.plan>0?it.plan:null),de=it.pct>0&&income>0?income*it.pct/100:null;
  let ref=null,src="",std=false;const m=S.budget.mode;
  if(m==="max"){ref=Math.max(plan||0,de||0)||null;src=ref===plan?"Plan":"Durchschnitt DE";}
  else if(m==="avg"){ref=de!=null?de:plan;src=de!=null?"Durchschnitt DE":"Plan";}
  else{ref=plan!=null?plan:de;src=plan!=null?"Plan":"Durchschnitt DE";std=plan==null&&de!=null;} /* Standardwert, wenn kein eigener Plan */
  return {plan,de,ref,src,std};
}
function itemIst(it,a){let s=0;for(const c of it.cats)if(a.byCat[c])s+=a.byCat[c].net;return s;}
/* grün unter 90 %, gelb ab 90 % bis zum Richtwert, rot erst darüber (genau 100 % ist noch gelb) */
function ampel(S,it,ist,ref){
  if(!(ref>0))return "n";
  const q=ist/ref*100;
  if(it.goal)return q>=S.budget.g?"g":"n";
  return ist-ref>0.5?"r":(q>=S.budget.g?"y":"g");
}
/* Bezugstag = min(heute, letzte Buchung im Monat). Vor dem 8. keine Hochrechnung, Fixposten nie. */
function projection(it,ist,ym,today,lastTx){
  if(ym!==today.slice(0,7))return ist;
  const dim=daysIn(ym);let day=+today.slice(8,10);
  if(lastTx&&lastTx.slice(0,7)===ym)day=Math.min(day,+lastTx.slice(8,10));
  if(day<8||day>=dim||it.fix)return ist;
  return ist/day*dim;
}
function projDay(ym,today,lastTx){let day=+today.slice(8,10);if(ym!==today.slice(0,7))return 0;if(lastTx&&lastTx.slice(0,7)===ym)day=Math.min(day,+lastTx.slice(8,10));return day;}
/* Vorschlag (nie automatisch): gleicher Haendler, Betrag +-5 %, in mindestens 3 verschiedenen Monaten */
function detectRecurring(S,cmap){
  const g=new Map(),skip=new Set((S.profile&&S.profile.skipRec)||[]),mi=m=>+m.slice(0,4)*12+ +m.slice(5,7);
  for(const t of S.tx){
    if(t.amt>=0)continue;const cat=cmap.get(t.h);if(cat===TRANSFER||cat===INCOME)continue;
    const k=merchantKey(t);if(!k||skip.has(k))continue;(g.get(k)||g.set(k,[]).get(k)).push(t);
  }
  const out=[];
  for(const [k,arr] of g){
    let best=null;
    for(const a of arr){
      const base=-a.amt,cl=arr.filter(t=>Math.abs(-t.amt-base)<=base*0.10),months=[...new Set(cl.map(t=>t.d.slice(0,7)))].sort();
      if(months.length<2||base<5)continue;
      const idx=months.map(mi),gaps=idx.slice(1).map((v,i)=>v-idx[i]);
      let interval=0;
      if(months.length>=3&&months.length/(idx[idx.length-1]-idx[0]+1)>=0.7)interval=1; /* fast jeden Monat */
      else if(gaps.every(x=>x===gaps[0])&&[3,6,12].includes(gaps[0])&&(months.length>=3||gaps[0]===12))interval=gaps[0];
      if(!interval)continue;
      if(!best||months.length>best.months.length)best={cl,months,interval};
    }
    if(!best)continue;
    const nm=norm(k);
    if((S.fixed||[]).some(f=>{const n=norm(f.n);return n&&(n.includes(nm)||nm.includes(n));}))continue;
    const amts=best.cl.map(t=>-t.amt).sort((a,b)=>a-b),occ=amts[Math.floor(amts.length/2)];
    const cc={};for(const t of best.cl){const x=cmap.get(t.h);if(x)cc[x]=(cc[x]||0)+1;}
    const cat=Object.keys(cc).sort((a,b)=>cc[b]-cc[a])[0]||null;
    out.push({k,name:(best.cl[0].p||best.cl[0].t||k).slice(0,30),amt:Math.round(occ/best.interval*100)/100,occ:Math.round(occ*100)/100,interval:best.interval,months:best.months.length,cat});
  }
  return out.sort((a,b)=>b.amt-a.amt).slice(0,8);
}
const lastDate=(S,accId)=>{let m="";for(const t of S.tx)if(t.a===accId&&t.d>m)m=t.d;return m;};
const GENERIC=new Set(["DEBITKARTENUMSATZ","VISA","KARTENZAHLUNG","VOM","MASTERCARD","EUROPE","LUXEMBOURG","PAYPAL","ENTGELT","BUCHUNG","KARTE","GIRO","KARTENZAHLUNG","LASTSCHRIFT","GMBH","MARKT","SAGT","DANKE","ZAHLUNG","UEBERWEISUNG","DAUERAUFTRAG","GIROCARD","DEBIT","ONLINE","PURCHASE","MANDATSREFERENZ","GLAEUBIGER"]);
for(const w of ["EINKAUF","IHR","BEI","UND","DER","DIE","DAS","FUER","EUR","USD","CHF","GBP","VON","AUF","DEN","DES","EIN","EINE","ZUM","ZUR","REF","FREMDWAEHRUNG","URSPRUNGSBETRAG","WAEHRUNG","LLC","LTD","INC","SARL","SCA","CIE","IBAN","BIC","NACH","ABRECHNUNG","RATE","KUNDE","KUNDENNR","RECHNUNG","SAGT","DANKE","FILIALE","STATION","SERVICE","GUTSCHRIFT","UEBERWEISUNG","EUROPE","PAYMENTS","STORE","SHOP"])GENERIC.add(w);
/* Woerter fuer den Duplikat-Vergleich: ab 3 Buchstaben, Ziffern entfernt (MCDONALDS00897 = MCDONALDS), ohne Allerweltswoerter */
const dupTokens=s=>new Set(tok(s).map(w=>w.replace(/[0-9]+/g,"")).filter(w=>w.length>=3&&!GENERIC.has(w)));
const lettersOf=s=>norm(s).replace(/[^A-Z]/g,"");
const alnumOf=s=>norm(s).replace(/[^A-Z0-9]/g,"");
/* Haendlername gleich? gemeinsames Wort oder gleicher Anfang (Buchstaben, mind. 5: "MCDONALDS00897/KARLSRUHE" = "McDonald's") */
function dupSim(x,y,tx,ty){
  /* Zwei CSV-Buchungen mit Haendlernamen, aber verschiedenem Verwendungszweck (z. B. Kartenzahlung "vom 26.09." und "vom 27.09."): zwei echte Buchungen */
  const px=x.src==="pdf"||!x.p,py=y.src==="pdf"||!y.p;
  if(!px&&!py&&!x.ref&&!y.ref){const a=normTxt(x),b=normTxt(y);if(a&&b&&a!==b)return false;}
  /* PDF gegen CSV: der Verwendungszweck der CSV (mit Kartendatum oder Referenznummer) steht im PDF-Text */
  if(px!==py){const c=px?y:x,p=px?x:y,a=alnumOf(c.t||""),b=alnumOf((p.p||"")+" "+(p.t||"")),n=Math.min(a.length,24);if(n>=12&&b.includes(a.slice(0,n)))return true;}
  /* gemeinsame lange Referenznummer (PayPal-, Rechnungs-, Mandatsnummer, mind. 10 Ziffern) */
  {const nx=longNums((x.p||"")+" "+(x.t||""));if(nx.size){const ny=longNums((y.p||"")+" "+(y.t||""));for(const v of nx)if(ny.has(v))return true;}}
  tx=tx||dupTokens((x.p||"")+" "+(x.t||""));ty=ty||dupTokens((y.p||"")+" "+(y.t||""));
  for(const w of tx)if(ty.has(w))return true;
  const a=lettersOf(x.p||""),b=lettersOf(y.p||""),n=Math.min(a.length,b.length);
  return n>=5&&a.slice(0,n)===b.slice(0,n);
}
const longNums=s=>new Set(String(s||"").replace(/[\s.\/-]+/g," ").match(/\d{10,}/g)||[]);
/* Gleicher Verwendungszweck trotz umbenanntem Haendler: CSV identisch; PDF gleiches Ende (z. B. "VISA Debitkartenumsatz vom 13.09.2026")
   mit denselben Datums-/Nummernfolgen. Allein nicht sicher genug: nur bei erkanntem Re-Export oder krummem Betrag verwenden. */
function sameTxt(x,y){
  const a=normTxt(x),b=normTxt(y);if(a.length>=8&&a===b)return true;
  const px=x.src==="pdf"||!x.p,py=y.src==="pdf"||!y.p;if(!(px&&py))return false;
  const ax=alnumOf(x.t||""),ay=alnumOf(y.t||""),dg=t=>[...new Set(String(t.t||"").match(/\d{1,2}\.\d{1,2}\.\d{2,4}/g)||[])].sort().join(",");
  if(!dg(x)||dg(x)!==dg(y))return false;
  let k=0;while(k<ax.length&&k<ay.length&&ax[ax.length-1-k]===ay[ay.length-1-k])k++;
  return k>=20;
}
const origAmt=t=>t.fl&&t.oa!=null?t.oa:t.amt;
/* aus einer PDF (v12: src) oder aus einer aelteren Version per PDF importiert (kein Gegenueber, kein Saldo, keine IBAN/Glaeubiger-ID) */
const pdfLike=t=>!t.man&&(t.src==="pdf"||(!t.p&&t.b==null&&!t.ib&&!t.g&&!t.ref));
const normTxt=t=>norm(t.t||"").replace(/\s+/g," ").trim();
const baseH=h=>String(h).split("#")[0];
/* Duplikate beim Import (je Konto). Reihenfolge der Pruefung:
   0) exakter Hash oder geloescht (alte Methode, kompatibel)
   1) gleiches Datum + Betrag und gleiche Kundenreferenz (verschiedene Referenzen = nie Duplikat) oder gleicher Haendler (Wort/Anfang)
   2) nur wenn die Datei den vorhandenen Zeitraum fast komplett noch einmal enthaelt (Re-Export, >= 80 % schon erkannt):
      gleicher Verwendungszweck bei umbenanntem Haendler (DKB kuerzt Namen in neueren Exporten, z. B. "AMZN Mktp" -> "Amazon")
   3) gleiche Buchung mit falschem Vorzeichen aus einer PDF (alter Import): wird korrigiert statt doppelt gezaehlt
   Trifft eine CSV-Zeile eine PDF-Buchung, bekommt die vorhandene Buchung die genaueren CSV-Daten (r.up), Zuordnungen bleiben. */
function markDups(S,rows,accId){
  const del=new Set(S.del||[]),byH=new Map();
  const ex=S.tx.filter(t=>t.a===accId&&!t.man);for(const t of ex)byH.set(t.h,t);
  const soft=new Map(),used=new Set(),tokC=new Map(),known=new Set(S.tx.filter(t=>!t.man).map(t=>t.h));
  const tk=t=>{let s=tokC.get(t);if(!s){s=dupTokens((t.p||"")+" "+(t.t||""));tokC.set(t,s);}return s;};
  for(const t of ex){const k=t.d+"|"+Math.round(Math.abs(origAmt(t))*100);(soft.get(k)||soft.set(k,[]).get(k)).push(t);}
  const cands=r=>(soft.get(r.d+"|"+Math.round(Math.abs(r.amt)*100))||[]).filter(t=>!used.has(t.h));
  const hit=(r,t,why)=>{used.add(t.h);r.dup=true;r.why=why;if(pdfLike(t)&&r.src!=="pdf")r.up=t.h;else if(why==="sign")r.up=t.h;};
  /* 0 */
  for(const r of rows){
    r.dup=false;r.maybe=false;r.up=undefined;r.why=undefined;
    const t=byH.get(r.h);
    if(t&&!used.has(t.h)){used.add(t.h);r.dup=true;r.why="hash";if(pdfLike(t)&&r.src!=="pdf"&&(r.p||r.ref||r.g||r.ib))r.up=t.h;continue;} /* PDF-Text ergab zufaellig denselben Hash: CSV-Daten uebernehmen */
    if(t||del.has(r.h)||known.has(r.h)){r.dup=true;r.why=del.has(r.h)?"del":"hash";}
  }
  /* 1 */
  for(const r of rows){
    if(r.dup)continue;const cs=cands(r).filter(t=>origAmt(t)===r.amt&&!(t.ref&&r.ref&&t.ref!==r.ref));
    let m=r.ref?cs.find(t=>t.ref===r.ref):null;
    if(!m){const rt=dupTokens((r.p||"")+" "+(r.t||""));m=cs.find(t=>dupSim(r,t,rt,tk(t)));}
    if(m)hit(r,m,m.ref&&m.ref===r.ref?"ref":"name");
  }
  /* 2 */
  const ds=rows.map(r=>r.d).sort(),lo=ds[0],hi=ds[ds.length-1];
  const inRange=ex.filter(t=>t.d>=lo&&t.d<=hi),rate=inRange.length?inRange.filter(t=>used.has(t.h)).length/inRange.length:0;
  if(inRange.length>=10&&rate>=0.8)for(const r of rows){
    if(r.dup)continue;
    const m=cands(r).find(t=>origAmt(t)===r.amt&&!(t.ref&&r.ref)&&sameTxt(r,t));
    if(m)hit(r,m,"text");
  }
  /* 3 */
  for(const r of rows){
    if(r.dup||r.guess)continue;const rt=dupTokens((r.p||"")+" "+(r.t||""));
    const m=cands(r).find(t=>origAmt(t)===-r.amt&&pdfLike(t)&&dupSim(r,t,rt,tk(t)));
    if(m)hit(r,m,"sign");
  }
  /* 4: CSV-Re-Export ueber alte PDF-Buchungen (aeltere Versionen speicherten nur die erste PDF-Zeile, teils mit falschem Vorzeichen):
     gleicher Tag, gleicher Betrag (Vorzeichen egal) -> dieselbe Buchung, die CSV-Daten ersetzen die PDF-Daten. Nur bei erkanntem Re-Export. */
  const rate2=inRange.length?inRange.filter(t=>used.has(t.h)).length/inRange.length:0;
  if(inRange.length>=10&&rate2>=0.6)for(const r of rows){
    if(r.dup||r.src==="pdf"||!(r.p||r.ref))continue;
    const m=cands(r).find(t=>pdfLike(t)&&Math.abs(origAmt(t))===Math.abs(r.amt));
    if(m){hit(r,m,"pdfcsv");r.up=m.h;}
  }
  return rows;
}
/* Import uebernehmen (CSV und PDF): neue Buchungen speichern, vorhandene PDF-Buchungen mit CSV-Daten bzw. richtigem Vorzeichen
   aktualisieren (Hash und eigene Zuordnungen bleiben), vorgemerkte Buchungen des Kontos durch den neuen Stand ersetzen. */
function applyImport(S,accId,rows,opt){
  opt=opt||{};const now=opt.now||Date.now(),nw=takeRows(rows,opt.takeMaybe);let up=0;
  const byH=new Map(S.tx.map(t=>[t.h,t]));
  for(const r of rows){
    if(!r.up)continue;const t=byH.get(r.up);if(!t||t.man||t.a!==accId)continue;
    const signCh=Math.sign(t.amt)!==Math.sign(r.amt);
    if(t.fl){delete t.fl;delete t.oa;delete t.pc;}
    t.amt=r.amt;
    if(r.src!=="pdf"){t.p=r.p;t.t=r.t;if(r.b!=null)t.b=r.b;if(r.g)t.g=r.g;if(r.ib)t.ib=r.ib;if(r.ref)t.ref=r.ref;delete t.src;}else t.src="pdf";
    delete t.gs;
    if(signCh&&t.c&&!t.mn){t.c=undefined;t.rl=undefined;}
    t.u=now;up++;
  }
  for(const r of nw){
    const t={h:r.h,a:accId,d:r.d,amt:r.amt,p:r.p,t:r.t,b:r.b,o:r.o,g:r.g,ib:r.ib,u:now};
    if(r.ref)t.ref=r.ref;if(r.src==="pdf")t.src="pdf";if(r.guess)t.gs=1;
    S.tx.push(t);
  }
  /* Vorgemerkt: die neueste Datei eines Kontos bestimmt, was noch offen ist (spaeter gebucht = ersetzt) */
  let pend=0;
  if(Array.isArray(opt.pend)){
    if(!Array.isArray(S.pend))S.pend=[];
    const maxNew=[...rows,...opt.pend].reduce((m,r)=>r.d>m?r.d:m,""),mine=S.pend.filter(p=>p.a===accId),maxOld=(S.pendMax&&S.pendMax[accId])||"";
    if(maxNew>=maxOld){
      const booked=S.tx.filter(t=>t.a===accId&&!t.man);
      const isBooked=p=>booked.some(t=>(p.ref&&t.ref===p.ref)||(t.d===p.d&&t.amt===p.amt&&dupSim(p,t)));
      const keep=opt.pend.filter(p=>!isBooked(p)).map((p,i)=>({h:"pv-"+cyrb53(p.d+"|"+Math.round(p.amt*100)+"|"+norm((p.p||"")+" "+(p.t||""))+"|"+accId)+"-"+i,a:accId,d:p.d,amt:p.amt,p:p.p,t:p.t,ref:p.ref,pv:1,u:now}));
      S.pend=S.pend.filter(p=>p.a!==accId).concat(keep);S.pendMax=Object.assign({},S.pendMax,{[accId]:maxNew});S.pendTs=now;pend=keep.length;
      if(mine.length!==keep.length||keep.length)S.pendTs=now;
    }
  }
  const own=detectOwnNames(rows);
  if(own.names.length){S.profile.myNames=[...new Set([...(S.profile.myNames||[]),...own.names])].slice(0,5);S.profile.myIbans=[...new Set([...(S.profile.myIbans||[]),...own.ibans])].slice(0,20);}
  applyRentMonths(S,resolveAll(S));
  return {n:nw.length,dup:rows.length-nw.length,up,pend};
}
/* Reparatur fuer schon gespeicherte Daten: identische Buchungen aus mehreren (ueberlappenden) Importen finden.
   Nie: manuelle Buchungen, Dauerposten, "Zwillinge" aus derselben Datei (gleicher Grund-Hash), andere Konten.
   sure = sicher (Referenz, gleicher Haendler, PDF/CSV mit falschem Vorzeichen, gleicher Zweck bei krummem Betrag). */
function dupScan(S){
  const g=new Map(),pairs=[];
  for(const t of S.tx){if(t.man||t.rec)continue;const k=t.a+"|"+t.d+"|"+Math.round(Math.abs(origAmt(t))*100);(g.get(k)||g.set(k,[]).get(k)).push(t);}
  const rich=t=>(pdfLike(t)?0:4)+(t.ref?2:0)+(t.g||t.ib?1:0)+(t.c&&t.mn?3:0)+(t.mo?1:0)+(t.nt?1:0);
  for(const arr of g.values()){
    if(arr.length<2)continue;const cand=[];
    for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){
      const x=arr[i],y=arr[j];if(baseH(x.h)===baseH(y.h))continue;
      const ox=origAmt(x),oy=origAmt(y),same=ox===oy;let why=null,score=0;
      if(x.ref&&y.ref){if(x.ref===y.ref&&same){why="ref";score=4;}else continue;}
      else if(same&&dupSim(x,y)){why="name";score=3;}
      else if(!same&&pdfLike(x)!==pdfLike(y)&&dupSim(x,y)){why="sign";score=3;}
      else if(same&&pdfLike(x)===pdfLike(y)&&sameTxt(x,y)){why="text";score=Math.round(Math.abs(ox)*100)%100?2:1;}
      else if(pdfLike(x)!==pdfLike(y)){why="pdfcsv";score=2;} /* gleiche Buchung aus PDF und CSV desselben Kontos (alter PDF-Import ohne Verwendungszweck) */
      else if(same&&pdfLike(x)&&pdfLike(y)&&x.src!=="pdf"&&y.src!=="pdf"){why="pdfpdf";score=1;} /* zwei alte PDF-Importe (Haendler umbenannt?): nur anzeigen, nicht automatisch entfernen */
      if(why)cand.push({x,y,why,score});
    }
    cand.sort((a,b)=>b.score-a.score);const used=new Set();
    for(const c of cand){
      if(used.has(c.x.h)||used.has(c.y.h))continue;used.add(c.x.h);used.add(c.y.h);
      const keepX=rich(c.x)>=rich(c.y);pairs.push({keep:keepX?c.x:c.y,drop:keepX?c.y:c.x,why:c.why,sure:c.score>=2});
    }
  }
  /* Dasselbe Bankkonto unter zwei Kontonamen importiert (z. B. PDF in "Konto B", CSV in "Konto A"):
     fast alle Buchungen des gemeinsamen Zeitraums haben ein Gegenstueck -> die Paare sind sicher doppelt */
  const gone=new Set(pairs.map(p=>p.drop.h));
  for(const o of accountOverlap(S,gone))for(const [x,y] of o.pairs){const keepX=rich(x)>=rich(y);pairs.push({keep:keepX?x:y,drop:keepX?y:x,why:"konto",sure:true,accs:[o.a,o.b]});}
  return pairs.sort((a,b)=>a.keep.d<b.keep.d?1:-1);
}
function accountOverlap(S,skip){
  skip=skip||new Set();const by=new Map();
  for(const t of S.tx){if(t.man||t.rec||skip.has(t.h))continue;(by.get(t.a)||by.set(t.a,[]).get(t.a)).push(t);}
  const ids=[...by.keys()],out=[],done=new Set();
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const A=by.get(ids[i]),B=by.get(ids[j]);
    const lo=[A,B].map(l=>l.reduce((m,t)=>t.d<m?t.d:m,"9999")).sort()[1],hi=[A,B].map(l=>l.reduce((m,t)=>t.d>m?t.d:m,"")).sort()[0];
    if(!(lo<=hi))continue;
    const a=A.filter(t=>t.d>=lo&&t.d<=hi),b=B.filter(t=>t.d>=lo&&t.d<=hi);if(Math.min(a.length,b.length)<20)continue;
    const idx=new Map();for(const t of b){const k=t.d+"|"+Math.round(Math.abs(origAmt(t))*100);(idx.get(k)||idx.set(k,[]).get(k)).push(t);}
    const used=new Set(),pairs=[];
    for(const x of a){if(done.has(x.h))continue;const k=x.d+"|"+Math.round(Math.abs(origAmt(x))*100);const y=(idx.get(k)||[]).find(y=>!used.has(y.h)&&!done.has(y.h)&&(origAmt(y)===origAmt(x)||pdfLike(x)!==pdfLike(y))&&dupSim(x,y));if(y){used.add(y.h);pairs.push([x,y]);}}
    if(pairs.length>=20&&pairs.length>=0.8*Math.min(a.length,b.length)){
      /* Konto doppelt erkannt: restliche Buchungen mit gleichem Tag und Betrag (alte PDF-Importe ohne Verwendungszweck) gehoeren dazu */
      for(const x of a){if(pairs.some(p=>p[0]===x))continue;const k=x.d+"|"+Math.round(Math.abs(origAmt(x))*100);const y=(idx.get(k)||[]).find(y=>!used.has(y.h)&&(pdfLike(x)||pdfLike(y)));if(y){used.add(y.h);pairs.push([x,y]);}}
      out.push({a:ids[i],b:ids[j],pairs,n:Math.min(a.length,b.length)});for(const [x,y] of pairs){done.add(x.h);done.add(y.h);}
    }
  }
  return out;
}
/* Entfernt die doppelte Buchung, uebernimmt eigene Angaben (Kategorie, Monat, "keine Umbuchung") auf die behaltene. Idempotent. */
function dupClean(S,pairs,now){
  now=now||Date.now();const drop=new Set();
  for(const p of pairs){
    const k=p.keep,d=p.drop;if(drop.has(k.h)||drop.has(d.h))continue;
    if(d.c&&!k.c){k.c=d.c;if(d.mn)k.mn=1;if(d.rl)k.rl=1;}
    if(d.mo&&!k.mo)k.mo=d.mo;if(d.nt&&!k.nt)k.nt=1;
    k.u=now;drop.add(d.h);
  }
  if(!drop.size)return 0;
  S.tx=S.tx.filter(t=>!drop.has(t.h));
  for(const h of drop)if(!S.del.includes(h))S.del.push(h);
  return drop.size;
}
/* Bereinigen bis nichts Sicheres mehr uebrig ist (Ketten aus 3 Kopien: PDF, PDF, CSV). Ergebnis: entfernte Anzahl, idempotent. */
function dupCleanAll(S,now){let n=0;for(let i=0;i<4;i++){const ps=dupScan(S).filter(p=>p.sure);if(!ps.length)break;n+=dupClean(S,ps,now);}return n;}
/* Vor dem Import: steckt diese Datei schon zum grossen Teil in einem ANDEREN Konto? (falsches Konto gewaehlt, z. B. PDF und CSV derselben Bank) */
function importOverlap(S,rows,accId){
  if(rows.length<10)return null;let best=null;
  for(const a of S.accounts){
    if(a.id===accId||a.virtual)continue;const ex=S.tx.filter(t=>t.a===a.id&&!t.man);if(ex.length<10)continue;
    const idx=new Map();for(const t of ex){const k=t.d+"|"+Math.round(Math.abs(origAmt(t))*100);(idx.get(k)||idx.set(k,[]).get(k)).push(t);}
    const lo=ex.reduce((m,t)=>t.d<m?t.d:m,"9999"),hi=ex.reduce((m,t)=>t.d>m?t.d:m,""),inR=rows.filter(r=>r.d>=lo&&r.d<=hi);if(inR.length<10)continue;
    const used=new Set();let n=0;
    for(const r of inR){const y=(idx.get(r.d+"|"+Math.round(Math.abs(r.amt)*100))||[]).find(t=>!used.has(t.h)&&(origAmt(t)===r.amt||pdfLike(t)||r.src==="pdf")&&dupSim(r,t));if(y){used.add(y.h);n++;}}
    const rate=n/inR.length;if(rate>=0.6&&(!best||rate>best.rate))best={acc:a.id,name:a.name,n,of:inR.length,rate};
  }
  return best;
}
/* Gleicher Betrag (+-0) in zwei verschiedenen Konten innerhalb von 3 Tagen: evtl. dieselbe Zahlung doppelt (z. B. PDF in ein anderes Konto) */
function crossDups(list){
  const out=[];
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const x=list[i],y=list[j];if(x.a===y.a||x.man||y.man||x.amt!==y.amt)continue;if(Math.abs(dayNum(x.d)-dayNum(y.d))<=3)out.push([x,y]);}
  return out;
}
/* Kennzahlen einer Buchungsliste (Kategorie-Sheet) */
function listStats(list){
  const v=list.map(t=>Math.abs(t.amt));const by={};for(const t of list){const e=by[t.a]||(by[t.a]={n:0,sum:0});e.n++;e.sum+=Math.abs(t.amt);}
  return {n:list.length,sum:v.reduce((s,x)=>s+x,0),min:v.length?Math.min(...v):0,max:v.length?Math.max(...v):0,byAcc:by};
}
/* ---------- Krypto ---------- */
const te=new TextEncoder(),td=new TextDecoder();
function b64e(u8){let s="";for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s);}
function b64d(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
async function sha256hex(s){const h=new Uint8Array(await crypto.subtle.digest("SHA-256",te.encode(s)));return Array.from(h,x=>x.toString(16).padStart(2,"0")).join("");}
async function docIdFor(pass){return (await sha256hex("finanzplaner|"+pass)).slice(0,40);}
async function deriveKey(pass,salt,iter=200000){
  const km=await crypto.subtle.importKey("raw",te.encode(pass),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:iter,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function streamOp(u8,Ctor,kind){
  const s=new Blob([u8]).stream().pipeThrough(new Ctor(kind));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function encryptJSON(obj,key){
  let raw=te.encode(JSON.stringify(obj)),z=0;
  if(typeof CompressionStream!=="undefined"){try{raw=await streamOp(raw,CompressionStream,"gzip");z=1;}catch(e){z=0;raw=te.encode(JSON.stringify(obj));}}
  const iv=rnd(12);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,raw));
  return {z,iv:b64e(iv),ct:b64e(ct)};
}
async function decryptJSON(enc,key){
  let raw=new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:b64d(enc.iv)},key,b64d(enc.ct)));
  if(enc.z)raw=await streamOp(raw,DecompressionStream,"gzip");
  return JSON.parse(td.decode(raw));
}
const CHUNK=700000, MAXCHUNKS=20;
function packDocs(id,salt,enc,ts,dev){
  const parts=[];for(let i=0;i<enc.ct.length;i+=CHUNK)parts.push(enc.ct.slice(i,i+CHUNK));
  if(!parts.length)parts.push("");
  if(parts.length>MAXCHUNKS)throw new Error("Daten zu groß für den Sync ("+parts.length+" Teile)");
  const docs=[];
  for(let i=1;i<parts.length;i++)docs.push({id:id+"_"+i,data:{ts,c:parts[i]}});
  docs.push({id,data:{v:1,salt,iv:enc.iv,z:enc.z,ts,dev,n:parts.length,c:parts[0]}}); /* Hauptdokument zuletzt */
  return docs;
}
async function unpackDocs(main,id,getChunk){
  let ct=main.c;
  for(let i=1;i<(main.n||1);i++){
    const d=await getChunk(id+"_"+i);
    if(!d||d.ts!==main.ts)throw new Error("Teile noch nicht vollständig");
    ct+=d.c;
  }
  return {z:main.z,iv:main.iv,ct};
}

/* ---------- PIN (Tresor) ---------- */
async function pinBits(pin,salt,it){
  const km=await crypto.subtle.importKey("raw",te.encode(pin),"PBKDF2",false,["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:it,hash:"SHA-256"},km,256));
}
async function pinCreate(pin){
  if(!/^\d{4,6}$/.test(pin))throw new Error("PIN muss aus 4 bis 6 Ziffern bestehen");
  const salt=rnd(16),it=150000;
  return {s:b64e(salt),it,h:b64e(await pinBits(pin,salt,it))};
}
async function pinVerify(pin,rec){
  if(!rec||!/^\d{4,6}$/.test(pin))return false;
  const h=await pinBits(pin,b64d(rec.s),rec.it),g=b64d(rec.h);
  if(h.length!==g.length)return false;
  let d=0;for(let i=0;i<h.length;i++)d|=h[i]^g[i];
  return d===0;
}

/* ---------- Zustand, Merge ---------- */
const MAN_ACC=()=>({id:"man",name:"Manuell",virtual:true,inv:false,map:null,u:0});
function newState(){
  const S={v:SCHEMA,dev:uid(),cfgTs:0, /* 0: eine frische Installation ueberschreibt beim Sync nie die Konfiguration einer bestehenden */
    recur:[],delw:{},pend:[],
    accounts:[["dkb","DKB"],["consors","Consorsbank"],["sparda","Sparda-Bank"],["spk","Sparkasse"],["revolut","Revolut"],["amex","Amex"]].map(([id,name])=>({id,name,inv:id==="amex",map:null,u:0})).concat([MAN_ACC()]),
    tx:[],del:[],cats:DEF_CATS.slice(),rules:expandRules(),budget:neutralBudget(),
    profile:{income:null,setupDone:false,legacy:false,skipRec:[],myNames:[],myIbans:[]},fixed:[],goals:[],
    vault:{pin:null,ov:{},free:[],hist:{}}};
  return S;
}
/* Migration: nur additiv und idempotent. Alte Daten (v1) bleiben lesbar, Felder werden ergänzt. */
const LEGACY_RULES=new Set(["RUECKLAGE|Rücklagen","SPARDA|Sparen","^ETF$|Sparen","BAUSPAR|Sparen","UEBERTRAG|Eigene Überträge","UMBUCHUNG|Eigene Überträge","ZAHLUNG ERHALTEN|Eigene Überträge","TOP-UP|Eigene Überträge","TOPUP|Eigene Überträge","AMERICAN EXPRESS|Eigene Überträge","KREDITKARTENABRECHNUNG|Eigene Überträge","GEHALT|Einkommen","^LOHN|Einkommen","BESOLDUNG|Einkommen","APEXFUTURES|Trading","APEX FUTURES|Trading","TAKEPROFIT|Trading","TAKE PROFIT|Trading","TOPSTEP|Trading","TRADERVUE|Trading","^ATAS$|Trading","TRADE REPUBLIC|Trading","TRADEREPUBLIC|Trading","MIETE|Miete","REWE|Lebensmittel","EDEKA|Lebensmittel","ALDI|Lebensmittel","LIDL|Lebensmittel","KAUFLAND|Lebensmittel","PENNY|Lebensmittel","NETTO MARKEN|Lebensmittel","BAECKEREI|Lebensmittel","^DM$|Drogerie","ROSSMANN|Drogerie","SHELL|Tanken","^ARAL$|Tanken","^ESSO$|Tanken","^JET$|Tanken","^TOTAL$|Tanken","TOTALENERGIES|Tanken","^AVIA$|Tanken","^HEM$|Tanken","TANKSTELLE|Tanken","NETFLIX|Abos","SPOTIFY|Abos","DAZN|Abos","PLAYSTATION|Abos","ICLOUD|Abos","ANTHROPIC|Abos","CLAUDE|Abos","KINGSIZE|Abos","APPLE.COM/BILL|Abos","AMAZON|Online-Shopping","PAYPAL|Online-Shopping","EBAY|Online-Shopping","ZALANDO|Online-Shopping","MCDONALD|Essen gehen","BURGER KING|Essen gehen","LIEFERANDO|Essen gehen","^WOLT|Essen gehen","RESTAURANT|Essen gehen","CAFE|Essen gehen","STARBUCKS|Essen gehen","PIZZ|Essen gehen","DOENER|Essen gehen","IMBISS|Essen gehen","BISTRO|Essen gehen","SUBWAY|Essen gehen","VERSICHERUNG|Versicherungen","ADAC|Versicherungen","^HUK|Versicherungen","ALLIANZ|Versicherungen","DEVK|Versicherungen","^HDI$|Versicherungen","TELEKOM|Handy/Internet","VODAFONE|Handy/Internet","^O2$|Handy/Internet","1UND1|Handy/Internet","1&1|Handy/Internet","FREENET|Handy/Internet","KLETT|Weiterbildung","^ILS$|Weiterbildung","FERNSCHULE|Weiterbildung","UDEMY|Weiterbildung","FRISEUR|Friseur","BARBER|Friseur","HAIR|Friseur","^GEZ$|GEZ/Rundfunk","RUNDFUNK|GEZ/Rundfunk","BEITRAGSSERVICE|GEZ/Rundfunk","BOOKING|Reisen","AIRBNB|Reisen","FLUG|Reisen","LUFTHANSA|Reisen","RYANAIR|Reisen","HOTEL|Reisen","^KART$|Freizeit","KARTBAHN|Freizeit","KARTING|Freizeit","^KINO|Freizeit","^GYM$|Freizeit","FITNESS|Freizeit","MCFIT|Freizeit","STEAM|Freizeit","SAMMELUEBERWEISUNG|Sparen","^AMEX|Eigene Überträge","AEME|Eigene Überträge","KREDITKARTE ABRECHNUNG|Eigene Überträge","ZAHLUNG REVOLUT|Eigene Überträge","REVOLUT BANK|Eigene Überträge","REVOLUT LTD|Eigene Überträge","REVOLUT TOP|Eigene Überträge","BEZUEGE|Einkommen","ARBEITGEBER|Einkommen","LOHN/GEHALT|Einkommen","SCALABLE|Sparen","COMDIRECT|Sparen","SPARPLAN|Sparen","WERTPAPIER|Sparen","^REVOLUT$|Eigene Überträge","^REVOLUT BANK|Eigene Überträge","APEXTRADER|Trading","APEX TRADER|Trading","TRADEIFY|Trading","^WHOP|Trading","FUNDEDNEXT|Trading","FTMO|Trading","FUNDINGPIPS|Trading","BULENOX|Trading","^LUCID|Trading","ELITE TRADER|Trading","MYFUNDED|Trading","ALPHA FUTURES|Trading","TRADOVATE|Trading","NINJATRADER|Trading","TRADINGVIEW|Trading","FUNDED FUTURES|Trading","TRADEDAY|Trading","STADTWERKE|Miete","ENBW|Miete","VATTENFALL|Miete","ENTEGA|Miete","^EON|Miete","E.ON|Miete","NEBENKOSTEN|Miete","HAUSVERWALTUNG|Miete","WOHNUNGSBAU|Miete","VONOVIA|Miete","^EWE|Miete","BADENOVA|Miete","WASSERVERSORGUNG|Miete","MUELLABFUHR|Miete","ABFALL|Miete","NORMA|Lebensmittel","^DENNS|Lebensmittel","BIOMARKT|Lebensmittel","ALNATURA|Lebensmittel","TEGUT|Lebensmittel","GLOBUS|Lebensmittel","MARKTKAUF|Lebensmittel","BAECKER|Lebensmittel","BACKWERK|Lebensmittel","BACKSHOP|Lebensmittel","BREZEL|Lebensmittel","METZGER|Lebensmittel","FLEISCHEREI|Lebensmittel","KIOSK|Lebensmittel","GETRAENKE|Lebensmittel","HIT MARKT|Lebensmittel","NAHKAUF|Lebensmittel","NAH UND GUT|Lebensmittel","SPAR MARKT|Lebensmittel","LEBENSMITTEL|Lebensmittel","MERCADONA|Lebensmittel","CARREFOUR|Lebensmittel","LECLERC|Lebensmittel","AUCHAN|Lebensmittel","TESCO|Lebensmittel","CONAD|Lebensmittel","^SPAR$|Lebensmittel","APOTHEKE|Drogerie","MUELLER DROGERIE|Drogerie","SANITAETSHAUS|Drogerie","^BFT|Tanken","AGIP|Tanken","^OMV|Tanken","ORLEN|Tanken","AUTOHOF|Tanken","RASTHOF|Tanken","^STAR TANK|Tanken","SB TANK|Tanken","HOYER|Tanken","^ENI|Tanken","TAMOIL|Tanken","PARKHAUS|Tanken","PARKEN|Tanken","PARKSCHEIN|Tanken","WASCHPARK|Tanken","AUTOWASCH|Tanken","LADESTATION|Tanken","ENBW MOBILITY|Tanken","SONY INTERACTIVE|Abos","DISNEY|Abos","PRIME VIDEO|Abos","AMAZON PRIME|Abos","YOUTUBE|Abos","GOOGLE ONE|Abos","GOOGLE STORAGE|Abos","TWITCH|Abos","AUDIBLE|Abos","DEEZER|Abos","WAIPU|Abos","^SKY|Abos","RTL+|Abos","PARAMOUNT|Abos","CRUNCHYROLL|Abos","DUOLINGO|Abos","OPENAI|Abos","CHATGPT|Abos","MICROSOFT 365|Abos","DROPBOX|Abos","NORDVPN|Abos","PATREON|Abos","APPLE.COM|Abos","CANVA|Abos","ADOBE|Abos","NOTION|Abos","GITHUB|Abos","JETBRAINS|Abos","ZOOM|Abos","ABOUT YOU|Online-Shopping","^OTTO|Online-Shopping","SHEIN|Online-Shopping","TEMU|Online-Shopping","ALIEXPRESS|Online-Shopping","KLEINANZEIGEN|Online-Shopping","VINTED|Online-Shopping","MEDIAMARKT|Online-Shopping","SATURN|Online-Shopping","CYBERPORT|Online-Shopping","NOTEBOOKSBILLIGER|Online-Shopping","GALAXUS|Online-Shopping","IKEA|Online-Shopping","HORNBACH|Online-Shopping","^OBI|Online-Shopping","BAUHAUS|Online-Shopping","TOOM|Online-Shopping","HAGEBAU|Online-Shopping","DECATHLON|Online-Shopping","BOOKS|Online-Shopping","THALIA|Online-Shopping","HUGENDUBEL|Online-Shopping","EUREST|Essen gehen","KANTINE|Essen gehen","MENSA|Essen gehen","SODEXO|Essen gehen","COMPASS GROUP|Essen gehen","CAFETERIA|Essen gehen","BURGER|Essen gehen","KFC|Essen gehen","DOMINO|Essen gehen","VAPIANO|Essen gehen","SUSHI|Essen gehen","THAI|Essen gehen","ITALIEN|Essen gehen","GRILL|Essen gehen","KEBAB|Essen gehen","BIERGARTEN|Essen gehen","WIRTSHAUS|Essen gehen","GASTST|Essen gehen","DELIVEROO|Essen gehen","UBER EATS|Essen gehen","NORDSEE|Essen gehen","OSTERIA|Essen gehen","TRATTORIA|Essen gehen","BRAUHAUS|Essen gehen","ALTE BRAUEREI|Essen gehen","SNACK|Essen gehen","PIZZERIA|Essen gehen","DONER|Essen gehen","LA CASA|Essen gehen","ASIA|Essen gehen","BOWL|Essen gehen","FRISCH BACKEN|Essen gehen","BAR&|Essen gehen","CHECK24|Versicherungen","NUERNBERGER|Versicherungen","GOTHAER|Versicherungen","AXA|Versicherungen","DEBEKA|Versicherungen","SIGNAL IDUNA|Versicherungen","BARMER|Versicherungen","TECHNIKER KRANKEN|Versicherungen","^AOK|Versicherungen","KRANKENKASSE|Versicherungen","DAK GESUND|Versicherungen","IDEAL VERS|Versicherungen","GENERALI|Versicherungen","CONCORDIA|Versicherungen","WGV|Versicherungen","HUK-COBURG|Versicherungen","HUK COBURG|Versicherungen","KFZ-VERS|Versicherungen","LVM|Versicherungen","TELEFONICA|Handy/Internet","CONGSTAR|Handy/Internet","MOBILCOM|Handy/Internet","DEUTSCHE GLASFASER|Handy/Internet","SIMYO|Handy/Internet","LEBARA|Handy/Internet","PYUR|Handy/Internet","UNITYMEDIA|Handy/Internet","KABEL DEUTSCHLAND|Handy/Internet","FRAENK|Handy/Internet","NETZCLUB|Handy/Internet","WINSIM|Handy/Internet","SIM.DE|Handy/Internet","COURSERA|Weiterbildung","SKILLSHARE|Weiterbildung","SEMINAR|Weiterbildung","FORTBILDUNG|Weiterbildung","UNIVERSITAET|Weiterbildung","HOCHSCHULE|Weiterbildung","VOLKSHOCHSCHULE|Weiterbildung","COIFFEUR|Friseur","KOSMETIK|Friseur","NAGELSTUDIO|Friseur","BARBERSHOP|Friseur","ARD ZDF|GEZ/Rundfunk","DB VERTRIEB|Reisen","DEUTSCHE BAHN|Reisen","FLIXBUS|Reisen","EASYJET|Reisen","EUROWINGS|Reisen","CONDOR|Reisen","^TUI|Reisen","SIXT|Reisen","EUROPCAR|Reisen","HERTZ|Reisen","HOSTEL|Reisen","EXPEDIA|Reisen","TRIVAGO|Reisen","PAYMENTS LUXEMBO|Reisen","AIRLINE|Reisen","NIKE|Bekleidung","ADIDAS|Bekleidung","H&M|Bekleidung","ZARA|Bekleidung","PRIMARK|Bekleidung","C&A|Bekleidung","PEEK|Bekleidung","^JACK|Bekleidung","SPORT SCHECK|Bekleidung","TITUS|Bekleidung","ZUMIEZ|Bekleidung","FOOTLOCKER|Bekleidung","DEICHMANN|Bekleidung","VERO MODA|Bekleidung","TOMMY|Bekleidung","BERSHKA|Bekleidung","TK MAXX|Bekleidung","ESPRIT|Bekleidung","S.OLIVER|Bekleidung","MANGO|Bekleidung","UNIQLO|Bekleidung","JACK&JONES|Bekleidung","JACK JONES|Bekleidung","PULL&BEAR|Bekleidung","SNIPES|Bekleidung","SIZEER|Bekleidung","ENTGELT|Sonstiges","KONTOFUEHRUNG|Sonstiges","GEBUEHR|Sonstiges","KREDITKARTENGEBUEHR|Sonstiges","DHL|Sonstiges","^POST|Sonstiges","HERMES|Sonstiges","DPD|Sonstiges","^UPS$|Sonstiges","BAHN|Sonstiges","^KVV|Sonstiges","^VRR|Sonstiges","^MVG|Sonstiges","^BVG|Sonstiges","^RMV|Sonstiges","^HVV|Sonstiges","^VGN|Sonstiges","NAHVERKEHR|Sonstiges","TICKETSHOP|Sonstiges","^UBER|Sonstiges","^BOLT|Sonstiges","FREENOW|Sonstiges","FLINKSTER|Sonstiges","SHARENOW|Sonstiges","^TIER$|Sonstiges","^LIME$|Sonstiges","^BIRD$|Sonstiges","REPARATUR|Sonstiges","WERKSTATT|Sonstiges","TUEV|Sonstiges","DEKRA|Sonstiges","^ATU$|Sonstiges","PEARL|Sonstiges","^DOTT|Sonstiges","COPECART|Sonstiges","GELDAUTOMAT|Sonstiges","BARGELDAUSZAHLUNG|Sonstiges","^SPARKASSE|Sonstiges","^VOLKSBANK|Sonstiges","^RAIFFEISEN|Sonstiges","^COMMERZBANK|Sonstiges","^DEUTSCHE BANK|Sonstiges","^POSTBANK|Sonstiges","^BBBANK|Sonstiges","^PSD BANK|Sonstiges","WESTERWALD BANK|Sonstiges","^VR BANK|Sonstiges","^SPARDA-B|Sonstiges","URBAN SPORTS|Freizeit","FITX|Freizeit","CLEVER FIT|Freizeit","FITSTAR|Freizeit","JOHN REED|Freizeit","SPORTWELT|Freizeit","SCHWIMMBAD|Freizeit","THERME|Freizeit","FREIZEITPARK|Freizeit","^ZOO$|Freizeit","THEATER|Freizeit","KONZERT|Freizeit","EVENTIM|Freizeit","TICKETMASTER|Freizeit","BOWLING|Freizeit","ESCAPE|Freizeit","EPIC GAMES|Freizeit","NINTENDO|Freizeit","PLAYSTATION STORE|Freizeit","GAMES|Freizeit","GOLF|Freizeit","TENNIS|Freizeit","KLETTERN|Freizeit","BOULDER|Freizeit","SAUNA|Freizeit","CINEMAXX|Freizeit","CINESTAR|Freizeit","UCI KINO|Freizeit","FILMPALAST|Freizeit","CINEORDER|Freizeit","^CINEPLEX|Freizeit","KINOPOLIS|Freizeit"]);
function migrateState(s){
  let ch=false;
  if((s.v||1)<2){
    const b=s.budget;
    const bi=b.items.findIndex(i=>i.n==="Online-Shopping, Drogerie, Sonstiges");
    if(bi>=0){
      const P=b.items[bi].plan>0?b.items[bi].plan/350:1,cov=new Set(b.items.flatMap(i=>i.cats));
      const repl=[["Online-Shopping",150],["Drogerie",50],["Sonstiges",100],["Bekleidung",50]].filter(([c])=>!b.items.some((i,k)=>k!==bi&&i.cats.includes(c))).map(([c,v])=>({n:c,cats:[c],plan:Math.round(v*P),pct:c==="Bekleidung"?4:null}));
      b.items.splice(bi,1,...repl);
    }
    if(b.r===110)b.r=100;
    const dead=r=>(norm(r.k)==="SPARDA"&&r.c==="Sparen")||(norm(r.k)==="PAYPAL"&&r.c==="Online-Shopping");
    s.rules=s.rules.filter(r=>!dead(r));
    const have=new Set(s.rules.map(r=>norm(r.k)+"|"+r.c));
    for(const r of expandRules())if(!have.has(norm(r.k)+"|"+r.c)&&s.cats.includes(r.c))s.rules.push(r);
    s.v=2;ch=true;
  }
  if((s.v||1)<3){
    /* Bestehende Datensaetze (Daten oder eigene Werte) behalten ihren Plan unveraendert und brauchen keinen Assistenten. */
    const pristine=!(s.tx.some(t=>!t.demo)||s.budget.income>0||(s.budget.planIncome||0)!==3100||(s.vault&&(s.vault.pin||Object.keys(s.vault.ov||{}).length||(s.vault.free||[]).length))||s.budget.items.some(it=>(it.plan||null)!==(LEGACY_PLAN[it.cats[0]]==null?null:LEGACY_PLAN[it.cats[0]])));
    s.profile={income:null,setupDone:!pristine,legacy:!pristine,skipRec:[]};
    s.fixed=[];
    if(pristine)s.budget=Object.assign(neutralBudget(),{mode:s.budget.mode||"plan"});
    s.v=3;ch=true;
  }
  if((s.v||1)<4){ /* v4: additiv, virtuelles Konto Manuell, Dauerposten, Loesch-Zeitstempel */
    if(!Array.isArray(s.recur))s.recur=[];if(!s.delw||typeof s.delw!=="object")s.delw={};
    s.v=4;ch=true;
  }
  if(!s.accounts.some(a=>a.id==="man")){s.accounts.push(MAN_ACC());ch=true;}
  if(!Array.isArray(s.recur))s.recur=[];if(!s.delw||typeof s.delw!=="object")s.delw={};
  if((s.v||1)<5){ /* v5: neue Standardregeln am Ende ergaenzen (eigene Regeln bleiben vorn), Felder fuer eigene Namen/IBANs */
    const have=new Set(s.rules.map(r=>norm(r.k)+"|"+r.c));
    for(const r of expandRules())if(!have.has(norm(r.k)+"|"+r.c)&&s.cats.includes(r.c)&&!(r.c==="Sonstiges"&&false))s.rules.push(r);
    s.v=5;ch=true;
  }
  if((s.v||1)<6){ /* v6: neue Kategorien additiv, Standardregeln neu (Altstandard raus, eigene Regeln bleiben), einmalige Reparatur */
    for(const k of DEF_CATS)if(!s.cats.includes(k))s.cats.push(k);
    const cur=new Set(expandRules().map(r=>norm(r.k)+"|"+r.c));
    s.rules=s.rules.filter(r=>{const k=norm(r.k)+"|"+r.c;return !(LEGACY_RULES.has(k)&&!cur.has(k));});
    const hv=new Set(s.rules.map(r=>norm(r.k)+"|"+r.c));
    for(const r of expandRules())if(!hv.has(norm(r.k)+"|"+r.c)&&s.cats.includes(r.c))s.rules.push(r);
    ensureItems(s);
    s.__repair=1;s.v=6;ch=true;
  }
  if(!s.r12){ /* v12 (Schema bleibt 6): geaenderte Standardregeln ersetzen und an ihrer Stelle einordnen; eigene Regeln bleiben vorn, von dir geloeschte Standardregeln bleiben geloescht */
    const key=r=>norm(r.k)+"|"+r.c,cur=expandRules(),curK=new Set(cur.map(key));
    const oldDef=new Set([...curK].filter(k=>!V12_ADDED.has(k)));for(const k of V12_REMOVED)oldDef.add(k);
    const have=new Set(s.rules.map(key)),user=s.rules.filter(r=>!curK.has(key(r))&&!oldDef.has(key(r)));
    const deleted=new Set([...oldDef].filter(k=>curK.has(k)&&!have.has(k)));
    if(have.size)s.rules=[...user,...cur.filter(r=>!deleted.has(key(r))&&s.cats.includes(r.c))];
    s.r12=1;ch=true;
  }
  if(!Array.isArray(s.pend))s.pend=[];
  if(!Array.isArray(s.profile.skipNames))s.profile.skipNames=[];if(!Array.isArray(s.profile.myNames))s.profile.myNames=[];if(!Array.isArray(s.profile.myIbans))s.profile.myIbans=[];
  const n0=s.budget.items.length;ensureItems(s);if(s.budget.items.length!==n0)ch=true;
  return ch;
}
function normalizeState(s){
  const d=newState();s=s&&typeof s==="object"?s:{};
  for(const k of Object.keys(d))if(s[k]==null)s[k]=d[k];
  s.budget=Object.assign({},d.budget,s.budget);
  if(!Array.isArray(s.budget.items))s.budget.items=d.budget.items;
  s.vault=Object.assign({},d.vault,s.vault);
  if(!Array.isArray(s.tx))s.tx=[];
  if(!s.v)s.v=1;
  if(!s.profile||typeof s.profile!=="object")s.profile={income:null,setupDone:(s.v||1)>=3?false:true,legacy:false,skipRec:[]};
  if(!Array.isArray(s.profile.skipRec))s.profile.skipRec=[];
  if(!Array.isArray(s.fixed))s.fixed=[];
  if(!Array.isArray(s.goals))s.goals=[];
  migrateState(s);
  if(s.__repair){delete s.__repair;if(s.tx.length){reapplyRules(s);applyRentMonths(s,resolveAll(s));}}
  return s;
}
function mergeStates(L,R){
  const out={v:Math.max(L.v||1,R.v||1),dev:L.dev};
  out.del=Array.from(new Set([...(L.del||[]),...(R.del||[])]));
  const del=new Set(out.del);
  const am=new Map();
  for(const a of [...(L.accounts||[]),...(R.accounts||[])]){const e=am.get(a.id);if(!e||(a.u||0)>(e.u||0))am.set(a.id,a);}
  out.accounts=[...am.values()].filter(a=>!del.has("acc:"+a.id));
  const dw=Object.assign({},L.delw||{});for(const k in (R.delw||{}))dw[k]=Math.max(dw[k]||0,R.delw[k]);out.delw=dw;
  const ids=new Set(out.accounts.map(a=>a.id));
  const tm=new Map();
  for(const t of [...(L.tx||[]),...(R.tx||[])]){ if(del.has(t.h)||(dw[t.h]!==undefined&&dw[t.h]>=(t.u||0)))continue; const e=tm.get(t.h); if(!e||(t.u||0)>(e.u||0))tm.set(t.h,t); }
  out.tx=[...tm.values()].filter(t=>ids.has(t.a));
  const win=(R.cfgTs||0)>(L.cfgTs||0)?R:L;
  out.cfgTs=Math.max(L.cfgTs||0,R.cfgTs||0);
  const pw=(R.pendTs||0)>(L.pendTs||0)?R:L;out.pend=pw.pend||[];out.pendMax=pw.pendMax||{};out.pendTs=Math.max(L.pendTs||0,R.pendTs||0);
  out.r12=L.r12&&R.r12?1:(win.r12||undefined);
  out.recur=win.recur||[];out.cats=win.cats;out.rules=win.rules;out.budget=win.budget;out.vault=win.vault;out.profile=win.profile||{income:null,setupDone:true,legacy:true,skipRec:[]};out.fixed=win.fixed||[];
  /* Sparziele: neues optionales Feld. Eine aeltere Gegenstelle kennt es nicht (undefined) und darf lokale Ziele nicht loeschen. Ein leeres Array ist eine bewusste Loeschung. */
  out.goals=Array.isArray(win.goals)?win.goals:(Array.isArray(L.goals)?L.goals:(Array.isArray(R.goals)?R.goals:[]));
  return out;
}
/* true, wenn L Informationen enthält, die R fehlen */
function hasExtra(L,R){
  if((L.cfgTs||0)>(R.cfgTs||0))return true;
  const rt=new Map((R.tx||[]).map(t=>[t.h,t]));
  for(const t of L.tx||[]){const e=rt.get(t.h);if(!e||(t.u||0)>(e.u||0))return true;}
  const ra=new Map((R.accounts||[]).map(a=>[a.id,a]));
  for(const a of L.accounts||[]){const e=ra.get(a.id);if(!e||(a.u||0)>(e.u||0))return true;}
  const rd=new Set(R.del||[]);for(const x of L.del||[])if(!rd.has(x))return true;
  for(const k in (L.delw||{}))if(!(R.delw&&R.delw[k]>=L.delw[k]))return true;
  return false;
}

/* ---------- Demo-Daten (synthetisch) ---------- */
function makeDemo(todayS){
  let seed=20261019;const rand=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const pick=a=>a[Math.floor(rand()*a.length)],r2=x=>Math.round(x*100)/100;
  const accs=[{id:"demo-giro",name:"Demo Girokonto",inv:false,map:null,u:0,demo:true},{id:"demo-kk",name:"Demo Kreditkarte",inv:false,map:null,u:0,demo:true},{id:"demo-spar",name:"Demo Sparkonto",inv:false,map:null,u:0,demo:true}];
  const ev=[];const cur=todayS.slice(0,7);
  for(let k=-2;k<=0;k++){
    const ym=shiftYM(cur,k),last=k===0?+todayS.slice(8,10):daysIn(ym);
    const add=(day,a,amt,p,t)=>{if(day<=last)ev.push({a,d:ym+"-"+pad2(Math.min(day,daysIn(ym))),amt:r2(amt),p,t:t||""});};
    add(1,"demo-giro",3100,"Beispiel GmbH","Gehalt "+ym);
    add(2,"demo-giro",-800,"Vermieter Muster","Miete "+ym);
    add(3,"demo-giro",-95,"Muster Versicherung AG","Versicherung Haftpflicht");
    add(3,"demo-giro",-39.99,"Telekom Deutschland","Mobilfunk und Internet");
    add(4,"demo-giro",-12.99,"Netflix","Netflix Abo");add(4,"demo-giro",-10.99,"Spotify","Spotify Premium");
    add(5,"demo-giro",-200,"Eigener Übertrag","Übertrag auf Sparkonto");
    add(5,"demo-spar",200,"Eigener Übertrag","Übertrag von Girokonto");
    add(6,"demo-giro",-167,"Fernschule Beispiel","Studiengebühr");
    add(7,"demo-giro",-40,"Friseur Haarschnitt","Friseur");
    const shops=[["REWE Markt","Kartenzahlung REWE"],["EDEKA Center","Kartenzahlung EDEKA"],["ALDI SUED","Kartenzahlung ALDI"],["LIDL","Kartenzahlung LIDL"]];
    const nShop=k===-1?11:6;
    for(let i=0;i<nShop;i++){const s=pick(shops);add(2+Math.floor(i*26/nShop),"demo-giro",-(k===-1?35+rand()*45:18+rand()*28),s[0],s[1]);}
    for(let i=0;i<3;i++)add(5+i*9,"demo-giro",-(55+rand()*25),pick(["SHELL Station","ARAL Tankstelle","JET Tankstelle"]),"Tanken");
    for(let i=0;i<5;i++)add(4+i*5,"demo-kk",-(11+rand()*28),pick(["McDonalds","Lieferando","Restaurant Adria","Cafe Muster"]),"Essen");
    for(let i=0;i<2;i++)add(8+i*12,"demo-kk",-(20+rand()*60),"AMAZON EU","Bestellung");
    add(12,"demo-kk",-14,"Kino Beispielstadt","Kinokarten");add(20,"demo-kk",-29.9,"Fitness Studio","Mitgliedschaft");
    add(9,"demo-kk",-(8+rand()*20),"XYZ Handel GmbH","Kartenzahlung unbekannt");add(15,"demo-kk",-(10+rand()*15),"Muster Kiosk 4711","Kartenzahlung");
    const kkSum=ev.filter(e=>e.a==="demo-kk"&&e.d.startsWith(ym)&&e.amt<0).reduce((s,e)=>s+e.amt,0);
    if(k<0){add(26,"demo-kk",r2(-kkSum),"Zahlung erhalten","Zahlung erhalten, vielen Dank");add(26,"demo-giro",kkSum,"Kreditkarte Abrechnung","Ausgleich Kreditkarte");}
  }
  ev.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
  const run={"demo-giro":850,"demo-kk":0,"demo-spar":1200},tx=[];
  const seen={};
  ev.forEach((e,i)=>{run[e.a]=r2(run[e.a]+e.amt);const r={a:e.a,d:e.d,amt:e.amt,p:e.p,t:e.t,b:run[e.a],o:i,demo:true,u:0};
    const base=cyrb53(r.d+"|"+Math.round(r.amt*100)+"|"+norm(r.p+" "+r.t)+"|"+r.a);const n=seen[base]=(seen[base]||0)+1;r.h=n>1?base+"#"+(n-1):base;tx.push(r);});
  return {accs,tx};
}

/* ---------- PDF-Text: Zeilen rekonstruieren und Buchungen erkennen (heuristisch) ---------- */
function itemsToRows(items){
  const its=items.filter(i=>i&&typeof i.str==="string"&&i.str.trim()!=="").map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width||0}));
  its.sort((a,b)=>b.y-a.y||a.x-b.x);
  const groups=[];
  for(const it of its){const g=groups[groups.length-1];if(g&&Math.abs(g.y-it.y)<=2.5)g.it.push(it);else groups.push({y:it.y,it:[it]});}
  return groups.map(g=>{
    g.it.sort((a,b)=>a.x-b.x);let s="",px=null;const parts=[];
    for(const it of g.it){
      const str=it.s.replace(/\s+/g," ").trim();if(!str)continue;
      if(px!=null&&it.x-px>1.5)s+=" ";
      const a=s.length;s+=str;parts.push({a,b:s.length,x1:it.x,x2:it.x+it.w});px=it.x+it.w;
    }
    return {t:s,parts};
  }).filter(r=>r.t);
}
const itemsToLines=items=>itemsToRows(items).map(r=>r.t);
const MON_EN={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const AMT_RE=/[-+]?\s?€?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?![\d]|[.,]\d)\s?(?:CR|DR|S|H|[-+])?(?![A-Za-z0-9])/g;
const PDF_SKIP=/^(alter|neuer|aktueller)\s+(kontostand|saldo)|kontostand|saldo\s*(vortrag|alt|neu|zum)|^übertrag|^uebertrag|^summe|^gesamt|^zwischensumme|^seite\s+\d+|^page\s+\d+|^\d+\s*\/\s*\d+$|\biban\b|\bbic\b|\bswift\b|buchungstag|^valuta|^datum\b|haben\s+soll|soll\s+haben|bankleitzahl|\bblz\b|^kontoauszug|^auszug|^umsatzübersicht|^umsätze\b|money (in|out)|^balance|^opening|^closing/i;
const PDF_OLDBAL=/(alter|vorheriger|anfangs)\s*(kontostand|saldo)|saldo\s*vortrag|kontostand\s*alt|^(übertrag|uebertrag)/i;
function leadDate(line){
  let m;
  if((m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)\s*/.exec(line)))return {dd:+m[1],mm:+m[2],y:+m[3],rest:line.slice(m[0].length)};
  if((m=/^(\d{1,2})\.(\d{1,2})\.(\d{2})(?![\d.])\s*/.exec(line)))return {dd:+m[1],mm:+m[2],y:2000+ +m[3],rest:line.slice(m[0].length)};
  if((m=/^(\d{4})-(\d{2})-(\d{2})\s*/.exec(line)))return {dd:+m[3],mm:+m[2],y:+m[1],rest:line.slice(m[0].length)};
  if((m=/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})\s*/.exec(line))&&MON_EN[m[2].toLowerCase()])return {dd:+m[1],mm:MON_EN[m[2].toLowerCase()],y:+m[3],rest:line.slice(m[0].length)};
  if((m=/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\s*/.exec(line))&&MON_EN[m[1].toLowerCase()])return {dd:+m[2],mm:MON_EN[m[1].toLowerCase()],y:+m[3],rest:line.slice(m[0].length)};
  if((m=/^(\d{1,2})\.(\d{1,2})\.(?!\d)\s*/.exec(line)))return {dd:+m[1],mm:+m[2],y:null,rest:line.slice(m[0].length)};
  return null;
}
function tokVal(raw){
  raw=raw.trim();
  const suf=/(CR|DR|S|H|[-+])$/i.exec(raw),pre=/^[-+]/.exec(raw);
  const v=parseNum(raw.replace(/(CR|DR|S|H)$/i,"").replace(/^[-+]?\s?€?\s?/,"").replace(/[-+]$/,""),true);
  if(isNaN(v))return null;
  let sign=0,mk="";const sf=suf?suf[1].toUpperCase():"";
  if(sf==="S"||sf==="DR"||sf==="-")sign=-1;else if(sf==="H"||sf==="CR"||sf==="+")sign=1;
  else if(pre)sign=pre[0]==="-"?-1:1;
  if(sf==="-"||(!sf&&pre&&pre[0]==="-"))mk="-";else if(sf==="+"||(!sf&&pre&&pre[0]==="+"))mk="+";else if(sf)mk="sh";
  return {v,sign,mk};
}
const PDF_NOISE=/^(iban|bic|swift)\b/i;
function tailAmount(line){
  const toks=[];let m;AMT_RE.lastIndex=0;
  while((m=AMT_RE.exec(line)))if(!/[0-9.,]/.test(line[m.index+m[0].search(/[0-9]/)-1]||""))toks.push({s:m[0],i:m.index,e:m.index+m[0].length});
  if(!toks.length)return null;
  const last=toks[toks.length-1];
  if(!/^\s*(EUR|€)?\s*$/i.test(line.slice(last.e)))return null;
  let use=last,bal=null;
  if(toks.length>=2){const p=toks[toks.length-2];if(last.i-p.e<=3){use=p;const b=tokVal(last.s);if(b)bal=b.sign<0?-b.v:b.v;}} /* zweiter Betrag am Ende = Saldo */
  /* Bindestrich am Wortende ("Ernst-Blick- 3.130,72", Zeilenumbruch im Namen) ist kein Minus */
  let us=use.s;if(/^[-+]/.test(us)&&use.i>0&&/[A-Za-zÄÖÜäöüß0-9.]/.test(line[use.i-1]))us=us.replace(/^[-+]\s?/,"");
  const t=tokVal(us);if(!t)return null;
  return {v:t.v,sign:t.sign,mk:t.mk,start:use.i,end:last.e,ds:use.i+use.s.search(/[0-9]/),bal};
}
const POS_HINT=/gehalt|lohn\b|bezüge|bezuege|arbeitgeber|rente\b|kindergeld|gutschrift|eingang|erstattung|rückzahlung|rueckzahlung|zahlung erhalten|top-?up|überweisung von|ueberweisung von|einzahlung|refund|salary/i;
function detectPdfCtx(text,fname){
  const c={start:null,end:null,year:null};let m;const iso=(d,mo,y)=>y+"-"+pad2(mo)+"-"+pad2(d);
  if((m=/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(?:bis|-|–)\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i.exec(text))){c.start=iso(m[1],m[2],m[3]);c.end=iso(m[4],m[5],m[6]);return c;}
  if((m=/kontoauszug\s*(?:nr\.?\s*)?(\d{1,2})\s*\/\s*(\d{4})/i.exec(text))){c.year=+m[2];c.smon=+m[1];return c;}
  if((m=/(?:auszug|abrechnung|statement)[^\n]{0,40}?(20\d{2})/i.exec(text))){c.year=+m[1];return c;}
  if(fname&&(m=/(20\d{2})/.exec(fname))){c.year=+m[1];return c;}
  const all=[...text.matchAll(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/g)].map(x=>iso(x[1],x[2],x[3])).sort();
  if(all.length){c.start=all[0];c.end=all[all.length-1];}
  return c;
}
/* Spalten-Kopf "Soll / Haben": x-Positionen merken, damit unsignierte Betraege der richtigen Spalte zugeordnet werden */
function headerCols(l){
  if(!l.parts)return null;let neg=null,pos=null;
  for(const p of l.parts){
    const w=l.t.slice(p.a,p.b).trim();
    if(/^(soll|belastung|ausgang|abbuchung|ausgaben)$/i.test(w))neg={c:(p.x1+p.x2)/2,r:p.x2};
    else if(/^(haben|gutschrift|eingang|zahlungseingang|einnahmen)$/i.test(w))pos={c:(p.x1+p.x2)/2,r:p.x2};
  }
  return neg&&pos?{neg,pos}:null;
}
function colSign(cols,l,idx){
  if(!cols||!l.parts)return 0;
  const p=l.parts.find(p=>idx>=p.a&&idx<p.b);if(!p)return 0;
  const c=(p.x1+p.x2)/2,dn=Math.min(Math.abs(c-cols.neg.c),Math.abs(p.x2-cols.neg.r)),dp=Math.min(Math.abs(c-cols.pos.c),Math.abs(p.x2-cols.pos.r));
  return dn<=dp?-1:1;
}
/* lines: Strings oder {t,parts} (aus itemsToRows). Vorzeichen-Quellen in dieser Reihenfolge:
   ausdrueckliche Markierung (S/H, +/-, CR/DR), Saldo-Differenz zur vorigen Zeile, Soll/Haben-Spalte, Stichwort/Schaetzung (guess). */
function parsePdfLines(lines,opt){
  opt=opt||{};
  const L=lines.map(x=>typeof x==="string"?{t:x,parts:null}:x);
  const text=L.map(x=>x.t).join("\n"),ctx=opt.ctx||detectPdfCtx(text,opt.fname),year=opt.year||null;
  const rows=[],unrec=[];let cur=null,needYear=false,cols=null,prevBal=null;
  const resolveY=mm=>{
    if(year)return year;
    if(ctx.start&&ctx.end){const sy=+ctx.start.slice(0,4),ey=+ctx.end.slice(0,4);return(sy!==ey&&mm>+ctx.end.slice(5,7))?sy:ey;}
    if(ctx.year&&ctx.smon&&mm-ctx.smon>=6)return ctx.year-1; /* z. B. 30.12. im Auszug 1/2026 */
    return ctx.year||null;
  };
  const flush=()=>{
    if(!cur)return;
    if(cur.amt==null){unrec.push(cur.raw);cur=null;return;}
    const t=cur.t.replace(/\s+/g," ").trim().slice(0,200),av=Math.abs(cur.v);
    let sign=cur.sign,conf=sign?"mark":"";
    if(!sign&&cur.bal!=null&&prevBal!=null){const diff=cur.bal-prevBal;if(Math.abs(Math.abs(diff)-av)<0.015){sign=diff>0?1:-1;conf="bal";}}
    if(!sign&&cur.colSign){sign=cur.colSign;conf="col";}
    let guess=false;
    if(!sign){sign=POS_HINT.test(t)?1:-1;conf="guess";guess=true;}
    const amt=Math.round(sign*av*100)/100;
    if(cur.bal!=null)prevBal=cur.bal;else if(prevBal!=null&&!guess)prevBal=Math.round((prevBal+amt)*100)/100;else prevBal=null;
    if(cur.d==null)needYear=true;
    rows.push({d:cur.d,amt,p:"",t,guess,conf,mk:cur.mk||""});
    cur=null;
  };
  for(const l of L){
    const line=l.t.trim();if(!line)continue;
    /* IBAN-/BIC-Zeile innerhalb einer Buchung (DKB: zwischen Empfaenger und Verwendungszweck): ueberspringen, Buchung bleibt offen */
    if(cur&&cur.amt!=null&&PDF_NOISE.test(line)&&!leadDate(line))continue;
    const hc=headerCols(l);if(hc){flush();cols=hc;continue;}
    const ld=leadDate(line);let body=ld?ld.rest:line;
    if(ld){const l2=leadDate(body);if(l2&&(l2.y===ld.y||l2.y==null))body=l2.rest;} /* zweites Datum = Valuta */
    if(PDF_OLDBAL.test(body)){flush();const ta=tailAmount(body);if(ta)prevBal=ta.sign<0?-ta.v:ta.v;continue;}
    if(PDF_SKIP.test(body)){flush();continue;}
    const base=line.length-body.length;
    if(ld){
      flush();
      if(ld.mm<1||ld.mm>12||ld.dd<1||ld.dd>31){unrec.push(line);continue;}
      let d=null;
      if(ld.y)d=ld.y+"-"+pad2(ld.mm)+"-"+pad2(ld.dd);else{const y=resolveY(ld.mm);if(y)d=y+"-"+pad2(ld.mm)+"-"+pad2(ld.dd);}
      cur={d,t:"",amt:null,raw:line};
      const ta=tailAmount(body);
      if(ta){cur.amt=ta.v;cur.v=ta.v;cur.sign=ta.sign;cur.mk=ta.mk;cur.bal=ta.bal;cur.colSign=colSign(cols,l,base+ta.ds);cur.t=body.slice(0,ta.start);}else cur.t=body;
    }else if(cur){
      const ta=tailAmount(line);
      cur.raw+=" | "+line;
      if(cur.amt==null&&ta){cur.amt=ta.v;cur.v=ta.v;cur.sign=ta.sign;cur.mk=ta.mk;cur.bal=ta.bal;cur.colSign=colSign(cols,l,ta.ds);cur.t+=" "+line.slice(0,ta.start);}
      else if(ta){const r=line;flush();unrec.push(r);}
      else cur.t+=" "+line;
    }else if(tailAmount(line)){unrec.push(line);}
  }
  flush();
  /* Vorzeichen-Konvention des Dokuments: Ausgaben tragen ein Minus, kein Betrag ein Plus/S/H/CR/DR (z. B. DKB-Umsatzliste).
     Dann sind Betraege ohne Zeichen Eingaenge (Gehalt, Ueberweisungen an dich), keine geschaetzten Ausgaben. */
  const nMinus=rows.filter(r=>r.mk==="-").length,nOther=rows.filter(r=>r.mk&&r.mk!=="-").length,nBal=rows.filter(r=>r.conf==="bal"||r.conf==="col").length;
  if(nMinus>=3&&nOther===0&&nBal===0&&nMinus>=rows.length*0.5)for(const r of rows)if(r.conf==="guess"){r.amt=Math.abs(r.amt);r.conf="conv";r.guess=false;}
  for(const r of rows)delete r.mk;
  return {rows,unrec,needYear,ctx};
}

/* ---------- Sparziele ---------- */
/* Monate bis zum Zielmonat (YYYY-MM), inklusive des laufenden Monats als Abstand. 2026-10 bis 2027-02 = 4. */
function monthsLeft(by, today){
  if(!by||!/^\d{4}-\d{2}$/.test(by))return null;
  today=today||todayStr();
  const a=+today.slice(0,4)*12+(+today.slice(5,7)-1);
  const b=+by.slice(0,4)*12+(+by.slice(5,7)-1);
  return b-a;
}
/* Schon gespart: manueller Anfangsstand plus Abbuchungen der gewaehlten Kategorie (Geld, das zur Seite gelegt wurde). */
function goalSaved(S, goal, cmap){
  let s=+goal.have||0;
  const cat=goal.cat||"";
  if(cat){
    const from=goal.from||"";
    for(const t of S.tx||[]){
      if(!(t.amt<0))continue;
      const m=mkey(t);
      if(from&&m<from)continue;
      const c=cmap?cmap.get(t.h):t.c;
      if(c===cat)s+=-t.amt;
    }
  }
  return Math.round(s*100)/100;
}
function goalView(goal, saved, today){
  today=today||todayStr();
  const target=Math.round((+goal.target||0)*100)/100;
  const have=Math.round((+saved||0)*100)/100;
  const leftRaw=Math.round((target-have)*100)/100;
  const ml=monthsLeft(goal.by, today);
  const open=ml==null?null:Math.max(ml,0);
  const need=Math.max(0,leftRaw);
  const per=open>0?Math.round(need/open*100)/100:(need>0?need:0);
  return {id:goal.id,name:goal.n||goal.name||"Sparziel",target,saved:have,left:need,months:ml,per,pct:target>0?Math.max(0,Math.min(1,have/target)):0,done:target>0&&have+0.005>=target,overdue:ml!=null&&ml<0&&need>0.5,by:goal.by||"",cat:goal.cat||""};
}
function euro0(n){
  return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Math.round(+n||0)).replace(/[\u00a0\u202f]/g," ");
}
/* Anzeigetext, z. B. "Urlaub 1.500 €, noch 4 Monate". */
function goalPhrase(v){
  let when="";
  if(v.done)when="Ziel erreicht";
  else if(v.months==null)when="";
  else if(v.months<0)when="überfällig seit "+(-v.months)+" "+(v.months===-1?"Monat":"Monaten");
  else if(v.months===0)when="diesen Monat";
  else if(v.months===1)when="noch 1 Monat";
  else when="noch "+v.months+" Monate";
  return v.name+" "+euro0(v.target)+(when?", "+when:"");
}

/* ---------- Abo-Radar: wiederkehrende Abbuchungen, Preiserhoehungen ---------- */
function subscriptionRadar(S, cmap){
  const g=new Map();
  for(const t of S.tx||[]){
    if(!(t.amt<0))continue;
    const cat=cmap.get(t.h);
    if(cat===TRANSFER||cat===INCOME)continue;
    const k=merchantKey(t);if(!k)continue;
    (g.get(k)||g.set(k,[]).get(k)).push(t);
  }
  const mi=m=>+m.slice(0,4)*12+(+m.slice(5,7)-1);
  const out=[];
  for(const [k,arr0] of g){
    const arr=[...arr0].sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
    const byM=new Map();
    for(const t of arr){
      const m=t.d.slice(0,7);
      const e=byM.get(m)||byM.set(m,{m,txs:[],sum:0}).get(m);
      e.txs.push(t);e.sum+=-t.amt;
    }
    const months=[...byM.keys()].sort();
    if(months.length<3)continue;
    if([...byM.values()].some(e=>e.txs.length>1))continue; /* mehrere Buchungen im selben Monat: eher Einkauf als Abo */
    const idx=months.map(mi),gaps=idx.slice(1).map((v,i)=>v-idx[i]);
    const gapMed=medianOf(gaps),span=idx[idx.length-1]-idx[0];
    let interval=0;
    if(gapMed<=1.5&&(span===0||months.length-1>=span*0.6))interval=1;
    else if(gapMed>=2.5&&gapMed<=3.5&&months.length>=3)interval=3;
    else if(gapMed>=5&&gapMed<=7&&months.length>=3)interval=6;
    else if(gapMed>=11&&gapMed<=13&&months.length>=2)interval=12;
    else continue;
    const series=months.map(m=>byM.get(m).sum);
    const prev=series.slice(0,-1);
    const typical=medianOf(prev.length?prev:series);
    const last=series[series.length-1];
    if(!(typical>=1))continue;
    const increased=prev.length>=2&&last>typical*1.05&&(last-typical)>=0.5;
    const decreased=prev.length>=2&&last<typical*0.95&&(typical-last)>=0.5;
    const cc={};
    for(const t of arr){const x=cmap.get(t.h);if(x)cc[x]=(cc[x]||0)+1;}
    const cat=Object.keys(cc).sort((a,b)=>cc[b]-cc[a])[0]||null;
    const lastTx=byM.get(months[months.length-1]).txs[byM.get(months[months.length-1]).txs.length-1];
    out.push({k,name:(lastTx.p||lastTx.t||k).slice(0,40),cat,interval,months:months.length,typical:Math.round(typical*100)/100,last:Math.round(last*100)/100,lastDate:lastTx.d,increased,decreased,delta:Math.round((last-typical)*100)/100});
  }
  return out.sort((a,b)=>(b.increased?1:0)-(a.increased?1:0)||b.last-a.last);
}

/* ---------- Jahresrueckblick: Ausgaben je Kategorie gegen das Vorjahr ---------- */
function annualReview(S, cmap, year){
  year=+year;
  const bucket=y=>{
    const by={};let inc=0,total=0;const months=new Set();
    for(const t of S.tx||[]){
      if(+mkey(t).slice(0,4)!==y)continue;
      const c=cmap.get(t.h);
      if(c===TRANSFER)continue;
      months.add(mkey(t));
      if(c===INCOME){if(t.amt>0)inc+=t.amt;continue;}
      if(!(t.amt<0))continue;
      const k=c||"(unsortiert)";
      by[k]=(by[k]||0)+(-t.amt);
      total+=-t.amt;
    }
    return {by,inc,total,months:[...months].sort()};
  };
  const A=bucket(year),B=bucket(year-1);
  const rows=[...new Set([...Object.keys(A.by),...Object.keys(B.by)])].map(cat=>{
    const cur=Math.round((A.by[cat]||0)*100)/100,prev=Math.round((B.by[cat]||0)*100)/100;
    return {cat,cur,prev,delta:Math.round((cur-prev)*100)/100};
  }).sort((a,b)=>b.cur-a.cur||b.prev-a.prev);
  const r2=n=>Math.round(n*100)/100;
  return {year,prevYear:year-1,rows,curTotal:r2(A.total),prevTotal:r2(B.total),curInc:r2(A.inc),prevInc:r2(B.inc),curMonths:A.months,prevMonths:B.months};
}

/* ---------- CSV-Export (Semikolon, deutsches Komma, fuer z. B. die Steuer) ---------- */
function csvCell(s){s=String(s==null?"":s);return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function csvAmt(n){const v=Math.round((+n||0)*100)/100;return (v<0?"-":"")+Math.abs(v).toFixed(2).replace(".",",");}
function exportRows(S, cmap, opt){
  opt=opt||{};
  const rows=[];
  for(const t of S.tx||[]){
    const cat=cmap.get(t.h);
    if(opt.cats&&opt.cats.length){if(!opt.cats.includes(cat))continue;}
    else if(opt.cat&&opt.cat!=="all"){if(cat!==opt.cat)continue;}
    else if(cat===TRANSFER)continue;
    const y=mkey(t).slice(0,4);
    if(opt.year&&String(opt.year)!=="all"&&y!==String(opt.year))continue;
    if(opt.sign==="out"&&!(t.amt<0))continue;
    if(opt.sign==="in"&&!(t.amt>0))continue;
    const acc=(S.accounts.find(a=>a.id===t.a)||{}).name||"";
    rows.push({iso:t.d,date:t.d.slice(8,10)+"."+t.d.slice(5,7)+"."+t.d.slice(0,4),account:acc,category:cat?catLabel(cat):UNSORTED,payee:t.p||"",text:t.t||"",amount:t.amt});
  }
  rows.sort((a,b)=>a.iso<b.iso?-1:a.iso>b.iso?1:0);
  return rows;
}
function rowsToCSV(rows){
  const lines=["Datum;Konto;Kategorie;Händler;Verwendungszweck;Betrag"];
  for(const r of rows)lines.push([r.date,r.account,r.category,r.payee,r.text,csvAmt(r.amount)].map(csvCell).join(";"));
  return "\uFEFF"+lines.join("\r\n");
}

/* ---------- Ampel je Kategorie (gleiche Regeln wie die Monatsansicht, inkl. Prognose-Gelb) ---------- */
/* Sync-Fehler, die nur "kein Netz" bedeuten. Die Daten bleiben lokal und gehen später raus. */
function syncFailureKind(e){
  const code=String(e&&e.code||"").toLowerCase();
  const msg=String(e&&(e.message||e)||"").toLowerCase();
  const t=code+" "+msg;
  if(code==="unavailable"||/offline|unavailable|network-request-failed|failed to get document|could not reach|backend didn't respond|client is offline/.test(t))return "offline";
  return "error";
}
function budgetLights(S, ym, cmap, today){
  today=today||todayStr();
  cmap=cmap||resolveAll(S);
  const ag=monthAgg(S,ym,cmap);
  const inc=effIncome(S,ym,cmap,today);
  const cur=ym===today.slice(0,7);
  const pd=projDay(ym,today,ag.last);
  const dim=daysIn(ym);
  const canProj=cur&&pd>=8&&pd<dim;
  const out=[];
  (S.budget.items||[]).forEach((it,i)=>{
    if(it.goal)return;
    const ist=itemIst(it,ag),rf=refOf(S,it,inc.v);
    if(!(rf.ref>0))return;
    let am=ampel(S,it,ist,rf.ref);
    const fx=isFixItem(S,it);
    const pr=projection(fx?Object.assign({},it,{fix:1}):it,ist,ym,today,ag.last);
    const warn=canProj&&!fx&&pr>rf.ref*1.1&&am!=="r";
    if(warn)am="y";
    if(am==="y"||am==="r")out.push({i,name:it.n,am,ist:Math.round(ist*100)/100,ref:rf.ref,pr:Math.round(pr*100)/100,warn:!!warn});
  });
  return out.sort((a,b)=>(a.am==="r"?0:1)-(b.am==="r"?0:1)||b.ist-a.ist);
}

if(typeof module!=="undefined"&&module.exports)module.exports={dupCleanAll,importOverlap,accountOverlap,alnumOf,applyImport,dupScan,dupClean,dupSim,dupTokens,pdfLike,crossDups,listStats,salaryStats,salaryMonths,incKind,INC_KIND_LABEL,medianOf2,flipTx,flipGroup,flipRangeList,signCheck,ruleBreadth,reapplyRules,recurringBig,medianOf,kwMatch,kwParse,tok,fixPosts,applyRentMonths,MONTHS_DE,DEFKEYS,LEGACY_RULES,detectOwnCandidate,detectOwnNames,detectSalary,incomeSplit,MAN_ACC,materializeRecur,removeRecurTx,wipeImported,commonPeriod,PALETTE,catColor,donutData,coverage,coverageGaps,incomeAvgComplete,avgReport,mkey,takeRows,boundaryIncome,importDiag,SALARY_TXT,itemsToRows,DEF_BUDGET,neutralBudget,fixedSum,isFixItem,suggestFor,detectRecurring,SCHEMA,catLabel,groupOf,ensureItems,migrateState,incomeOf,projDay,lastDate,markDups,isCardPay,itemsToLines,parsePdfLines,detectPdfCtx,tailAmount,norm,DEF_CATS,DEF_RULES,expandRules,decodeBuf,parseCSV,detectDelim,parseNum,parseDate,analyzeCSV,extractRows,assignHashes,kwRe,merchantKey,resolveAll,monthAgg,latestBal,effIncome,refOf,itemIst,ampel,projection,deriveKey,encryptJSON,decryptJSON,packDocs,unpackDocs,docIdFor,sha256hex,pinCreate,pinVerify,newState,normalizeState,mergeStates,hasExtra,makeDemo,TRANSFER,INCOME,shiftYM,b64e,b64d,CHUNK,monthsLeft,goalSaved,goalView,goalPhrase,subscriptionRadar,annualReview,exportRows,rowsToCSV,budgetLights,syncFailureKind};
