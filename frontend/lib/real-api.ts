export const realMode = process.env.NEXT_PUBLIC_AUTONEG_REAL_MODE === "true";
export async function realApi<T>(path:string,body?:unknown,method?:string):Promise<T>{
 const response=await fetch(`/api${path}`,{method:method??(body===undefined?"GET":"POST"),credentials:"same-origin",cache:"no-store",headers:body===undefined?{Accept:"application/json"}:{Accept:"application/json","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(typeof data?.detail==="string"?data.detail:response.status===401?"Sign in to continue.":"The request could not be completed. Please try again.");
 return data as T;
}
