'use client';
import { useState } from 'react';
import { api } from '../lib/api';

export default function EditAgent({ row, onSaved }: { row: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(String(row.name ?? ''));
  const [model, setModel] = useState(String(row.model ?? ''));
  const [instructions, setInstructions] = useState(String(row.instructions ?? ''));
  const [error, setError] = useState('');
  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>Edit</button>;
  return <form className="card stack form" style={{ minWidth: 380 }} onSubmit={async (e) => {
    e.preventDefault();
    try {
      setError('');
      await api(`/agents/${row.id}`, { method: 'PATCH', body: JSON.stringify({ name, model, instructions }) });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }}>
    <div className="toolbar"><strong>Edit agent</strong><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Close</button></div>
    <label>Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
    <label>Model<input className="input" value={model} onChange={(e) => setModel(e.target.value)} required /></label>
    <label>Instructions<textarea className="input" rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)} required /></label>
    {error && <div className="error">{error}</div>}
    <button className="btn">Save changes</button>
  </form>;
}
