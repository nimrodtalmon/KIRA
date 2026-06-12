import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppState } from '../AppState';
import PoemCard from '../components/PoemCard';
import { colors, fonts, type as T } from '../theme';
import { Poem } from '../types';

export default function SavedScreen() {
  const { byId, savedIds, settings, isSaved, toggleSaved } = useAppState();
  const { height } = useWindowDimensions();
  const [openId, setOpenId] = useState<string | null>(null);

  const saved = useMemo(
    () => savedIds.map((id) => byId.get(id)).filter((p): p is Poem => !!p),
    [savedIds, byId],
  );

  const open = openId ? byId.get(openId) : null;
  if (open) {
    return (
      <View style={styles.fill}>
        <PoemCard
          poem={open}
          height={height}
          nikkud={settings.nikkud}
          saved={isSaved(open.id)}
          onToggleSave={() => toggleSaved(open.id)}
        />
        <SafeAreaView edges={['top']} style={styles.closeWrap}>
          <Pressable onPress={() => setOpenId(null)} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕ סגירה</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <Text style={styles.header}>שמורים</Text>
      {saved.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTxt}>עוד לא שמרת שירים.</Text>
          <Text style={styles.emptyHint}>לבך על שיר בפיד יוסיף אותו לכאן.</Text>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.listPad}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setOpenId(item.id)}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowAuthor} numberOfLines={1}>
                {item.author}
                {item.is_translation ? ' · מתורגם' : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  header: {
    fontFamily: fonts.serif,
    fontSize: T.title,
    color: colors.ink,
    textAlign: 'center',
    writingDirection: 'rtl',
    paddingVertical: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTxt: { color: colors.inkSoft, fontSize: 18, writingDirection: 'rtl' },
  emptyHint: { color: colors.inkFaint, fontSize: 14, writingDirection: 'rtl' },
  listPad: { paddingHorizontal: 22, paddingBottom: 24 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowTitle: {
    fontFamily: fonts.serif,
    fontSize: 19,
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowAuthor: {
    fontSize: T.meta,
    color: colors.inkSoft,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  closeWrap: { position: 'absolute', top: 0, right: 0, left: 0 },
  closeBtn: { alignSelf: 'flex-start', padding: 16 },
  closeTxt: { color: colors.accent, fontSize: T.meta, writingDirection: 'rtl' },
});
