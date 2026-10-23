/* Service Worker für den Finanzplaner: nach einem Besuch liegen App, Schriften und Bibliotheken im Cache und starten ohne Internet. */
const V="finanzplaner-v15";
const CORE=["./","index.html","manifest.json","style.css","fonts/fonts.css","fonts/OFL.txt","theme.js","core.js","app.js","firebase-init.js","apple-touch-icon.png","vendor/firebase-app.js","vendor/firebase-firestore.js","vendor/pdf.min.js","vendor/pdf.worker.min.js","fonts/7cHpv4kjgoGqM7E_A8s5ynghnQci.woff2","fonts/7cHpv4kjgoGqM7E_Ass5ynghnQci.woff2","fonts/7cHpv4kjgoGqM7E_DMs5ynghnQ.woff2","fonts/7cHqv4kjgoGqM7E3_-gs6Fostz0rdom9.woff2","fonts/7cHqv4kjgoGqM7E3_-gs6Vostz0rdom9.woff2","fonts/7cHqv4kjgoGqM7E3_-gs51ostz0rdg.woff2","fonts/7cHqv4kjgoGqM7E30-8s6Fostz0rdom9.woff2","fonts/7cHqv4kjgoGqM7E30-8s6Vostz0rdom9.woff2","fonts/7cHqv4kjgoGqM7E30-8s51ostz0rdg.woff2","fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B4873z3nWuYMBYrp0xg.woff2","fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B4873z3jWuYMBYrp0xg.woff2","fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B4873z3bWuYMBYro.woff2","fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3nWuYMBYrp0xg.woff2","fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3jWuYMBYrp0xg.woff2","fonts/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3bWuYMBYro.woff2"];
self.addEventListener("install",e=>{
  e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
const put=(cache,r,res)=>{try{if(res&&res.ok){const cp=res.clone();cache.put(r,cp).catch(()=>{});}}catch(e){}return res;};
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    for(const c of cs)if(c.focus)return c.focus();
    if(self.clients.openWindow)return self.clients.openWindow("./");
  }));
});
function cached(r){
  return caches.match(r,{ignoreSearch:true,ignoreVary:true});
}
self.addEventListener("fetch",e=>{
  const r=e.request; if(r.method!=="GET") return;
  const u=new URL(r.url);
  if(u.origin!==location.origin) return;
  const nav=r.mode==="navigate";
  e.respondWith((async()=>{
    const cache=await caches.open(V);
    const hit=await cached(r);
    const offline=self.navigator&&self.navigator.onLine===false;
    if(offline) return hit||(nav?cached("index.html"):Response.error());
    try{
      const res=await Promise.race([
        fetch(r).then(x=>{if(x&&x.ok)return x; throw new Error("bad");}),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),3000))
      ]);
      return put(cache,r,res);
    }catch(err){
      return hit||(nav?cached("index.html"):Response.error());
    }
  })());
});
