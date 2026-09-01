'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
const platforms=['x','linkedin','telegram','instagram','facebook','tiktok'];
export default function CreateCampaign({onCreated}:{onCreated?:()=>void}){
  const [brands,setBrands]=useState<any[]>([]),[open,setOpen]=useState(false),[err,setErr]=useState('');
  const [form,setForm]=useState<any>({brandId:'',name:'',objective:'',audience:'',startAt:'',endAt:'',platforms:['x'],postsPerPlatform:5,requiresApproval:true});
  useEffect(()=>{api('/brands').then((x:any[])=>{setBrands(x);if(x[0])setForm((f:any)=>({...f,brandId:f.brandId||x[0].id}))}).catch(()=>{})},[]);
  if(!open)return <button className="btn" onClick={()=>setOpen(true)}>New campaign</button>;
  return <form className="card stack form" onSubmit={async e=>{e.preventDefault();try{setErr('');await api('/campaigns',{method:'POST',body:JSON.stringify({...form,startAt:new Date(form.startAt).toISOString(),endAt:new Date(form.endAt).toISOString(),postsPerPlatform:Number(form.postsPerPlatform)})});setOpen(false);onCreated?.()}catch(e){setErr(e instanceof Error?e.message:String(e))}}}>
    <div className="toolbar"><strong>New campaign</strong><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Close</button></div>
    <select className="input" value={form.brandId} onChange={e=>setForm({...form,brandId:e.target.value})}>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
    <input className="input" placeholder="Campaign name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
    <textarea className="input" rows={4} placeholder="Objective" value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})} required/>
    <textarea className="input" rows={3} placeholder="Audience" value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})} required/>
    <div className="grid" style={{gridTemplateColumns:'1fr 1fr'}}><label>Start<input className="input" type="datetime-local" value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})} required/></label><label>End<input className="input" type="datetime-local" value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})} required/></label></div>
    <div className="toolbar">{platforms.map(p=><label key={p} className="badge"><input type="checkbox" checked={form.platforms.includes(p)} onChange={e=>setForm({...form,platforms:e.target.checked?[...form.platforms,p]:form.platforms.filter((x:string)=>x!==p)})}/>&nbsp;{p}</label>)}</div>
    <label>Posts per platform<input className="input" type="number" min={1} max={50} value={form.postsPerPlatform} onChange={e=>setForm({...form,postsPerPlatform:e.target.value})}/></label>
    <label><input type="checkbox" checked={form.requiresApproval} onChange={e=>setForm({...form,requiresApproval:e.target.checked})}/> Require human approval</label>
    {err&&<div className="error">{err}</div>}<button className="btn">Create campaign</button>
  </form>
}
