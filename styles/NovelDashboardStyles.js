import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  darkContainer: {
    backgroundColor: '#1A1A2E',
  },
  lightContainer: {
    backgroundColor: '#fff',
  },
  navbar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  darkNavbar: {
    backgroundColor: '#1A1A2E',
    borderBottomColor: '#444',
  },
  lightNavbar: {
    backgroundColor: '#fff',
    borderBottomColor: '#ccc',
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  navText: {
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeToggle: {
    padding: 8,
  },
  menuToggle: {
    padding: 8,
  },
  navMenu: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
  darkNavMenu: {
    backgroundColor: '#2a2a2a',
  },
  lightNavMenu: {
    backgroundColor: '#f5f5f5',
  },
  navMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  navMenuText: {
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 8,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F36316',
  },
  headerTitle: {
    fontSize: width < 360 ? 20 : 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: width < 360 ? 14 : 16,
    marginTop: 8,
    opacity: 0.8,
  },
  main: {
    padding: 16,
    paddingBottom: 80, // Extra padding for footer
  },
  connectPrompt: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 87, 51, 0.1)',
  },
  connectIcon: {
    marginBottom: 16,
  },
  connectText: {
    fontSize: width < 360 ? 16 : 18,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  accessDenied: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 69, 69, 0.1)',
  },
  deniedIcon: {
    marginBottom: 16,
  },
  accessDeniedText: {
    fontSize: width < 360 ? 16 : 18,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36316',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 48, // Touch-friendly height
  },
  backButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  dashboard: {
    flex: 1,
  },
  formSection: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    fontSize: width < 360 ? 18 : 20,
    fontWeight: 'bold',
  },
  novelForm: {
    backgroundColor: 'transparent',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: width < 360 ? 14 : 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: width < 360 ? 14 : 16,
    minHeight: 48,
  },
  darkInput: {
    borderColor: '#444',
    backgroundColor: '#2a2a2a',
    color: '#fff',
  },
  lightInput: {
    borderColor: '#ccc',
    backgroundColor: '#fff',
    color: '#000',
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: width < 360 ? 14 : 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
  },
  placeholderText: {
    fontSize: width < 360 ? 14 : 16,
    marginBottom: 12,
    opacity: 0.7,
  },
  fileButton: {
    backgroundColor: '#F36316',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  fileButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    fontWeight: '600',
  },
  tagButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  tagButtonText: {
    fontSize: width < 360 ? 14 : 16,
    opacity: 0.8,
  },
  chapterSection: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 99, 71, 0.05)',
  },
  chapterTitle: {
    fontSize: width < 360 ? 16 : 18,
    fontWeight: 'bold',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
  },
  checkboxLabel: {
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 8,
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  dateButtonText: {
    fontSize: width < 360 ? 14 : 16,
    opacity: 0.8,
  },
  addChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36316',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 48,
    marginTop: 12,
  },
  addChapterButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  chapterList: {
    marginVertical: 16,
  },
  chapterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  darkChapterItem: {
    backgroundColor: '#2a2a2a',
  },
  lightChapterItem: {
    backgroundColor: '#f5f5f5',
  },
  chapterText: {
    flex: 1,
  },
  chapterTitleText: {
    fontSize: width < 360 ? 14 : 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  chapterPreview: {
    fontSize: width < 360 ? 12 : 14,
    opacity: 0.7,
  },
  advanceInfo: {
    fontSize: width < 360 ? 12 : 14,
    color: '#F36316',
    marginTop: 4,
  },
  chapterActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36316',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  announcementSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  announcementForm: {
    backgroundColor: 'transparent',
  },
  announcementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36316',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  announcementButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  novelsSection: {
    marginTop: 24,
  },
  noNovels: {
    fontSize: width < 360 ? 14 : 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  novelsGrid: {
    paddingBottom: 16,
  },
  novelCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  darkNovelCard: {
    backgroundColor: '#2a2a2a',
  },
  lightNovelCard: {
    backgroundColor: '#f5f5f5',
  },
  novelImage: {
    width: 80,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#2a2a2a',
  },
  novelInfo: {
    flex: 1,
  },
  novelTitle: {
    fontSize: width < 360 ? 16 : 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  novelSummary: {
    fontSize: width < 360 ? 12 : 14,
    marginBottom: 4,
    opacity: 0.7,
  },
  novelTags: {
    fontSize: width < 360 ? 12 : 14,
    marginBottom: 4,
    color: '#F36316',
  },
  novelViewers: {
    fontSize: width < 360 ? 12 : 14,
  },
  novelActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  editNovelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F36316',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 40,
  },
  editNovelButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 12 : 14,
    marginLeft: 4,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 8,
    minHeight: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  writersSection: {
    marginTop: 24,
  },
  noWriters: {
    fontSize: width < 360 ? 14 : 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  writersList: {
    paddingBottom: 16,
  },
  writerItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  darkWriterItem: {
    backgroundColor: '#2a2a2a',
  },
  lightWriterItem: {
    backgroundColor: '#f5f5f5',
  },
  writerText: {
    fontSize: width < 360 ? 14 : 16,
    fontWeight: '600',
  },
  writerId: {
    fontSize: width < 360 ? 12 : 14,
    opacity: 0.7,
    marginTop: 4,
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: width * 0.85,
    alignSelf: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  darkModal: {
    backgroundColor: '#2a2a2a',
  },
  lightModal: {
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: width < 360 ? 18 : 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: width < 360 ? 14 : 16,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  confirmButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    minHeight: 48,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#F36316',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    minHeight: 48,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    fontWeight: '600',
  },
  tagList: {
    maxHeight: 300,
    paddingVertical: 8,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tagOptionText: {
    fontSize: width < 360 ? 14 : 16,
    marginLeft: 12,
  },
  modalCloseButton: {
    backgroundColor: '#F36316',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    marginTop: 12,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  darkText: {
    color: '#fff',
  },
  lightText: {
    color: '#000',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  darkFooter: {
    backgroundColor: '#1A1A2E',
    borderTopColor: '#444',
  },
  lightFooter: {
    backgroundColor: '#fff',
    borderTopColor: '#ccc',
  },
  footerText: {
    fontSize: width < 360 ? 12 : 14,
    opacity: 0.7,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  resetButton: {
    flexDirection: 'row',
    backgroundColor: '#555',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 5,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 5,
  },
  // New styles for date pickers
  datePickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  datePickerGroup: {
    flex: 1,
    minWidth: width < 360 ? 80 : 100,
    marginBottom: 8,
  },
  datePicker: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    color: '#fff',
    paddingVertical: 8,
    minHeight: 48,
  },
  pickerItem: {
    color: '#fff',
    fontSize: width < 360 ? 14 : 16,
  },
});