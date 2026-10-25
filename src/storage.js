let connection;
export function db() {
  return connection??=new Promise((resolve,reject)=>{
    const r=indexedDB.open('mimibox-v1',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('state');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
export async function read(key,fallback) {
  const database=await db();return new Promise((resolve,reject)=>{const r=database.transaction('state').objectStore('state').get(key);r.onsuccess=()=>resolve(r.result??fallback);r.onerror=()=>reject(r.error);});
}
export async function write(key,value) {
  const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('state','readwrite');tx.objectStore('state').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
