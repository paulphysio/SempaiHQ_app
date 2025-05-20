import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 10001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
  },
  floatingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 50, // Circular button
    backgroundColor: '#F36316', // Fallback
  },
  floatingButtonText: {
    color: '#FFF',
    fontSize: 10, // Small text
    fontWeight: '600',
    marginLeft: 6,
  },
  panelContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 300, // Compact panel width
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 15,
    zIndex: 10000,
    backgroundColor: '#1A1A1A', // Fallback
  },
  panelGradient: {
    flex: 1,
    padding: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeButton: {
    alignSelf: 'center',
    borderRadius: 25,
    overflow: 'visible',
    zIndex: 10001,
    marginBottom: 8,
  },
  closeButtonGradient: {
    padding: 8,
    borderRadius: 25,
    backgroundColor: '#F36316', // Fallback
  },
  panelContent: {
    flex: 1,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#F36316',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFF',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonGradient: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  placeholderContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 10001,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
  },
  placeholderButton: {
    padding: 10,
    borderRadius: 50,
    backgroundColor: '#F36316', // Fallback
  },
});