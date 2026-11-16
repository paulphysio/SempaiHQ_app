import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import GelOrb from '../nav/GelOrb';
import { coverSource, radius, space } from '../../theme/tokens';

/*
 * Shared "detail page" kit for Novel / Manga (and any future series page).
 * Geometry mirrors <ScreenSkeleton variant="detail" /> block for block, so the
 * page fills in its placeholder instead of jumping when data arrives:
 *
 *   banner 260 ─ cover 110×160 @ −70 + title/author ─ 2 × 44 actions
 *   ─ 4-line synopsis ─ section title ─ 44px-disc list rows
 */
const { width: SCREEN_W } = Dimensions.get('window');
export const GUTTER = space.lg; // 16 — same as the skeleton
const BANNER_H = 260;
const COVER_W = 110;
const COVER_H = 160;
const COVER_OVERLAP = 70;

export const formatCount = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(v);
};

export const STATUS = {
  ongoing: { label: 'Ongoing', key: 'success' },
  completed: { label: 'Completed', key: 'info' },
  hiatus: { label: 'Hiatus', key: 'warning' },
};

/* ───────────────────────── chapter row (44px disc + 2 lines + trailing) ── */
/**
 * state: 'resume' | 'free' | 'unlocked' | 'locked' | 'premium'
 */
export const ChapterRow = React.memo(({ number, title, state, resumePct = 0, badge, onPress, styles, colors }) => {
  const discLit = state === 'resume';
  const tint =
    state === 'locked' ? colors.textMuted
      : state === 'premium' ? colors.gold
      : state === 'free' ? colors.success
      : colors.accent;
  const label =
    state === 'resume' ? `Resume · ${Math.round(resumePct)}%`
      : state === 'free' ? 'Free'
      : state === 'locked' ? 'Locked'
      : state === 'premium' ? 'Premium'
      : 'Unlocked';
  const muted = state === 'locked';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Chapter ${number}, ${title}, ${label}`}
    >
      {discLit ? (
        <LinearGradient
          colors={[colors.accentHi, colors.accent, colors.accentDeep]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.disc, styles.discLit, { shadowColor: colors.accent }]}
        >
          <Text style={[styles.discText, { color: '#FFFFFF' }]}>{number}</Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.disc,
            {
              backgroundColor: muted ? colors.bgCardAlt : `${tint}1F`,
              borderColor: muted ? colors.border : `${tint}55`,
            },
          ]}
        >
          <Text style={[styles.discText, { color: muted ? colors.textMuted : tint }]}>{number}</Text>
        </View>
      )}

      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, muted && { color: colors.textSecondary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowSub, { color: discLit ? colors.accent : tint }]}>{label}</Text>
          {badge ? (
            <View style={[styles.rowBadge, { backgroundColor: `rgba(${colors.goldRgb},0.16)` }]}>
              <FontAwesome5 name={badge.icon || 'star'} size={8} color={colors.gold} solid />
              <Text style={[styles.rowBadgeText, { color: colors.gold }]}>{badge.label}</Text>
            </View>
          ) : null}
        </View>
        {discLit ? (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${resumePct}%`, backgroundColor: colors.accent }]} />
          </View>
        ) : null}
      </View>

      <View style={styles.rowTrail}>
        <FontAwesome5
          name={state === 'locked' || state === 'premium' ? 'lock' : 'chevron-right'}
          size={state === 'locked' || state === 'premium' ? 12 : 11}
          color={state === 'premium' ? colors.gold : muted ? colors.textMuted : colors.textSecondary}
          solid
        />
      </View>
    </Pressable>
  );
});
ChapterRow.displayName = 'ChapterRow';

/* ───────────────────────── action button (44px, half width) ──────────── */
export const ActionButton = ({ icon, label, lit, onPress, disabled, styles, colors, isDark, accessibilityLabel }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.action,
      lit && { shadowColor: colors.accent, ...styles.actionLitShadow },
      disabled && { opacity: 0.55 },
      pressed && { transform: [{ scale: 0.97 }] },
    ]}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || label}
    accessibilityState={{ disabled: !!disabled }}
  >
    <LinearGradient
      colors={lit ? [colors.accentHi, colors.accent, colors.accentDeep] : isDark ? ['rgba(255,255,255,0.08)', colors.bgCardAlt] : ['#FFFFFF', colors.bgCardAlt]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.actionFill}
    >
      <FontAwesome5 name={icon} size={14} color={lit ? '#FFFFFF' : colors.accent} solid />
      <Text style={[styles.actionText, { color: lit ? '#FFFFFF' : colors.textPrimary }]} numberOfLines={1}>{label}</Text>
    </LinearGradient>
    <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} style={styles.actionGloss} />
    <View pointerEvents="none" style={[styles.actionRim, { borderColor: lit ? 'rgba(255,255,255,0.35)' : colors.borderStrong }]} />
  </Pressable>
);

/* ───────────────────────── banner chip ───────────────────────────────── */
/** chip: { label, icon?, dot?, color?, onPress?, accessibilityLabel? } */
const BannerChip = ({ chip, styles, colors }) => {
  const color = chip.color || colors.textPrimary;
  const body = (
    <>
      {chip.dot ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      {chip.icon ? <FontAwesome5 name={chip.icon} size={9} color={color} solid /> : null}
      <Text style={[styles.chipText, { color }]}>{chip.label}</Text>
    </>
  );
  const style = [styles.chip, chip.color && { borderColor: `${chip.color}88` }];
  return chip.onPress ? (
    <Pressable onPress={chip.onPress} style={style} hitSlop={6} accessibilityRole="button" accessibilityLabel={chip.accessibilityLabel || chip.label}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
};

/* ───────────────────────── hero (everything above the rows) ──────────── */
/**
 * props:
 *   image, title, author: { name, icon?, onPress? }
 *   chips: BannerChip[]
 *   primary / secondary: { icon, label, onPress, disabled?, accessibilityLabel? }
 *   synopsis, more: { label, onPress }
 *   children: extra content between synopsis and the section title (tags, notices)
 *   section: { title, count, newestFirst, onToggleSort }
 *   onBack
 */
export const DetailHero = ({
  image,
  title,
  author,
  chips = [],
  primary,
  secondary,
  synopsis,
  more,
  children,
  section,
  onBack,
  styles,
  colors,
  isDark,
}) => (
  <View>
    {/* banner: blurred cover art fading into the page */}
    <View style={styles.banner}>
      <Image source={coverSource(image)} style={styles.bannerImage} blurRadius={18} resizeMode="cover" />
      <LinearGradient
        colors={[`rgba(${colors.accentRgb},${isDark ? 0.18 : 0.12})`, 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={isDark ? ['rgba(11,11,20,0.15)', 'rgba(11,11,20,0.55)', colors.bg] : ['rgba(253,251,212,0.10)', 'rgba(253,251,212,0.55)', colors.bg]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bannerTop}>
        {onBack ? <GelOrb icon="arrow-left" size={36} onPress={onBack} label="Go back" breathe={false} /> : <View />}
        <View style={styles.chips}>
          {chips.filter(Boolean).map((chip) => (
            <BannerChip key={chip.label} chip={chip} styles={styles} colors={colors} />
          ))}
        </View>
      </View>
    </View>

    <View style={styles.pad}>
      {/* cover + title/author, overlapping the banner */}
      <View style={styles.identity}>
        <View style={[styles.coverFrame, { shadowColor: '#000' }]}>
          <Image source={coverSource(image)} style={styles.cover} resizeMode="cover" />
        </View>
        <View style={styles.identityText}>
          <Text style={styles.title} numberOfLines={3}>{title}</Text>
          {author ? (
            author.onPress ? (
              <Pressable
                onPress={author.onPress}
                hitSlop={8}
                style={styles.authorRow}
                accessibilityRole="link"
                accessibilityLabel={`View ${author.name}'s profile`}
              >
                <Text style={styles.author} numberOfLines={1}>
                  by <Text style={styles.authorName}>{author.name}</Text>
                </Text>
                <FontAwesome5 name="chevron-right" size={9} color={colors.accent} />
              </Pressable>
            ) : (
              <Text style={[styles.author, styles.authorRow]} numberOfLines={1}>by {author.name}</Text>
            )
          ) : null}
        </View>
      </View>

      {/* two half-width actions */}
      {primary || secondary ? (
        <View style={styles.actions}>
          {primary ? <ActionButton lit {...primary} styles={styles} colors={colors} isDark={isDark} /> : null}
          {secondary ? <ActionButton {...secondary} styles={styles} colors={colors} isDark={isDark} /> : null}
        </View>
      ) : null}

      {/* synopsis */}
      {synopsis ? <Text style={styles.synopsis} numberOfLines={more?.expanded ? undefined : 4}>{synopsis}</Text> : null}
      {more ? (
        <Pressable onPress={more.onPress} hitSlop={8} style={styles.moreLink} accessibilityRole="link">
          <Text style={styles.moreText}>{more.label}</Text>
          <FontAwesome5 name={more.icon || 'arrow-right'} size={10} color={colors.accent} />
        </Pressable>
      ) : null}

      {children}

      {/* section title */}
      {section ? (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.countChip}>
            <Text style={styles.countText}>{section.count}</Text>
          </View>
          {section.count > 1 && section.onToggleSort ? (
            <Pressable
              onPress={section.onToggleSort}
              hitSlop={8}
              style={styles.sort}
              accessibilityRole="button"
              accessibilityLabel={section.newestFirst ? 'Sorted newest first. Tap for oldest first' : 'Sorted oldest first. Tap for newest first'}
            >
              <FontAwesome5 name={section.newestFirst ? 'sort-amount-down' : 'sort-amount-up'} size={12} color={colors.textSecondary} />
              <Text style={styles.sortText}>{section.newestFirst ? 'Newest' : 'Oldest'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  </View>
);

/* ───────────────────────── tags (pill chips) ─────────────────────────── */
export const TagRow = ({ tags = [], styles, colors }) =>
  tags.length ? (
    <View style={styles.tags}>
      {tags.map((tag) => {
        const adult = tag === 'Adult(18+)';
        const c = adult ? colors.danger : colors.accent;
        return (
          <View key={tag} style={[styles.tag, { backgroundColor: `${c}14`, borderColor: `${c}44` }]}>
            <Text style={[styles.tagText, { color: c }]}>{tag}</Text>
          </View>
        );
      })}
    </View>
  ) : null;

/* ───────────────────────── styles (geometry = ScreenSkeleton "detail") ── */
export const makeDetailStyles = (c, isDark) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.bg },
    center: { justifyContent: 'center' },
    pad: { paddingHorizontal: GUTTER },

    // banner — Block h=260 r=0
    banner: { width: SCREEN_W, height: BANNER_H, overflow: 'hidden', backgroundColor: c.bgCardAlt },
    bannerImage: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.15 }] },
    bannerTop: {
      position: 'absolute',
      top: space.md,
      left: GUTTER - 6,
      right: GUTTER,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    chips: { flexDirection: 'row', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.overlayChip,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    chipDot: { width: 6, height: 6, borderRadius: 3 },
    chipText: { fontSize: 11, fontWeight: '700', color: c.textPrimary },

    // identity row — marginTop −70, cover 110×160 with 3px bg border
    identity: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: -COVER_OVERLAP },
    coverFrame: {
      width: COVER_W,
      height: COVER_H,
      borderRadius: radius.md,
      borderWidth: 3,
      borderColor: c.bg,
      backgroundColor: c.bgCardAlt,
      overflow: 'hidden',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.6 : 0.25,
      shadowRadius: 16,
      elevation: 12,
    },
    cover: { width: '100%', height: '100%' },
    identityText: { flex: 1, paddingBottom: 4 },
    title: { fontFamily: 'Yoruka', fontSize: 24, lineHeight: 29, color: c.textPrimary, letterSpacing: 0.3 },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'flex-start' },
    author: { fontSize: 15, color: c.textSecondary },
    authorName: { color: c.accent, fontWeight: '700' },

    // actions — two 48% × 44 r16, mt16
    actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
    action: { flex: 1, height: 44, borderRadius: radius.lg, overflow: 'hidden' },
    actionLitShadow: { shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    actionFill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 10 },
    actionText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
    actionGloss: { position: 'absolute', top: 1, left: 12, right: 12, height: 18, borderRadius: radius.lg },
    actionRim: { ...StyleSheet.absoluteFillObject, borderRadius: radius.lg, borderWidth: 1 },

    // synopsis — 4 lines at mt10 cadence
    synopsis: { marginTop: 14, fontSize: 15, lineHeight: 22, color: c.textSecondary },
    moreLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, alignSelf: 'flex-start' },
    moreText: { fontSize: 14, fontWeight: '700', color: c.accent },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: space.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    noticeText: { fontSize: 13, fontWeight: '600' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
    tag: { paddingHorizontal: 10, height: 26, borderRadius: 13, borderWidth: 1, justifyContent: 'center' },
    tagText: { fontSize: 12, fontWeight: '700' },

    // section title — h18 at mt24
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.xxl, marginBottom: 4 },
    sectionTitle: { fontFamily: 'Yoruka', fontSize: 21, color: c.textPrimary, letterSpacing: 0.3 },
    countChip: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
    countText: { fontSize: 12, fontWeight: '800', color: c.accent },
    sort: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    sortText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },

    // rows — 44 disc + 2 lines + trailing, paddingV 12, hairline divider
    rowWrap: { paddingHorizontal: GUTTER },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowPressed: { opacity: 0.7 },
    disc: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    discLit: { borderWidth: 0, shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
    discText: { fontSize: 15, fontWeight: '800' },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    rowSub: { fontSize: 13, fontWeight: '600' },
    rowBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, height: 18, borderRadius: 9 },
    rowBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
    progressTrack: { height: 3, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    rowTrail: { width: 36, alignItems: 'flex-end' },

    sheetText: { fontSize: 15, lineHeight: 22, color: c.textSecondary },
    statRow: { flexDirection: 'row', gap: space.sm, paddingBottom: space.md },
  });
