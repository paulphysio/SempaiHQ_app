import React from 'react';
import { View, Text, Image, Pressable, TextInput, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import GelOrb from '../nav/GelOrb';
import { coverSource, radius, space } from '../../theme/tokens';
import { STATUS, formatCount } from '../detail/DetailKit';
import { BOTTOM_NAV_CLEARANCE } from '../GlobalBottomNav';

/*
 * PageKit — the Home / Detail design language as drop-in building blocks.
 * Every piece styles itself from the theme, so a screen only composes:
 *
 *   <Page scroll refreshControl={…}>
 *     <PageHeader title="Hoard" subtitle="…" />
 *     <SearchField … />  <ChipRow … />
 *     <SectionHeader title="All novels" count={n} />
 *     <PosterGrid items={…} onOpen={…} />
 *   </Page>
 */
const { width: SCREEN_W } = Dimensions.get('window');
export const GUTTER = space.lg;
export const PAGE_BOTTOM = BOTTOM_NAV_CLEARANCE + 32;

const cache = {};
const getStyles = (c, isDark) => {
  const key = isDark ? 'dark' : 'light';
  if (cache[key]?.c === c) return cache[key].s;
  const s = StyleSheet.create({
    page: { flex: 1, backgroundColor: c.bg },
    glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
    scroll: { paddingHorizontal: GUTTER, paddingTop: GUTTER, paddingBottom: PAGE_BOTTOM },

    // header
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
    headerBack: { marginLeft: -8 },
    headerText: { flex: 1 },
    eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: c.accent, marginBottom: 2 },
    title: { fontFamily: 'Yoruka', fontSize: 30, lineHeight: 35, color: c.textPrimary, letterSpacing: 0.3 },
    subtitle: { fontSize: 14, lineHeight: 20, color: c.textSecondary, marginTop: 2 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },

    // section
    sectionHead: { flexDirection: 'row', alignItems: 'center', marginTop: space.xxl, marginBottom: space.md, gap: 8 },
    sectionTitle: { fontFamily: 'Yoruka', fontSize: 21, color: c.textPrimary, letterSpacing: 0.3 },
    countChip: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
    countText: { fontSize: 12, fontWeight: '800', color: c.accent },
    seeAll: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
    seeAllText: { fontSize: 13, fontWeight: '700', color: c.accent },

    // search
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    searchInput: { flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 0 },

    // chips
    chipRow: { gap: 8, paddingHorizontal: GUTTER, paddingVertical: 2 },
    chip: {
      height: 34,
      paddingHorizontal: 14,
      borderRadius: 17,
      justifyContent: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: { borderColor: c.accent },
    chipText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    chipTextActive: { color: '#FFFFFF' },

    // poster
    poster: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.bgCardAlt, borderWidth: 1, borderColor: c.border },
    fill: { width: '100%', height: '100%' },
    posterShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
    posterTop: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' },
    posterRating: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    posterRatingText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    posterTitle: { fontSize: 14, fontWeight: '700', color: c.textPrimary, marginTop: 10 },
    posterMeta: { fontSize: 12, color: c.textMuted, marginTop: 3 },
    progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.18)' },
    progressFill: { height: '100%', backgroundColor: c.accent },
    overlayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.overlayChip,
      borderWidth: 1,
    },
    overlayChipText: { fontSize: 10, fontWeight: '800' },
    dot: { width: 5, height: 5, borderRadius: 3 },
    adult: { paddingHorizontal: 6, height: 20, borderRadius: 6, justifyContent: 'center', backgroundColor: c.danger },
    adultText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.lg },

    // card
    card: { borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgCard, padding: space.lg, overflow: 'hidden' },
  });
  cache[key] = { c, s };
  return s;
};

export const useKit = () => {
  const { colors, isDark } = useTheme();
  return { styles: getStyles(colors, isDark), colors, isDark };
};

/* ───────────── page shell: bg + ember glow (+ optional scroll) ───────────── */
export const Page = ({ children, scroll = false, refreshControl, contentStyle, style, scrollRef, onScroll }) => {
  const { styles, colors, isDark } = useKit();
  return (
    <View style={[styles.page, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(${colors.accentRgb},${isDark ? 0.14 : 0.08})`, 'rgba(0,0,0,0)']}
        style={styles.glow}
      />
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 16 : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
};

/* ───────────── header: [back] eyebrow / title / subtitle  [right] ───────────── */
export const PageHeader = ({ eyebrow, title, subtitle, right, back = 'auto', style }) => {
  const { styles } = useKit();
  const navigation = useNavigation();
  const showBack = back === true || (back === 'auto' && navigation.canGoBack());
  return (
    <View style={[styles.header, style]}>
      {showBack ? (
        <View style={styles.headerBack}>
          <GelOrb icon="arrow-left" size={38} onPress={() => navigation.goBack()} label="Go back" breathe={false} />
        </View>
      ) : null}
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
};

/* ───────────── section header ───────────── */
export const SectionHeader = ({ title, count, action, onAction, style }) => {
  const { styles, colors } = useKit();
  return (
    <View style={[styles.sectionHead, style]}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {typeof count === 'number' ? (
        <View style={styles.countChip}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} style={styles.seeAll} accessibilityRole="link" accessibilityLabel={`${action}: ${title}`}>
          <Text style={styles.seeAllText}>{action}</Text>
          <FontAwesome5 name="chevron-right" size={10} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
};

/* ───────────── search ───────────── */
export const SearchField = ({ value, onChangeText, placeholder = 'Search', style }) => {
  const { styles, colors } = useKit();
  return (
    <View style={[styles.search, style]}>
      <FontAwesome5 name="search" size={14} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        style={styles.searchInput}
        returnKeyType="search"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
          <FontAwesome5 name="times-circle" size={16} color={colors.textMuted} solid />
        </Pressable>
      ) : null}
    </View>
  );
};

/* ───────────── filter chips (horizontal, full-bleed) ───────────── */
/** options: [{ value, label }]; selected: array of values */
export const ChipRow = ({ options, selected = [], onToggle, onClear, style }) => {
  const { styles, colors } = useKit();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ marginHorizontal: -GUTTER, marginTop: space.md }, style]}
      contentContainerStyle={styles.chipRow}
    >
      {selected.length && onClear ? (
        <Pressable onPress={onClear} style={[styles.chip, { borderColor: colors.danger }]} accessibilityRole="button" accessibilityLabel="Clear filters">
          <FontAwesome5 name="times" size={11} color={colors.danger} />
          <Text style={[styles.chipText, { color: colors.danger }]}>Clear</Text>
        </Pressable>
      ) : null}
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onToggle(o.value)}
            style={[styles.chip, on && styles.chipActive, { overflow: 'hidden' }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            {on ? (
              <LinearGradient
                colors={[colors.accentHi, colors.accent, colors.accentDeep]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text style={[styles.chipText, on && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

/* ───────────── poster ───────────── */
export const StatusChip = ({ status }) => {
  const { styles, colors } = useKit();
  const s = STATUS[status];
  if (!s) return null;
  const c = colors[s.key];
  return (
    <View style={[styles.overlayChip, { borderColor: `${c}88` }]}>
      <View style={[styles.dot, { backgroundColor: c }]} />
      <Text style={[styles.overlayChipText, { color: c }]}>{s.label}</Text>
    </View>
  );
};

/**
 * item: { id, kind, title, image, author, status, views, rating, isAdult, progress? }
 */
export const PosterCard = React.memo(({ item, width = 128, onOpen }) => {
  const { styles, colors } = useKit();
  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={({ pressed }) => [{ width }, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.author ? ` by ${item.author}` : ''}`}
    >
      <View style={[styles.poster, { width, height: width * 1.5 }]}>
        <Image source={coverSource(item.image)} style={styles.fill} resizeMode="cover" />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={styles.posterShade} />
        <View style={styles.posterTop}>
          {item.badge ? (
            <View style={[styles.overlayChip, { borderColor: `${item.badge.color || colors.accent}88` }]}>
              <Text style={[styles.overlayChipText, { color: item.badge.color || colors.accent }]}>{item.badge.label}</Text>
            </View>
          ) : (
            <StatusChip status={item.status} />
          )}
          {item.isAdult ? (
            <View style={styles.adult}>
              <Text style={styles.adultText}>18+</Text>
            </View>
          ) : null}
        </View>
        {Number(item.rating) > 0 ? (
          <View style={styles.posterRating}>
            <FontAwesome5 name="star" size={9} color={colors.gold} solid />
            <Text style={styles.posterRatingText}>{Number(item.rating).toFixed(1)}</Text>
          </View>
        ) : null}
        {typeof item.progress === 'number' ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, item.progress))}%` }]} />
          </View>
        ) : null}
      </View>
      <Text style={styles.posterTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.posterMeta} numberOfLines={1}>
        {item.meta || (item.author ? `by ${item.author}` : `${formatCount(item.views)} views`)}
      </Text>
    </Pressable>
  );
});
PosterCard.displayName = 'PosterCard';

/** Two-column (phone) / three / four-column (tablet) poster grid. */
export const posterColumnWidth = (cols) => (SCREEN_W - GUTTER * 2 - space.md * (cols - 1)) / cols;
export const gridColumns = SCREEN_W >= 1024 ? 4 : SCREEN_W >= 768 ? 3 : 2;

export const PosterGrid = ({ items, onOpen }) => {
  const { styles } = useKit();
  const w = posterColumnWidth(gridColumns);
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <PosterCard key={`${item.kind}-${item.id}`} item={item} width={w} onOpen={onOpen} />
      ))}
    </View>
  );
};

/* ───────────── form pieces ───────────── */
export const Field = ({ label, hint, counter, children, style }) => {
  const { colors } = useKit();
  return (
    <View style={[{ marginTop: space.lg }, style]}>
      {label || counter ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {label ? (
            <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted }}>{label}</Text>
          ) : <View />}
          {counter ? <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>{counter}</Text> : null}
        </View>
      ) : null}
      {children}
      {hint ? <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 6 }}>{hint}</Text> : null}
    </View>
  );
};

export const TextField = React.forwardRef(({ multiline, minHeight = 120, style, onFocus, onBlur, ...props }, ref) => {
  const { colors } = useKit();
  const [focus, setFocus] = React.useState(false);
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.accent}
      onFocus={(e) => { setFocus(true); onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); onBlur?.(e); }}
      style={[
        {
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: focus ? colors.accent : colors.borderStrong,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          height: multiline ? undefined : 48,
          minHeight: multiline ? minHeight : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
          fontSize: 15,
          lineHeight: multiline ? 22 : undefined,
          color: colors.textPrimary,
        },
        style,
      ]}
      {...props}
    />
  );
});
TextField.displayName = 'TextField';

export const StatTile = ({ icon, label, value, tone }) => {
  const { styles, colors } = useKit();
  const c = tone || colors.accent;
  return (
    <View style={[styles.card, { flex: 1, padding: space.md }]}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: `${c}22` }}>
        <FontAwesome5 name={icon} size={12} color={c} solid />
      </View>
      <Text style={{ fontFamily: 'Yoruka', fontSize: 22, color: colors.textPrimary, marginTop: 8 }} numberOfLines={1}>{value}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }} numberOfLines={1}>{label}</Text>
    </View>
  );
};

/** options: [{ value, label, icon? }] */
export const Segmented = ({ options, value, onChange, style }) => {
  const { colors } = useKit();
  return (
    <View style={[{ flexDirection: 'row', gap: 6, padding: 4, borderRadius: 24, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderStrong }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            {on ? (
              <LinearGradient
                colors={[colors.accentHi, colors.accent, colors.accentDeep]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {o.icon ? <FontAwesome5 name={o.icon} size={11} color={on ? '#FFFFFF' : colors.textMuted} solid /> : null}
            <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#FFFFFF' : colors.textSecondary }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const Toggle = ({ value, onChange, label, sub, style }) => {
  const { colors } = useKit();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 }, style]}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
      accessibilityLabel={label}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
        {sub ? <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center', backgroundColor: value ? colors.accent : colors.surfaceTop, borderWidth: 1, borderColor: value ? colors.accent : colors.borderStrong }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignSelf: value ? 'flex-end' : 'flex-start' }} />
      </View>
    </Pressable>
  );
};

/* ───────────── plain card ───────────── */
export const Card = ({ children, style, tint }) => {
  const { styles, colors } = useKit();
  return (
    <View style={[styles.card, style]}>
      {tint ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`rgba(${colors.accentRgb},0.12)`, 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
};
