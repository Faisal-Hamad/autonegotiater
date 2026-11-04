"use client";
import Link from "next/link";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {useDemo} from "./demo-provider";
import {useRealWorkspace} from "./real-workspace-provider";
import {realApi} from "@/lib/real-api";
import {Heading} from "./ui";
export function RealAccount({kind}:{kind:"login"|"register"|"profile"}){
 const {user}=useDemo();
 if(kind==="profile")return user.active?<Profile/>:<div className="panel"><h1>Sign in required</h1><Link className="btn mt-5" href="/login">Sign in</Link></div>;
 return <SignInForm kind={kind}/>;
}
function SignInForm({kind}:{kind:"login"|"register"}){
 const {reload}=useRealWorkspace(),router=useRouter();const[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");const f=new FormData(event.currentTarget);
 try{const account=await realApi<{role:string}>(`/auth/${kind}`,{email:String(f.get("email")),password:String(f.get("password")),...(kind==="register"?{name:String(f.get("name")),role:String(f.get("role"))}:{})});await reload();router.push(`/dashboard/${account.role}`);}
 catch(e){setError(e instanceof Error?e.message:"Unable to complete this request.");}finally{setBusy(false);}}
 return <div className="max-w-xl mx-auto"><Heading eyebrow="Secure account access" title={kind==="login"?"Welcome back":"Create an account"} description="Your identity and permissions are verified by the server."/><form className="panel space-y-5" onSubmit={submit}>
 {kind==="register"&&<label>Full name<input name="name" required maxLength={100} autoComplete="name"/></label>}
 <label>Email<input name="email" required type="email" maxLength={100} autoComplete="email"/></label>
 <label>Password<input name="password" type="password" required minLength={kind==="register"?12:1} maxLength={256} autoComplete={kind==="register"?"new-password":"current-password"}/></label>
 {kind==="register"&&<label>Account type<select name="role"><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label>}
 {error&&<p className="text-rose-700" role="alert">{error}</p>}<button className="btn w-full" disabled={busy}>{busy?"Please wait…":kind==="login"?"Sign in":"Create account"}</button>
 <Link className="text-indigo-600 block" href={kind==="login"?"/register":"/login"}>{kind==="login"?"Create a Buyer or Seller account":"Already have an account? Sign in"}</Link></form></div>;
}
const roles={buyer:{label:"Buyer",tone:"bg-indigo-50 text-indigo-700",text:"You browse products, negotiate through your Buyer Agent or buy directly, and approve final agreements."},seller:{label:"Seller",tone:"bg-amber-50 text-amber-800",text:"You list products, set private negotiation limits for your Seller Agent, and accept or reject buyers' final offers."},admin:{label:"Admin",tone:"bg-emerald-50 text-emerald-700",text:"You monitor users, negotiations and agreements, manage accounts and download reports."}} as const;
function Section({title,description,children,open=false}:{title:string;description:string;children:React.ReactNode;open?:boolean}){
 return <details className="panel group" open={open}><summary className="cursor-pointer list-none flex items-center justify-between gap-4"><span><strong className="block text-lg">{title}</strong><span className="block text-sm muted mt-1">{description}</span></span><span aria-hidden className="text-slate-400 transition-transform group-open:rotate-180">▾</span></summary><div className="mt-5">{children}</div></details>;
}
function useSubmit(action:(f:FormData)=>Promise<string>){
 const[error,setError]=useState(""),[done,setDone]=useState(""),[busy,setBusy]=useState(false);
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;const form=event.currentTarget;setError("");setDone("");setBusy(true);
  try{setDone(await action(new FormData(form)));form.reset();}catch(e){setError(e instanceof Error?e.message:"Unable to save the change.");}finally{setBusy(false);}}
 const status=<>{error&&<p className="text-rose-700" role="alert">{error}</p>}{done&&<p className="text-emerald-700" role="status">{done}</p>}</>;
 return {submit,busy,status};
}
function Profile(){
 const {user}=useDemo(),{reload}=useRealWorkspace(),router=useRouter();
 const role=roles[user.role];
 const name=useSubmit(async f=>{await realApi(`/workspace/users/${user.id}`,{name:String(f.get("name")),email:user.email},"PUT");await reload();return "Your name was saved.";});
 const email=useSubmit(async f=>{await realApi("/auth/email",{newEmail:String(f.get("newEmail")),currentPassword:String(f.get("currentPassword"))});await reload();return "Your email was changed. Use the new email to sign in.";});
 const password=useSubmit(async f=>{if(f.get("newPassword")!==f.get("confirmPassword"))throw new Error("The new passwords do not match.");await realApi("/auth/password",{currentPassword:String(f.get("currentPassword")),newPassword:String(f.get("newPassword"))});return "Your password was changed. Other devices were signed out.";});
 const[signOutError,setSignOutError]=useState("");
 return <div className="max-w-2xl mx-auto space-y-4"><Heading eyebrow="My account" title="Your profile" description="Your account details and sign-in settings."/>
  <section className="panel flex items-start gap-4" aria-label="Account summary">
   <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-indigo-600 text-white text-xl font-bold shrink-0">{user.name.trim().charAt(0).toUpperCase()||"?"}</span>
   <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-xl">{user.name}</strong><span className={`text-xs font-semibold rounded-full px-3 py-1 ${role.tone}`} aria-label={`Account type: ${role.label}`}>{role.label} account</span><span className="text-xs rounded-full px-3 py-1 bg-emerald-50 text-emerald-700">Active</span></div>
    <p className="muted text-sm mt-1 break-all">{user.email}</p><p className="text-sm mt-3">{role.text}</p><p className="text-xs muted mt-2">The account type is chosen when the account is created and cannot be changed here.</p></div>
  </section>
  <Section title="Name" description="The name other users see on negotiations and agreements." open>
   <form className="space-y-4" onSubmit={name.submit}><label>Full name<input name="name" required maxLength={100} autoComplete="name" defaultValue={user.name}/></label>{name.status}<button className="btn" disabled={name.busy}>{name.busy?"Saving…":"Save name"}</button></form>
  </Section>
  <Section title="Change email" description={`You sign in with ${user.email}.`}>
   <form className="space-y-4" onSubmit={email.submit} aria-label="Change email"><label>New email<input name="newEmail" type="email" required maxLength={100} autoComplete="email"/></label><label>Current password<input name="currentPassword" type="password" required maxLength={256} autoComplete="current-password"/></label>{email.status}<button className="btn" disabled={email.busy}>{email.busy?"Saving…":"Change email"}</button></form>
  </Section>
  <Section title="Change password" description="At least 12 characters. Other signed-in devices are signed out.">
   <form className="space-y-4" onSubmit={password.submit} aria-label="Change password"><label>Current password<input name="currentPassword" type="password" required maxLength={256} autoComplete="current-password"/></label><label>New password<input name="newPassword" type="password" required minLength={12} maxLength={256} autoComplete="new-password"/></label><label>Confirm new password<input name="confirmPassword" type="password" required minLength={12} maxLength={256} autoComplete="new-password"/></label>{password.status}<button className="btn" disabled={password.busy}>{password.busy?"Saving…":"Change password"}</button></form>
  </Section>
  {signOutError&&<p className="text-rose-700" role="alert">{signOutError}</p>}
  <button type="button" className="btn-secondary w-full" onClick={async()=>{try{await realApi("/auth/logout",{});await reload();router.push("/login");}catch(e){setSignOutError(e instanceof Error?e.message:"Unable to sign out.");}}}>Sign out</button>
 </div>;
}
