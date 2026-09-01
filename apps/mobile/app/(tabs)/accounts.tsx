import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '../../lib/auth';
import { Button, Screen, s } from '../../components/ui';
import { theme } from '../../lib/theme';

export default function Page() {
  const { api } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const load = () => api('/social-accounts').then(setRows);
  useEffect(() => { load().catch(() => {}); }, []);
  return <Screen title="Accounts" subtitle="Emergency posting controls">
    <ScrollView>
      {rows.map((row) => <View style={s.card} key={row.id}>
        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 17 }}>{row.handle}</Text>
        <Text style={{ color: theme.muted, marginVertical: 8 }}>{String(row.platform).toUpperCase()} · {row.status}</Text>
        <Text style={{ color: row.posting_enabled ? theme.good : theme.muted, marginBottom: 12 }}>
          Posting {row.posting_enabled ? 'enabled' : 'disabled'}
        </Text>
        <Button
          title={row.posting_enabled ? 'Disable posting' : 'Enable posting'}
          secondary={row.posting_enabled}
          onPress={async () => {
            await api(`/social-accounts/${row.id}/posting`, { method: 'PATCH', body: JSON.stringify({ enabled: !row.posting_enabled }) });
            await load();
          }}
        />
      </View>)}
    </ScrollView>
  </Screen>;
}
