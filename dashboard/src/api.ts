export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export class ApiError extends Error { status:number; constructor(status:number, message:string){super(message);this.status=status;} }
export async function portal<T>(path:string, options:RequestInit={}):Promise<T>{
 const response=await fetch(API_URL+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...options.headers}});
 if(!response.ok){const body=await response.json().catch(()=>null);throw new ApiError(response.status,body?.error||`Request failed (${response.status})`);}
 return response.status===204?undefined as T:response.json();
}

