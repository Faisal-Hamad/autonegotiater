"use client";
import Link from "next/link";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {useDemo} from "./demo-provider";
import {useRealWorkspace} from "./real-workspace-provider";
import {realApi} from "@/lib/real-api";
import {Heading} from "./ui";
export function RealAccount({kind}:{kind:"login"|"register"|"profile"}){
 const {user}=useDemo(),{reload}=useRealWorkspace(),router=useRouter();const[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");const f=new FormData(event.currentTarget);
 try{if(kind==="profile"){await realApi(`/workspace/users/${user.id}`,{name:String(f.get("name")),email:String(f.get("email"))},"PUT");await reload();}
 else{const account=await realApi<{role:string}>(`/auth/${kind==="login"?"login":"register"}`,{email:String(f.get("email")),password:String(f.get("password")),...(kind==="register"?{name:String(f.get("name")),role:String(f.get("role"))}:{})});await reload();router.push(`/dashboard/${account.role}`);}}
 catch(e){setError(e instanceof Error?e.message:"Unable to complete this request.");}finally{setBusy(false);}}
 if(kind==="profile"&&!user.active)return <div className="panel"><h1>Sign in required</h1><Link className="btn mt-5" href="/login">Sign in</Link></div>;
 return <div className="max-w-xl mx-auto"><Heading eyebrow="Secure account access" title={kind==="login"?"Welcome back":kind==="register"?"Create an account":"Your profile"} description="Your identity and permissions are verified by the server."/><form className="panel space-y-5" onSubmit={submit}>
 {kind!=="login"&&<label>Full name<input name="name" required maxLength={100} autoComplete="name" defaultValue={kind==="profile"?user.name:""}/></label>}
 <label>Email<input name="email" required type="email" maxLength={100} autoComplete="email" defaultValue={kind==="profile"?user.email:""}/></label>
 {kind!=="profile"&&<label>Password<input name="password" type="password" required minLength={kind==="register"?12:1} maxLength={256} autoComplete={kind==="register"?"new-password":"current-password"}/></label>}
 {kind==="register"&&<label>Account role<select name="role"><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label>}
 {error&&<p className="text-rose-700" role="alert">{error}</p>}<button className="btn w-full" disabled={busy}>{busy?"Please wait…":kind==="login"?"Sign in":kind==="register"?"Create account":"Save profile"}</button>
 {kind==="profile"?<button type="button" className="btn-secondary w-full" onClick={async()=>{try{await realApi("/auth/logout",{});await reload();router.push("/login");}catch(e){setError(e instanceof Error?e.message:"Unable to sign out.");}}}>Sign out</button>:<Link className="text-indigo-600 block" href={kind==="login"?"/register":"/login"}>{kind==="login"?"Create a Buyer or Seller account":"Already have an account? Sign in"}</Link>}</form></div>;
}
