'use client'; import { useEffect,useState } from 'react'; import { api } from '../lib/api';
export default function ListPage({endpoint,columns,actions,emptyLabel}:{endpoint:string;columns:{key:string;label:string;render?:(v:any,row:any)=>React.ReactNode}[];actions?:(row:any,reload:()=>void)=>React.ReactNode;emptyLabel?:string}){
  const [rows,setRows]=useState<any[]>([]),[err,setErr]=useState(''),[loading,setLoading]=useState(true);
  const load=()=>{setErr('');return api(endpoint).then(r=>{setRows(r);setLoading(false)}).catch(e=>{setErr(e.message);setLoading(false)})};
  useEffect(()=>{load();},[endpoint]);
  if(err)return <div className="error">{err}</div>;
  if(loading)return <div className="empty-state">Loading…</div>;
  if(!rows.length)return <div className="empty-state">{emptyLabel??'Nothing here yet.'}</div>;
  return <table className="table"><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{actions&&<th>Actions</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id??i}>{columns.map(c=><td key={c.key}>{c.render?c.render(r[c.key],r):String(r[c.key]??'—')}</td>)}{actions&&<td>{actions(r,load)}</td>}</tr>)}</tbody></table>
}
