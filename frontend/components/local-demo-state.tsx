"use client";
import {useEffect,useState,type Dispatch,type SetStateAction} from "react";
import {decodeLocal,encodeLocal} from "@/lib/demo-storage";
export function useLocalDemoState<T>(key:string,initial:()=>T,validate:(value:unknown)=>value is T,enabled:boolean):[T,Dispatch<SetStateAction<T>>,boolean,string]{
    const [value,setValue]=useState(initial),[ready,setReady]=useState(false),[warning,setWarning]=useState("");
    useEffect(()=>{if(enabled){try{const text=localStorage.getItem(key);if(text){const restored=decodeLocal(text,key,validate);if(restored)setValue(restored);else setWarning("Saved demo data was incompatible or malformed. Safe defaults were restored.");}}catch{setWarning("Local storage is unavailable. Changes last only for this tab.");}}setReady(true);},[key,enabled,validate]);
    useEffect(()=>{if(ready&&enabled)try{localStorage.setItem(key,encodeLocal(key,value));}catch{setWarning("Unable to persist demo data. Export or finish before closing this tab.");}},[key,value,ready,enabled]);
    // Disabled providers never wait for browser-local storage during real-mode SSR.
    return [value,setValue,!enabled||ready,warning];
}
