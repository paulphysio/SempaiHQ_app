import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { styles, KA_COLORS } from '../../styles/KaitoAdventureStyles';

const getWeatherIcon = (type) => {
  switch ((type || '').toLowerCase()) {
    case 'rainy':
      return <Icon name="cloud-rain" size={16} color={KA_COLORS.orangeSoft} />;
    case 'foggy':
      return <Icon name="smog" size={16} color={KA_COLORS.orangeSoft} />;
    case 'sunny':
    default:
      return <Icon name="cloud-sun" size={16} color={KA_COLORS.orangeSoft} />;
  }
};

const TownInfo = ({ currentTown, townLevels, weather, currentEvent, eventTimer, formatCountdown }) => {
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  useEffect(() => {
    if (!eventTimer) {
      setRemainingSeconds(null);
      return;
    }

    const tick = () => {
      const next = Math.max(0, Math.floor((eventTimer - Date.now()) / 1000));
      setRemainingSeconds(next);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [eventTimer]);

  return (
    <View style={townInfoStyles.townBanner}>
      <View style={townInfoStyles.townHeader}>
        <View style={townInfoStyles.townNameContainer}>
          <Text style={townInfoStyles.townName}>{currentTown}</Text>
          <Text style={townInfoStyles.townLevel}>Lv {townLevels[currentTown]}</Text>
        </View>

        <View style={townInfoStyles.weatherBadge}>
          {getWeatherIcon(weather?.type)}
          <Text style={townInfoStyles.weatherText}>{weather?.type?.toUpperCase()}</Text>
        </View>
      </View>

      {currentEvent && (
        <View style={townInfoStyles.eventBanner}>
          <Text style={townInfoStyles.eventLabel}>EVENT</Text>
          <Text style={townInfoStyles.eventDescription}>{currentEvent.description}</Text>
          {eventTimer ? (
            <Text style={townInfoStyles.eventTimer}>
              {remainingSeconds === null ? '--:--' : formatCountdown(remainingSeconds)}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

const townInfoStyles = StyleSheet.create({
  townBanner: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderTopWidth: 2,
    borderTopColor: KA_COLORS.orangeDim,
    padding: 12,
  },
  townHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  townNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  townName: {
    fontSize: 18,
    
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },
  townLevel: {
    fontSize: 12,
    color: KA_COLORS.textMuted,
    backgroundColor: KA_COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    fontSize: 12,
    color: KA_COLORS.ivoryDim,
    letterSpacing: 2,
  },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    borderLeftWidth: 2,
    borderLeftColor: KA_COLORS.redAccent,
    marginTop: 8,
  },
  eventLabel: {
    
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 12,
    color: KA_COLORS.redAccent,
  },
  eventDescription: {
    color: KA_COLORS.ivory,
    fontSize: 13,
  },
  eventTimer: {
    marginLeft: 'auto',
    color: '#e08a96',
    fontSize: 13,
  },
});

export default TownInfo;
