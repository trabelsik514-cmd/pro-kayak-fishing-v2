import { Capacitor } from '@capacitor/core';

const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/,'');
const nativeFallbacks = [
  configured,
  'https://pro-kayak-fishing2.vercel.app',
  'https://pro-kayak-fishing-v2.vercel.app'
].filter(Boolean);

export function apiUrls(path: string): string[] {
  const clean = path.startsWith('/') ? path : '/' + path;
  if (!Capacitor.isNativePlatform()) return [clean];
  return [...new Set(nativeFallbacks.map(base => base + clean))];
}

export async function fetchApi(path:string, init:RequestInit = {}, timeoutMs=12000):Promise<Response>{
  const urls=apiUrls(path);
  let lastError:unknown=null;
  for(const url of urls){
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{...init,signal:controller.signal,headers:{Accept:'application/json',...(init.headers ?? {})}});
      if(response.ok || response.status===400 || response.status===405) return response;
      lastError=new Error(`HTTP ${response.status}`);
    }catch(error){lastError=error}
    finally{window.clearTimeout(timer)}
  }
  throw lastError instanceof Error ? lastError : new Error('API unavailable');
}
