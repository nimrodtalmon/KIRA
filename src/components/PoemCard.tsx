import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fonts, type as T } from '../theme';
import { Poem } from '../types';

type Props = {
  poem: Poem;
  height: number;
  nikkud: boolean;
  saved: boolean;
  onToggleSave: () => void;
};

// Map original-language codes to a Hebrew label for the "translated from" line.
const LANG_HE: Record<string, string> = {
  de: 'גרמנית',
  ru: 'רוסית',
  en: 'אנגלית',
  fr: 'צרפתית',
  la: 'לטינית',
  yi: 'יידיש',
  grc: 'יוונית עתיקה',
  pl: 'פולנית',
  ar: 'ערבית',
  da: 'דנית',
  no: 'נורווגית',
  it: 'איטלקית',
  es: 'ספרדית',
  hu: 'הונגרית',
};

/** Bigger type for short poems, smaller for long ones — fit one screen. */
function bodyFontSize(lines: number): number {
  if (lines <= 6) return 25;
  if (lines <= 12) return 22;
  if (lines <= 20) return 19;
  if (lines <= 32) return 17;
  return 15;
}

export default function PoemCard({ poem, height, nikkud, saved, onToggleSave }: Props) {
  const [overflow, setOverflow] = useState(false);
  const [viewH, setViewH] = useState(0);

  const body = (nikkud ? poem.body_nikkud : poem.body_plain) || poem.body_plain;
  const fontSize = bodyFontSize(poem.length_lines);
  const lineHeight = Math.round(fontSize * 1.7);

  const translatedFrom = poem.is_translation
    ? (poem.original_language && LANG_HE[poem.original_language]) || null
    : null;

  const onShare = () => {
    const text = `${poem.title}\n${poem.author}\n\n${poem.body_plain}\n\n— מתוך מיזם בן-יהודה\n${poem.source_url}`;
    void Share.share({ message: text });
  };

  return (
    <View style={[styles.page, { height }]}>
      <View
        style={styles.inner}
        onLayout={(e) => setViewH(e.nativeEvent.layout.height)}
      >
        <Text style={styles.title} numberOfLines={3}>
          {poem.title}
        </Text>

        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          scrollEnabled={overflow}
          showsVerticalScrollIndicator={overflow}
          onContentSizeChange={(_w, h) => setOverflow(h > viewH * 0.72)}
        >
          <Text style={[styles.body, { fontSize, lineHeight }]} selectable>
            {body}
          </Text>
        </ScrollView>

        <View style={styles.byline}>
          <Text style={styles.author}>{poem.author}</Text>
          {poem.is_translation && (
            <Text style={styles.trans}>
              {translatedFrom ? `מתורגם מ${translatedFrom}` : 'מתורגם'}
              {poem.translator ? ` · תרגום: ${poem.translator}` : ''}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onToggleSave}
          hitSlop={14}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'הסר מהשמורים' : 'שמירה'}
        >
          <Text style={[styles.heart, saved && styles.heartOn]}>{saved ? '♥' : '♡'}</Text>
        </Pressable>
        <Pressable onPress={onShare} hitSlop={14} style={styles.actionBtn} accessibilityLabel="שיתוף">
          <Text style={styles.actionTxt}>שיתוף</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(poem.source_url)}
          hitSlop={14}
          style={styles.actionBtn}
          accessibilityLabel="מקור"
        >
          <Text style={styles.actionTxt}>מקור</Text>
        </Pressable>
      </View>
    </View>
  );
}

const serif = { fontFamily: fonts.serif } as const;

const styles = StyleSheet.create({
  page: {
    width: '100%',
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 64,
    paddingBottom: 8,
  },
  title: {
    ...serif,
    fontSize: T.title,
    color: colors.ink,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 22,
  },
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  body: {
    ...serif,
    color: colors.ink,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  byline: {
    marginTop: 24,
    alignItems: 'center',
  },
  author: {
    ...serif,
    fontSize: T.meta,
    color: colors.inkSoft,
    writingDirection: 'rtl',
  },
  trans: {
    fontSize: T.small,
    color: colors.inkFaint,
    marginTop: 4,
    writingDirection: 'rtl',
  },
  actions: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
    paddingBottom: 28,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  actionTxt: {
    fontSize: T.meta,
    color: colors.accent,
    writingDirection: 'rtl',
  },
  heart: {
    fontSize: 26,
    color: colors.inkFaint,
    lineHeight: 28,
  },
  heartOn: {
    color: colors.heart,
  },
});
