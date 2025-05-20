import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  commentSection: {
    padding: 20,
    backgroundColor: '#0F0F1B',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginRight: 10,
  },
  error: {
    backgroundColor: '#FF5252',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  connectPrompt: {
    color: '#B0B0B0',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  textarea: {
    backgroundColor: '#1A1A2E',
    color: '#FFFFFF',
    padding: 10,
    borderRadius: 5,
    minHeight: 80,
    marginBottom: 10,
  },
  postButton: {
    backgroundColor: '#F36316',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#888',
    opacity: 0.6,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  buttonIcon: {
    marginRight: 5,
  },
  commentsContainer: {
    marginTop: 10,
  },
  comment: {
    backgroundColor: '#1A1A2E',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  commentUsername: {
    color: '#F36316',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentTimestamp: {
    color: '#B0B0B0',
    fontSize: 12,
  },
  commentContent: {
    marginBottom: 10,
  },
  commentText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  commentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionButton: {
    backgroundColor: '#F36316',
    padding: 8,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    marginBottom: 5,
  },
  activeButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButton: {
    backgroundColor: '#888',
  },
  deleteButton: {
    backgroundColor: '#FF5252',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 5,
  },
  actionIcon: {
    marginRight: 5,
  },
  replies: {
    marginLeft: 20,
    marginTop: 10,
  },
});