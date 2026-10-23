/* Service Worker für den Finanzplaner: App und Bibliotheken werden zwischengespeichert, damit sie auch ohne Internet starten. */
const V="finanzplaner-v13";
const CORE=["./","index.html","style.css","theme.js","core.js","app.js","firebase-init.js","apple-touch-icon.png","vendor/firebase-app.js","vendor/firebase-firestore.js","vendor/pdf.min.js","vendor/pdf.worker.min.js"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
const put=(r,res)=>{try{if(res&&(res.status===200||res.type==="opaque")){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp)).catch(()=>{});}}catch(e){}return res;};
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    for(const c of cs)if(c.focus)return c.focus();
    if(self.clients.openWindow)return self.clients.openWindow("./");
  }));
});
self.addEventListener("fetch",e=>{
  const r=e.request; if(r.method!=="GET") return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    /* Eigene Dateien: erst das Netz (maximal 3 Sekunden), sonst der Zwischenspeicher */
    e.respondWith(
      Promise.race([fetch(r).then(res=>{if(res.ok) return put(r,res); throw new Error("bad");}),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),3000))])
        .catch(()=>caches.match(r).then(m=>m||caches.match("index.html")))
    );
  }else if(/(^|\.)gstatic\.com$|^fonts\.googleapis\.com$/.test(u.hostname)){
    /* Schriften (Google Fonts): einmal laden, dann aus dem Zwischenspeicher. Firestore-Verbindungen (googleapis.com) werden nie angefasst. Firebase und pdf.js liegen lokal unter vendor/. */
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>put(r,res))));
  }
});
