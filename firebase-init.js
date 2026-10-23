/* Firebase 10.12.2, lokal aus vendor/ (kein CDN). Dieselbe modulare Schnittstelle wie bisher, plus lokaler Firestore-Speicher. */
import {initializeApp} from "./vendor/firebase-app.js";
import {initializeFirestore,doc,onSnapshot,setDoc,getDoc,persistentLocalCache,persistentMultipleTabManager,memoryLocalCache} from "./vendor/firebase-firestore.js";
/* Diese eine Konsolenmeldung ist kein Absturz: ohne Netz liest und schreibt Firestore in den lokalen Speicher und schickt die Änderungen später. */
const origError=console.error.bind(console);
console.error=(...args)=>{
  const t=args.map(a=>a&&a.message?a.message:String(a)).join(" ");
  if(/Could not reach Cloud Firestore backend|Failed to get document because the client is offline/i.test(t))return;
  origError(...args);
};
const app=initializeApp({apiKey:"AIzaSyAJSl4t2Mj9uVev5jg2gcbzpQQermiZA4M",authDomain:"kochplaner-f70c8.firebaseapp.com",projectId:"kochplaner-f70c8",storageBucket:"kochplaner-f70c8.firebasestorage.app",messagingSenderId:"1049347489480",appId:"1:1049347489480:web:f0bcd79568d69ab1cbaffd"});
const net={experimentalAutoDetectLongPolling:true};
let db;
try{
  db=initializeFirestore(app,Object.assign({localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})},net));
}catch(e){
  try{db=initializeFirestore(app,Object.assign({localCache:memoryLocalCache()},net));}
  catch(e2){db=initializeFirestore(app,net);}
}
window.FB={db,doc,onSnapshot,setDoc,getDoc};
window.dispatchEvent(new Event("fb"));
