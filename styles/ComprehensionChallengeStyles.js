import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '90%',
    maxWidth: 450,
    backgroundColor: '#0A0A18',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#9B59B6',
    shadowColor: '#9B59B6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    padding: 30,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  difficultyTitle: {
    fontSize: 28,
    
    color: '#FFFFFF',
    marginTop: 15,
    fontFamily: 'Yoruka',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  difficultySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 5,
    fontFamily: 'Yoruka',
  },
  content: {
    padding: 25,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 15,
    fontFamily: 'Yoruka',
  },
  questionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  questionText: {
    fontSize: 18,
    color: '#FFFFFF',
    marginLeft: 15,
    flex: 1,
    fontFamily: 'Yoruka',
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(155, 89, 182, 0.1)',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  selectedOption: {
    backgroundColor: 'rgba(155, 89, 182, 0.3)',
    borderColor: '#9B59B6',
  },
  correctOption: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderColor: '#4CAF50',
  },
  wrongOption: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#F44336',
  },
  optionIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(155, 89, 182, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(155, 89, 182, 0.5)',
  },
  optionIndicatorText: {
    fontSize: 16,
    
    color: '#CCCCCC',
    fontFamily: 'Yoruka',
  },
  selectedIndicatorText: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 15,
    flex: 1,
    fontFamily: 'Yoruka',
  },
  selectedOptionText: {
    
  },
  resultIcon: {
    marginLeft: 10,
  },
  resultContainer: {
    marginTop: 25,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  resultText: {
    fontSize: 24,
    
    color: '#FFFFFF',
    marginLeft: 15,
    fontFamily: 'Yoruka',
  },
  resultSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 10,
    fontFamily: 'Yoruka',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9B59B6',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8E44AD',
  },
  nextButtonText: {
    fontSize: 18,
    
    color: '#FFFFFF',
    marginRight: 10,
    fontFamily: 'Yoruka',
  },
  nextButtonIcon: {
    color: '#FFFFFF',
  },
});
