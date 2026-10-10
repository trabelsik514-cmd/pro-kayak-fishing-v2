import { Capacitor } from '@capacitor/core';

const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/,'');
const nativeFallbacks = [
  configured,
  'https://pro-kayak-fishing-v2.vercel.app'
].filter(Boolean);

export function apiUrls(path: string): string[] {
  const clean = path.startsWith('/') ? path : '/' + path;
  if (!Capacitor.isNativePlatform()) return [clean];
  return [...new Set(nativeFallbacks.map(base => base + clean))];
}

export async function fetchApi(path:string, init:RequestInit = {}, timeoutMs=9000):Promise<Response>{
  const urls=apiUrls(path);
  let lastError:unknown=null;
  for(const url of urls){
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{...init,signal:controller.signal,headers:{Accept:'application/json',...(init.headers ?? {})}});
      const contentType=(response.headers.get('content-type')??'').toLowerCase();
      // Native requests can be redirected to a deployment/login HTML page.
      // Never treat that HTML as a successful API response; try the next trusted base URL.
      if((response.ok || response.status===400 || response.status===405) && contentType.includes('json')) return response;
      lastError=new Error(response.ok
        ? 'API returned a non-JSON response'
        : `HTTP ${response.status}`);
    }catch(error){lastError=error}
    finally{window.clearTimeout(timer)}
  }
  throw lastError instanceof Error ? lastError : new Error('API unavailable');
}
