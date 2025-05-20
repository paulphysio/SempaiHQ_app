import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1B2A', // Fallback for gradient
  },
  content: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(44, 44, 44, 0.3)', // Subtle dark overlay
    borderRadius: 15,
    shadowColor: '#F36316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  logo: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    borderWidth: 3,
    borderColor: '#F36316',
    marginBottom: 20,
    shadowColor: '#F36316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: width <= 480 ? 28 : 32,
    fontWeight: '700',
    color: '#F36316',
    textAlign: 'center',
    textShadowColor: 'rgba(243, 99, 22, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: width <= 480 ? 16 : 18,
    color: '#E0E0E0', // Light gray for contrast on dark background
    textAlign: 'center',
    marginTop: 10,
    textShadowColor: 'rgba(243, 99, 22, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});