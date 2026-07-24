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
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    
    fontFamily: 'Yoruka',
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
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
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  fileButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 12,
    fontFamily: 'Yoruka',
  },
  previewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
  },
  previewImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  submitButton: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    
    fontFamily: 'Yoruka',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'Yoruka',
  },
  messageSuccess: {
    color: '#2ECC71',
  },
  messageError: {
    color: '#E74C3C',
  },
});

export default styles;
