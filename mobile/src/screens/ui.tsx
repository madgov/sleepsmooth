import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const colors = { bg: '#F6F7F9', card: '#FFFFFF', text: '#14202B', sub: '#4B5A68', line: '#D5DCE3', accent: '#1F4E79', warn: '#8A5A00', warnBg: '#FFF4D6', bad: '#9B1C1C' };

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? (
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={[styles.v, bad ? { color: colors.bad } : null]}>{v}</Text>
    </View>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
  k: { color: colors.sub, fontSize: 14, flexShrink: 1 },
  v: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  notice: { backgroundColor: colors.warnBg, borderRadius: 10, padding: 10, marginBottom: 12 },
  noticeText: { color: colors.warn, fontSize: 13, lineHeight: 18 },
});
