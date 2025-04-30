import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  navbar: {
    backgroundColor: '#0F0F1A',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243, 99, 22, 0.2)',
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '600',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuToggle: {
    marginLeft: 15,
  },
  navMenu: {
    backgroundColor: '#0F0F1A',
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
  },
  navMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  navMenuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(243, 99, 22, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243, 99, 22, 0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 5,
  },
  main: {
    padding: 20,
    paddingBottom: 40, // Add extra padding for footer
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  connectIcon: {
    marginBottom: 20,
  },
  connectText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deniedIcon: {
    marginBottom: 20,
  },
  accessDeniedText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    padding: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  formSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  mangaForm: {
    backgroundColor: '#2A2A3E',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.2)',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#3A3A4E',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.2)',
  },
  textarea: {
    backgroundColor: '#3A3A4E',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.2)',
  },
  fileButton: {
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  fileButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  pagePreview: {
    width: 100,
    height: 150,
    borderRadius: 8,
    marginRight: 10,
  },
  imageGrid: {
    marginTop: 10,
  },
  placeholderText: {
    color: '#888',
    fontSize: 14,
  },
  tagButton: {
    backgroundColor: '#3A3A4E',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.2)',
  },
  tagButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  chapterSection: {
    marginTop: 20,
  },
  chapterTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  addChapterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    padding: 12,
    borderRadius: 8,
  },
  addChapterButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  chapterList: {
    marginVertical: 15,
  },
  chapterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#3A3A4E',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  chapterTitleText: {
    color: '#fff',
    fontSize: 16,
  },
  chapterActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    padding: 15,
    borderRadius: 8,
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  announcementSection: {
    marginTop: 20,
  },
  announcementForm: {
    backgroundColor: '#2A2A3E',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.2)',
  },
  dateButton: {
    backgroundColor: '#3A3A4E',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.2)',
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  announcementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    padding: 15,
    borderRadius: 8,
    justifyContent: 'center',
  },
  announcementButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  mangaSection: {
    marginBottom: 20,
  },
  mangaGrid: {
    paddingBottom: 20,
  },
  mangaCard: {
    flexDirection: 'row',
    backgroundColor: '#2A2A3E',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(243, 99, 22, 0.2)',
  },
  mangaImage: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  mangaInfo: {
    flex: 1,
    marginLeft: 15,
  },
  mangaTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mangaSummary: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
  },
  mangaTags: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
  },
  mangaViewers: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
  },
  editMangaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  editMangaButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  noManga: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
  },
  artistsSection: {
    marginBottom: 20,
  },
  artistsList: {
    paddingBottom: 20,
  },
  artistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A3E',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  artistIcon: {
    marginRight: 10,
  },
  artistText: {
    color: '#fff',
    fontSize: 16,
  },
  noArtists: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
  },
  modalContainer: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#2A2A3E',
    padding: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  tagList: {
    paddingBottom: 20,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tagOptionText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  modalCloseButton: {
    backgroundColor: 'rgba(243, 99, 22, 0.8)',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
  },
  footerText: {
    color: '#ccc',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
});