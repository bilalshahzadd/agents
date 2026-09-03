'use client';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function BrandSettings() {
  const [brands, setBrands] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [voice, setVoice] = useState('');
  const [knowledge, setKnowledge] = useState('{}');
  const [message, setMessage] = useState('');
  const [create, setCreate] = useState({ name: '', slug: '', voice: '' });
  const load = async () => {
    const rows = await api('/brands');
    setBrands(rows);
    if (selected) setSelected(rows.find((row: any) => row.id === selected.id) ?? rows[0] ?? null);
    else setSelected(rows[0] ?? null);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selected) return;
    setVoice(selected.voice ?? '');
    setKnowledge(JSON.stringify(selected.knowledge_base ?? {}, null, 2));
  }, [selected]);
  return <div className="grid-two">
    <div className="stack">
      <div className="card stack">
        <strong>Brands</strong>
        {brands.map((brand) => <button type="button" key={brand.id} className="btn secondary" onClick={() => setSelected(brand)}>{brand.name}</button>)}
      </div>
      <form className="card stack" onSubmit={async (event) => {
        event.preventDefault();
        setMessage('');
        try {
          await api('/brands', { method: 'POST', body: JSON.stringify({ ...create, knowledgeBase: {} }) });
          setCreate({ name: '', slug: '', voice: '' });
          setMessage('Brand created.');
          await load();
        } catch (err) {
          setMessage(err instanceof Error ? err.message : String(err));
        }
      }}>
        <strong>Create brand</strong>
        <input className="input" placeholder="Name" required value={create.name} onChange={(event) => setCreate({ ...create, name: event.target.value })} />
        <input className="input" placeholder="slug" required pattern="[a-z0-9-]+" value={create.slug} onChange={(event) => setCreate({ ...create, slug: event.target.value })} />
        <textarea className="input" rows={4} placeholder="Brand voice" value={create.voice} onChange={(event) => setCreate({ ...create, voice: event.target.value })} />
        <button className="btn">Create</button>
      </form>
    </div>
    {selected && <form className="card stack" onSubmit={async (event) => {
      event.preventDefault();
      try {
        setMessage('');
        await api(`/brands/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ voice, knowledgeBase: JSON.parse(knowledge) }) });
        setMessage('Brand configuration saved.');
        await load();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : String(err));
      }
    }}>
      <div><strong>{selected.name}</strong><div className="sub">Knowledge and voice are retrieved by research and campaign agents.</div></div>
      <label>Voice<textarea className="input" rows={7} value={voice} onChange={(event) => setVoice(event.target.value)} /></label>
      <label>Knowledge base JSON<textarea className="input mono" rows={18} value={knowledge} onChange={(event) => setKnowledge(event.target.value)} /></label>
      <button className="btn">Save brand</button>
      {message && <div className="sub">{message}</div>}
    </form>}
  </div>;
}
