"use client";
import Link from "next/link";
import {useDemo} from "./demo-provider";
import {useCompetitiveWorkspace} from "./competitive-provider";
export function AgreementLinks({sessionId}:{sessionId:string}){const c=useCompetitiveWorkspace(),{user}=useDemo();return <>{c.agreements.filter(g=>g.sessionId===sessionId).map(g=><Link className="btn mt-4" href={`/dashboard/${user.role}/agreements/${g.id}`} key={g.id}>View recorded DEMO Agreement →</Link>)}</>;}
