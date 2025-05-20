import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const scale = (size) => {
  if (width <= 480) return size * 0.6;
  if (width <= 768) return size * 0.8;
  return size;
};

export const styles = StyleSheet.create({
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  energyField: {
    width: scale(200),
    height: scale(200),
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrapper: {
    position: 'relative',
    zIndex: 2,
  },
  logo: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    borderWidth: 3,
    borderColor: 'rgba(243, 99, 22, 0.8)',
    shadowColor: '#F36316',
    shadowOffset: { width: 0, height: 0 },
  },
  logoGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: scale(150),
    height: scale(150),
    zIndex: 1,
  },
  gradientGlow: {
    width: '100%',
    height: '100%',
    borderRadius: scale(75),
  },
  particleSwarm: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    width: scale(4),
    height: scale(4),
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    borderRadius: scale(2),
  },
  loadingBarWrapper: {
    width: scale(200),
    height: 4,
    backgroundColor: 'rgba(243, 99, 22, 0.2)',
    borderRadius: 2,
    marginVertical: 20,
    overflow: 'hidden',
  },
  loadingBar: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
  },
  loadingText: {
    fontSize: scale(19.2), // 1.2rem * 16
    fontWeight: '300',
    color: 'rgba(243, 99, 22, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
  },
});