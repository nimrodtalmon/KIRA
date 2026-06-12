import React from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppState } from '../AppState';
import { colors, fonts, type as T } from '../theme';
import { FilterMode } from '../types';

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'הכול' },
  { key: 'original', label: 'מקור עברי' },
  { key: 'translated', label: 'מתורגם' },
];

export default function SettingsScreen() {
  const { settings, setSettings } = useAppState();

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <Text style={styles.header}>הגדרות</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>ניקוד</Text>
        <Switch
          value={settings.nikkud}
          onValueChange={(v) => setSettings({ nikkud: v })}
          trackColor={{ true: colors.accent, false: colors.line }}
          thumbColor={colors.card}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockLabel}>סינון</Text>
        <View style={styles.segment}>
          {FILTERS.map((f) => {
            const active = settings.filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setSettings({ filter: f.key })}
                style={[styles.segBtn, active && styles.segBtnOn]}
              >
                <Text style={[styles.segTxt, active && styles.segTxtOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.about}>
        <Text style={styles.aboutTitle}>על האפליקציה</Text>
        <Text style={styles.aboutTxt}>
          פיד שקט של שירה עברית ושירה מתורגמת לעברית — נחלת הכלל. כל השירים מתוך
          מיזם בן-יהודה.
        </Text>
        <Pressable onPress={() => Linking.openURL('https://benyehuda.org')}>
          <Text style={styles.link}>benyehuda.org ↗</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 22 },
  header: {
    fontFamily: fonts.serif,
    fontSize: T.title,
    color: colors.ink,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLabel: { fontSize: 18, color: colors.ink, writingDirection: 'rtl' },
  block: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  blockLabel: { fontSize: 18, color: colors.ink, writingDirection: 'rtl', marginBottom: 12, textAlign: 'right' },
  segment: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.bgDeep,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 7, alignItems: 'center' },
  segBtnOn: { backgroundColor: colors.card },
  segTxt: { fontSize: T.meta, color: colors.inkSoft, writingDirection: 'rtl' },
  segTxtOn: { color: colors.ink, fontWeight: '600' },
  about: { paddingVertical: 24 },
  aboutTitle: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 8,
  },
  aboutTxt: { fontSize: T.meta, color: colors.inkSoft, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  link: { fontSize: T.meta, color: colors.accent, marginTop: 12, textAlign: 'right', writingDirection: 'rtl' },
});
