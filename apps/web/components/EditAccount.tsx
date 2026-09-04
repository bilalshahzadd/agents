'use client';
import { useState } from 'react';
import { api } from '../lib/api';
import { withFeedback } from '../lib/toast';

export default function EditAccount({ row, onSaved }: { row: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState(String(row.handle ?? ''));
  const [externalAccountId, setExternalAccountId] = useState(String(row.external_account_id ?? ''));
  const [cred, setCred] = useState('{\n  "accessToken": ""\n}');
  const [error, setError] = useState('');
  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>Edit</button>;
  return <form className="card stack form" style={{ minWidth: 340 }} onSubmit={async (e) => {
    e.preventDefault();
    try {
      setError('');
      await api(`/social-accounts/${row.id}`, { method: 'PATCH', body: JSON.stringify({ handle, externalAccountId }) });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }}>
    <div className="toolbar"><strong>Edit account</strong><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Close</button></div>
    <label>Handle<input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} required /></label>
    <label>Provider account ID<input className="input" value={externalAccountId} onChange={(e) => setExternalAccountId(e.target.value)} required /></label>
    {error && <div className="error">{error}</div>}
    <button className="btn">Save changes</button>
    <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '4px 0' }} />
    <label>Rotate credentials (encrypted server-side immediately)</label>
    <textarea className="input mono" rows={5} value={cred} onChange={(e) => setCred(e.target.value)} />
    <button type="button" className="btn secondary" onClick={withFeedback(async () => {
      const parsed = JSON.parse(cred);
      await api(`/social-accounts/${row.id}/credentials`, { method: 'PATCH', body: JSON.stringify({ credentials: parsed }) });
    }, { successMessage: 'Credentials rotated' })}>Rotate credentials</button>
  </form>;
}
