import { Tabs } from 'expo-router';
import { theme } from '../../lib/theme';
export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: theme.panel, borderTopColor: theme.line }, tabBarActiveTintColor: theme.accent, tabBarInactiveTintColor: theme.muted }}>
    <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
    <Tabs.Screen name="campaigns" options={{ title: 'Campaigns' }} />
    <Tabs.Screen name="queue" options={{ title: 'Queue' }} />
    <Tabs.Screen name="agents" options={{ title: 'Agents' }} />
    <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
  </Tabs>;
}
