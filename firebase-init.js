/* Firebase 10.12.2, lokal aus vendor/ (kein CDN). Dieselbe modulare Schnittstelle wie bisher. */
import {initializeApp} from "./vendor/firebase-app.js";
import {initializeFirestore,doc,onSnapshot,setDoc,getDoc} from "./vendor/firebase-firestore.js";
const app=initializeApp({apiKey:"AIzaSyAJSl4t2Mj9uVev5jg2gcbzpQQermiZA4M",authDomain:"kochplaner-f70c8.firebaseapp.com",projectId:"kochplaner-f70c8",storageBucket:"kochplaner-f70c8.firebasestorage.app",messagingSenderId:"1049347489480",appId:"1:1049347489480:web:f0bcd79568d69ab1cbaffd"});
const db=initializeFirestore(app,{experimentalAutoDetectLongPolling:true});
window.FB={db,doc,onSnapshot,setDoc,getDoc};
window.dispatchEvent(new Event("fb"));
