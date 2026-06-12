import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';

import { useAppState } from '../AppState';
import PoemCard from '../components/PoemCard';
import { buildInitialDeck, extendDeck } from '../data/corpus';
import { colors } from '../theme';
import { Poem } from '../types';

export default function FeedScreen() {
  const { poems, settings, savedIds, getSeen, markSeen, toggleSaved } = useAppState();
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const [height, setHeight] = useState(0);
  const [deck, setDeck] = useState<Poem[]>([]);
  const listRef = useRef<FlatList<Poem>>(null);

  // (Re)build the deck whenever the corpus or the active filter changes.
  useEffect(() => {
    if (!poems.length) return;
    setDeck(buildInitialDeck(poems, settings.filter, getSeen()));
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [poems, settings.filter, getSeen]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setHeight(e.nativeEvent.layout.height);
  }, []);

  const onEndReached = useCallback(() => {
    setDeck((prev) => (prev.length ? extendDeck(prev, poems, settings.filter) : prev));
  }, [poems, settings.filter]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.item as Poem | undefined;
      if (first) markSeen(first.id);
    },
  ).current;

  const renderItem = useCallback(
    ({ item }: { item: Poem }) => (
      <PoemCard
        poem={item}
        height={height}
        nikkud={settings.nikkud}
        saved={savedSet.has(item.id)}
        onToggleSave={() => toggleSaved(item.id)}
      />
    ),
    [height, settings.nikkud, savedSet, toggleSaved],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<Poem> | null | undefined, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  const empty = useMemo(
    () => deck.length === 0 && poems.length > 0,
    [deck.length, poems.length],
  );

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {height > 0 && deck.length > 0 && (
        <FlatList
          ref={listRef}
          data={deck}
          extraData={savedSet}
          keyExtractor={(item, i) => `${item.id}:${i}`}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={1.5}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews
        />
      )}
      {empty && (
        <View style={styles.center}>
          <Text style={styles.emptyTxt}>אין שירים בסינון הזה.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTxt: { color: colors.inkSoft, fontSize: 18, writingDirection: 'rtl' },
});
