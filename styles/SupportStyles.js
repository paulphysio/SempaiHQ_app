import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    
    marginLeft: 12,
    fontFamily: 'Yoruka',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  supportSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  description: {
    color: '#CCC',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Yoruka',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#9B59B6',
    fontSize: 14,
    
    fontFamily: 'Yoruka',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
    fontFamily: 'Yoruka',
  },
  textarea: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'Yoruka',
  },
  alertError: {
    color: '#E74C3C',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Yoruka',
  },
  alertSuccess: {
    color: '#2ECC71',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Yoruka',
  },
  submitButton: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    
    marginLeft: 12,
    fontFamily: 'Yoruka',
  },
});

export default styles;
