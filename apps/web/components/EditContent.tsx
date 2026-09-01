'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

export default function EditContent({ row, onSaved }: { row: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [body, setBody] = useState(String(row.body ?? ''));
  const [socialAccountId, setSocialAccountId] = useState<string>(row.social_account_id ?? '');
  const [scheduledAt, setScheduledAt] = useState<string>(row.scheduled_at ? toLocalInput(row.scheduled_at) : '');
  useEffect(() => {
    if (open) api('/social-accounts').then(setAccounts).catch((e) => setError(e.message));
  }, [open]);
  const matching = useMemo(() => accounts.filter((account) => account.platform === row.platform), [accounts, row.platform]);
  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>Edit</button>;
  return <form className="card stack form" style={{ minWidth: 360 }} onSubmit={async (event) => {
    event.preventDefault();
    try {
      setError('');
      await api(`/content/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          body,
          socialAccountId: socialAccountId || null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }}>
    <div className="toolbar"><strong>Edit content</strong><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Close</button></div>
    <textarea className="input" rows={8} value={body} onChange={(event) => setBody(event.target.value)} />
    <label>Authorized {row.platform} account
      <select className="input" value={socialAccountId} onChange={(event) => setSocialAccountId(event.target.value)}>
        <option value="">No account assigned</option>
        {matching.map((account) => <option value={account.id} key={account.id}>{account.handle} {account.posting_enabled ? '· posting enabled' : '· posting disabled'}</option>)}
      </select>
    </label>
    <label>Schedule
      <input className="input" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
    </label>
    <div className="sub">A scheduled item only enters the publish queue when its campaign is active and a matching authorized account is assigned.</div>
    {error && <div className="error">{error}</div>}
    <button className="btn">Save changes</button>
  </form>;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
