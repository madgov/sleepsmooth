import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CaptureScreen } from './CaptureScreen';
import { ModelCheckScreen } from './ModelCheckScreen';
import { colors } from './ui';

type Tab = 'model' | 'capture';

/** The former App.tsx, unchanged in behavior: M0 model timing and M1 locked-screen capture spike. Developer tool, not product UI. */
export function LabScreens() {
  const [tab, setTab] = useState<Tab>('model');
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Text style={styles.title} accessibilityRole="header">
        SleepSmooth overnight: device lab
      </Text>
      <View style={styles.tabs}>
        {(['model', 'capture'] as const).map((t) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'model' ? 'M0 Model on device' : 'M1 Capture spike'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.body}>{tab === 'model' ? <ModelCheckScreen /> : <CaptureScreen />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, paddingHorizontal: 16, paddingTop: 8 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  tabOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { color: colors.text, fontSize: 13 },
  tabTextOn: { color: '#fff', fontWeight: '700' },
  body: { flex: 1 },
});
