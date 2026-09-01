'use client';
import Shell from '../../components/Shell';
import ListPage from '../../components/ListPage';
import EditContent from '../../components/EditContent';
import { api } from '../../lib/api';

export default function Page() {
  return <Shell title="Content Queue" subtitle="Human approvals remain explicit for material or higher-risk content.">
    <ListPage
      endpoint="/content"
      columns={[
        { key: 'platform', label: 'Platform' },
        { key: 'campaign_name', label: 'Campaign' },
        { key: 'body', label: 'Post', render: (value) => <div style={{ maxWidth: 620, whiteSpace: 'pre-wrap' }}>{value}</div> },
        { key: 'status', label: 'Status', render: (value) => <span className="badge">{value}</span> },
        { key: 'scheduled_at', label: 'Scheduled', render: (value) => value ? new Date(value).toLocaleString() : '—' },
      ]}
      actions={(row, reload) => <div className="toolbar">
        {!['publishing', 'published'].includes(row.status) && <EditContent row={row} onSaved={reload} />}
        {row.status === 'pending_approval' && <>
          <button className="btn" onClick={async () => { await api(`/content/${row.id}/approve`, { method: 'POST', body: JSON.stringify({ decision: 'approved' }) }); reload(); }}>Approve</button>
          <button className="btn secondary" onClick={async () => { await api(`/content/${row.id}/approve`, { method: 'POST', body: JSON.stringify({ decision: 'rejected' }) }); reload(); }}>Reject</button>
        </>}
        {['approved', 'failed'].includes(row.status) && <button className="btn secondary" onClick={async () => { await api(`/content/${row.id}/publish`, { method: 'POST' }); reload(); }}>Publish</button>}
      </div>}
    />
  </Shell>;
}
