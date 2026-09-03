'use client'; import { useState } from 'react'; import Link from 'next/link'; import { usePathname,useRouter } from 'next/navigation'; import ToastHost from './ToastHost';
export default function Shell({children,title,subtitle}:{children:React.ReactNode;title:string;subtitle?:string}){
  const path=usePathname(),router=useRouter();
  const [navOpen,setNavOpen]=useState(false);
  const nav=[['/','Command Center'],['/brands','Brands'],['/campaigns','Campaigns'],['/queue','Content Queue'],['/agents','Agents'],['/accounts','Accounts'],['/research','Research & Trends'],['/analytics','Intelligence'],['/audit','Audit Log']];
  const navLinks=<nav className="nav">{nav.map(([href,label])=><Link key={href} href={href} onClick={()=>setNavOpen(false)} style={path===href?{background:'var(--panel)',color:'var(--text)'}:{}}>{label}</Link>)}</nav>;
  return <div className="shell">
    <ToastHost/>
    <aside className="sidebar"><div className="logo">SPHERIC <span>AGENTS</span></div>{navLinks}</aside>
    {navOpen&&<div className="nav-drawer-backdrop" onClick={()=>setNavOpen(false)}><aside className="sidebar nav-drawer" onClick={e=>e.stopPropagation()}><div className="logo">SPHERIC <span>AGENTS</span></div>{navLinks}</aside></div>}
    <main className="main">
      <div className="top">
        <button className="btn secondary nav-toggle" aria-label="Open navigation" onClick={()=>setNavOpen(true)}>☰</button>
        <div><h1 className="h1">{title}</h1>{subtitle&&<div className="sub">{subtitle}</div>}</div>
        <button className="btn secondary" onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});router.push('/login')}}>Sign out</button>
      </div>
      {children}
    </main>
  </div>;
}
