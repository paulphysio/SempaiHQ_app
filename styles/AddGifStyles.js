import { StyleSheet } from 'react-native';

export const getAddGifStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bgCard,
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
    borderBottomColor: c.border,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: c.textPrimary,
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
    color: c.accent,
    fontSize: 14,
  },
  input: {
    backgroundColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: c.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(155, 89, 182, 0.3)',
    fontFamily: 'Yoruka',
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.border,
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
  },
  messageSuccess: {
    color: '#2ECC71',
  },
  messageError: {
    color: c.danger,
  },
});

