import React from 'react';
import { View, Text, Image, Animated, TouchableWithoutFeedback, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { styles, HOME_COLORS } from '../styles/HomeStyles';
import { EXPANDED_RECT } from '../utils/cardExpansion';

const { height: SCREEN_H } = Dimensions.get('window');

const CinematicCardOverlay = ({ expandedCard, progress, kenBurns, onClose, onReadNow }) => {
  if (!expandedCard) return null;
  const { item, type, origin } = expandedCard;

  const left = progress.interpolate({ inputRange: [0, 1], outputRange: [origin.x, EXPANDED_RECT.x] });
  const top = progress.interpolate({ inputRange: [0, 1], outputRange: [origin.y, EXPANDED_RECT.y] });
  const panelWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [origin.width, EXPANDED_RECT.width] });
  const panelHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [origin.height, EXPANDED_RECT.height] });
  const radius = progress.interpolate({ inputRange: [0, 1], outputRange: [16, 22] });

  const backdropOpacity = progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0.93] });

  // Letterbox bars stay flat until the panel is most of the way expanded,
  // then close in — like curtains settling after the shot has landed,
  // rather than moving in lockstep with the expansion.
  const letterboxHeight = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0, 0, SCREEN_H * 0.085],
  });

  // Text/CTA only reveal once the panel is essentially in place — the
  // expansion is its own beat, the content reveal is the next one.
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 0, 1] });
  const contentTranslate = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [18, 18, 0] });
  const chromeOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  const kenBurnsScale = kenBurns.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });

  const writer = item.writer?.name && item.writer.name !== 'Unknown' ? item.writer.name : null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 2000, elevation: 20 }]} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.cinematicBackdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.cinematicPanel,
          {
            left,
            top,
            width: panelWidth,
            height: panelHeight,
            borderRadius: radius,
            overflow: 'hidden',
          },
        ]}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={{ flex: 1 }}>
            <Animated.Image
              source={{ uri: item.image || 'https://via.placeholder.com/400x600' }}
              style={{ width: '100%', height: '100%', transform: [{ scale: kenBurnsScale }] }}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(11,11,20,0.55)', 'rgba(11,11,20,0.97)']}
              style={styles.cinematicGradient}
              pointerEvents="none"
            />

            <Animated.View style={[styles.cinematicHint, { opacity: chromeOpacity }]} pointerEvents="none">
              <FontAwesome5 name="hand-pointer" size={9} color="rgba(255,255,255,0.7)" />
              <Text style={styles.cinematicHintText}>Tap to close</Text>
            </Animated.View>

            <Animated.View style={{ opacity: chromeOpacity }}>
              <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.cinematicCloseButton}>
                  <FontAwesome5 name="times" size={15} color="#fff" />
                </View>
              </TouchableWithoutFeedback>
            </Animated.View>

            <Animated.View
              style={[
                styles.cinematicContent,
                { opacity: contentOpacity, transform: [{ translateY: contentTranslate }] },
              ]}
            >
              <View style={styles.cinematicBadgeRow}>
                <View style={styles.cinematicRatingPill}>
                  <FontAwesome5 name="star" size={10} color={HOME_COLORS.gold} />
                  <Text style={styles.cinematicRatingPillText}>{item.averageRating}</Text>
                </View>
                {item.isAdult && (
                  <View style={[styles.cinematicRankPill, { borderColor: HOME_COLORS.danger, backgroundColor: 'rgba(255,107,107,0.15)' }]}>
                    <Text style={[styles.cinematicRankPillText, { color: HOME_COLORS.danger }]}>18+</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cinematicTitle} numberOfLines={2}>{item.title}</Text>

              <View style={styles.cinematicMetaRow}>
                {writer && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <FontAwesome5 name="feather-alt" size={10} color={HOME_COLORS.accent} />
                    <Text style={styles.cinematicMetaText}>{writer}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <FontAwesome5 name="eye" size={10} color={HOME_COLORS.textMuted} />
                  <Text style={styles.cinematicMetaText}>{item.viewers} readers</Text>
                </View>
              </View>

              <View style={styles.cinematicSummaryScroll}>
                <Text style={styles.cinematicSummaryText} numberOfLines={6}>
                  {item.summary || 'No summary available yet — check back soon.'}
                </Text>
              </View>

              <TouchableWithoutFeedback onPress={onReadNow}>
                <View style={styles.cinematicCTA}>
                  <FontAwesome5 name={type === 'novel' ? 'book-open' : 'images'} size={13} color="#fff" />
                  <Text style={styles.cinematicCTAText}>{type === 'novel' ? 'Start Reading' : 'View Chapters'}</Text>
                </View>
              </TouchableWithoutFeedback>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.cinematicLetterbox, { top: 0, height: letterboxHeight }]} />
      <Animated.View pointerEvents="none" style={[styles.cinematicLetterbox, { bottom: 0, height: letterboxHeight }]} />
    </View>
  );
};

export default CinematicCardOverlay;