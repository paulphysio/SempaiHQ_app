import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/tokens';

/**
 * Content-shaped loading placeholders. Each variant mirrors the layout of the
 * screen it stands in for, so content "fills in" instead of replacing a
 * spinner — which reads as faster even at the same load time.
 *
 *   if (loading) return <ScreenSkeleton variant="list" />;
 *
 * Variants: list · feed · grid · detail · reader · manga · dashboard
 *
 * One shared pulse drives every block on screen (cheap: a single native-driver
 * loop instead of one animation per placeholder).
 */
const PulseContext = createContext(null);

const { width: SCREEN_W } = Dimensions.get('window');
const GUTTER = space.lg;

export const Block = ({ w = '100%', h = 14, r = radius.sm, style }) => {
  const { colors } = useTheme();
  const pulse = useContext(PulseContext);
  return (
    <Animated.View
      style={[
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: colors.surfaceTop,
          opacity: pulse || 0.6,
        },
        style,
      ]}
    />
  );
};

const Row = ({ children, style }) => <View style={[styles.row, style]}>{children}</View>;

const ListItem = ({ colors }) => (
  <Row style={[styles.listItem, { borderBottomColor: colors.border }]}>
    <Block w={44} h={44} r={22} />
    <View style={styles.flex}>
      <Block w="55%" h={14} />
      <Block w="85%" h={12} style={styles.mt8} />
    </View>
    <Block w={36} h={12} />
  </Row>
);

const FeedPost = ({ colors }) => (
  <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
    <Row>
      <Block w={40} h={40} r={20} />
      <View style={styles.flex}>
        <Block w="40%" h={13} />
        <Block w="25%" h={11} style={styles.mt6} />
      </View>
    </Row>
    <Block w="95%" h={12} style={styles.mt16} />
    <Block w="80%" h={12} style={styles.mt8} />
    <Block h={180} r={radius.md} style={styles.mt16} />
  </View>
);

const posterW = (SCREEN_W - GUTTER * 2 - space.md) / 2;
const GridPoster = () => (
  <View style={{ width: posterW }}>
    <Block w={posterW} h={posterW * 1.5} r={radius.lg} />
    <Block w="75%" h={13} style={styles.mt10} />
    <Block w="45%" h={11} style={styles.mt6} />
  </View>
);

/* Home geometry — shared with screens/HomeScreen.js so content lands on its placeholder. */
export const HOME = {
  spotlightH: 300,
  railPosterW: 128,
  railPosterH: 192,
  continueW: 236,
  continueH: 96,
  tileH: 112,
};

const RailHeader = () => (
  <Row style={[styles.mt24, { justifyContent: 'space-between' }]}>
    <Block w="45%" h={20} r={6} />
    <Block w={52} h={12} />
  </Row>
);

const PosterRail = () => (
  <Row style={[styles.mt12, { gap: space.md, alignItems: 'flex-start' }]}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={{ width: HOME.railPosterW }}>
        <Block w={HOME.railPosterW} h={HOME.railPosterH} r={radius.lg} />
        <Block w="85%" h={13} style={styles.mt10} />
        <Block w="55%" h={11} style={styles.mt6} />
      </View>
    ))}
  </Row>
);

const VARIANTS = {
  /* Writer's Studio (Novel / Manga dashboards) */
  studio: ({ colors }) => (
    <View style={styles.pad}>
      <Block w="28%" h={10} />
      <Block w="62%" h={30} r={8} style={styles.mt8} />
      <Block w="80%" h={13} style={styles.mt8} />
      <Row style={[styles.mt24, { gap: space.md }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.tile, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Block w={30} h={30} r={15} />
            <Block w="55%" h={20} r={6} style={styles.mt8} />
            <Block w="70%" h={11} style={styles.mt6} />
          </View>
        ))}
      </Row>
      <RailHeader />
      <Row style={[styles.mt12, { gap: space.md }]}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.continueCard, { width: 260, height: 124, backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Block w={68} h={100} r={radius.sm} />
            <View style={styles.flex}>
              <Block w="85%" h={14} />
              <Block w="45%" h={11} style={styles.mt8} />
              <Row style={[styles.mt16, { gap: 8 }]}>
                <Block w={56} h={28} r={14} />
                <Block w={28} h={28} r={14} />
              </Row>
            </View>
          </View>
        ))}
      </Row>
      <RailHeader />
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 12 }]}>
        <Row style={{ alignItems: 'flex-start' }}>
          <Block w={110} h={160} r={radius.md} />
          <View style={styles.flex}>
            <Block w="40%" h={10} />
            <Block h={44} r={radius.md} style={styles.mt8} />
            <Block w="40%" h={10} style={styles.mt16} />
            <Block h={40} r={20} style={styles.mt8} />
          </View>
        </Row>
      </View>
    </View>
  ),
  home: ({ colors }) => (
    <View style={styles.pad}>
      <Block h={HOME.spotlightH} r={radius.xl} />
      <Row style={[styles.mt12, { justifyContent: 'center', gap: 6 }]}>
        <Block w={18} h={6} r={3} />
        <Block w={6} h={6} r={3} />
        <Block w={6} h={6} r={3} />
      </Row>
      <Row style={[styles.mt16, { gap: space.sm }]}>
        <Block w="48.5%" h={44} r={radius.lg} />
        <Block w="48.5%" h={44} r={radius.lg} />
      </Row>
      <RailHeader />
      <Row style={[styles.mt12, { gap: space.md }]}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.continueCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Block w={56} h={76} r={radius.sm} />
            <View style={styles.flex}>
              <Block w="85%" h={13} />
              <Block w="50%" h={11} style={styles.mt8} />
              <Block h={4} r={2} style={styles.mt12} />
            </View>
          </View>
        ))}
      </Row>
      <RailHeader />
      <PosterRail />
    </View>
  ),

  list: ({ colors }) => (
    <View style={styles.pad}>
      <Block w="45%" h={22} r={6} style={styles.mb16} />
      {Array.from({ length: 8 }, (_, i) => <ListItem key={i} colors={colors} />)}
    </View>
  ),
  feed: ({ colors }) => (
    <View style={styles.pad}>
      {Array.from({ length: 3 }, (_, i) => <FeedPost key={i} colors={colors} />)}
    </View>
  ),
  grid: () => (
    <View style={styles.pad}>
      <Block w="40%" h={22} r={6} />
      <Block h={44} r={radius.md} style={styles.mt16} />
      <Row style={[styles.mt16, { gap: space.sm }]}>
        {[64, 80, 56, 72].map((w, i) => <Block key={i} w={w} h={30} r={radius.pill} />)}
      </Row>
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => <GridPoster key={i} />)}
      </View>
    </View>
  ),
  detail: ({ colors }) => (
    <View>
      <Block h={260} r={0} />
      <View style={styles.pad}>
        <Row style={{ marginTop: -70, alignItems: 'flex-end' }}>
          <Block w={110} h={160} r={radius.md} style={{ borderWidth: 3, borderColor: colors.bg }} />
          <View style={styles.flex}>
            <Block w="85%" h={20} r={6} />
            <Block w="50%" h={13} style={styles.mt8} />
          </View>
        </Row>
        <Row style={[styles.mt16, { gap: space.sm }]}>
          <Block w="48%" h={44} r={radius.lg} />
          <Block w="48%" h={44} r={radius.lg} />
        </Row>
        {[100, 96, 92, 70].map((w, i) => <Block key={i} w={`${w}%`} h={12} style={styles.mt10} />)}
        <Block w="35%" h={18} r={6} style={styles.mt24} />
        {Array.from({ length: 4 }, (_, i) => <ListItem key={i} colors={colors} />)}
      </View>
    </View>
  ),
  /* Chapter reader — mirrors ChapterScreen: bar, progress, heading, toolbar, text */
  reader: ({ colors }) => (
    <View>
      <Row style={{ paddingHorizontal: 8, paddingVertical: 8, gap: 4, backgroundColor: colors.bgElevated }}>
        <Block w={38} h={38} r={19} style={{ marginHorizontal: 6 }} />
        <View style={styles.flex}>
          <Block w="35%" h={10} />
          <Block w="70%" h={14} style={styles.mt6} />
        </View>
        <Block w={38} h={38} r={19} style={{ marginHorizontal: 6 }} />
        <Block w={38} h={38} r={19} style={{ marginHorizontal: 6 }} />
      </Row>
      <Block h={2} r={0} />
      <View style={{ paddingHorizontal: 22 }}>
        <Block w="30%" h={10} style={{ marginTop: 20 }} />
        <Block w="78%" h={30} r={8} style={styles.mt10} />
        <Row style={[styles.mt12, { gap: 6 }]}>
          <Block w={96} h={26} r={13} />
          <Block w={110} h={26} r={13} />
        </Row>
        <Block h={48} r={24} style={styles.mt16} />
        <View style={{ marginTop: 18 }}>
          {[100, 97, 100, 93, 58, 0, 100, 96, 100, 89, 0, 98, 100, 92, 71].map((w, i) =>
            w === 0 ? <View key={i} style={{ height: 18 }} /> : <Block key={i} w={`${w}%`} h={15} style={styles.mt10} />
          )}
        </View>
      </View>
    </View>
  ),
  manga: () => (
    <View>
      {[1.4, 1.1, 1.5].map((ratio, i) => (
        <Block key={i} w={SCREEN_W} h={SCREEN_W * ratio} r={0} style={{ marginBottom: 4 }} />
      ))}
    </View>
  ),
  dashboard: ({ colors }) => (
    <View style={styles.pad}>
      <Block w="50%" h={22} r={6} />
      <Row style={[styles.mt16, { gap: space.md }]}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.tile, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Block w={30} h={30} r={10} />
            <Block w="60%" h={20} r={6} style={styles.mt10} />
            <Block w="40%" h={11} style={styles.mt6} />
          </View>
        ))}
      </Row>
      <Row style={[styles.mt12, { gap: space.md }]}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.tile, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Block w={30} h={30} r={10} />
            <Block w="60%" h={20} r={6} style={styles.mt10} />
            <Block w="40%" h={11} style={styles.mt6} />
          </View>
        ))}
      </Row>
      <Block h={200} r={radius.lg} style={styles.mt16} />
      {Array.from({ length: 3 }, (_, i) => <ListItem key={i} colors={colors} />)}
    </View>
  ),
};

const ScreenSkeleton = ({ variant = 'list', label = 'Loading', style, safeTop = false }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const Variant = VARIANTS[variant] || VARIANTS.list;
  return (
    <PulseContext.Provider value={pulse}>
      <View
        style={[styles.root, { backgroundColor: colors.bg, paddingTop: safeTop ? insets.top : 0 }, style]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
      >
        <Variant colors={colors} />
      </View>
    </PulseContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  pad: { padding: GUTTER },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  listItem: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  tile: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: space.md },
  continueCard: {
    width: 236,
    height: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt24: { marginTop: 24 },
  mb16: { marginBottom: 16 },
});

export default React.memo(ScreenSkeleton);
