const base=process.env.API_PUBLIC_URL??'http://localhost:4000'; const r=await fetch(`${base}/health`); if(!r.ok) throw new Error(`health failed ${r.status}`); console.log(await r.json());
