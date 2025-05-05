import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  flatListContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 15,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  weatherText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 5,
  },
  // Navbar Styles
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  navbarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  logoText: {
    color: '#ff6200',
    fontSize: 18,
    fontWeight: '700',
  },
  menuToggle: {
    padding: 10,
  },
  navLinks: {
    position: 'absolute',
    top: 70,
    right: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  navLinkActive: {
    backgroundColor: '#ff6200',
    borderRadius: 5,
  },
  navIcon: {
    marginRight: 10,
  },
  navLinkText: {
    color: '#fff',
    fontSize: 16,
  },
  // Connect Button
  connectButtonContainer: {
    padding: 15,
    alignItems: 'center',
  },
  // Leaderboard Button
  leaderboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6200',
    padding: 10,
    marginHorizontal: 15,
    borderRadius: 8,
    marginVertical: 10,
  },
  iconPulse: {
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Player Info Card
  card: {
    backgroundColor: '#2a2a2a',
    margin: 15,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardBody: {
    padding: 15,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#ff6200',
  },
  cardTitleText: {
    flex: 1,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#aaa',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 5,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#444',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#00ccff',
  },
  traitText: {
    color: '#ff6200',
    fontSize: 14,
    fontStyle: 'italic',
  },
  // Inventory Section
  sectionHeader: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#333',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: '#ff6200',
    padding: 10,
    borderRadius: 8,
    width: (width - 50) / 3,
    alignItems: 'center',
    marginVertical: 5,
  },
  inventoryContainer: {
    paddingHorizontal: 15,
  },
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 10,
    marginVertical: 5,
  },
  itemImage: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  itemDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  itemQuantity: {
    color: '#aaa',
    fontSize: 14,
    marginHorizontal: 10,
  },
  actionButton: {
    backgroundColor: '#444',
    padding: 5,
    borderRadius: 5,
    marginLeft: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    padding: 10,
  },
  // Rare Items
  rareItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
  },
  rareItem: {
    alignItems: 'center',
    width: width / 4,
    marginVertical: 10,
  },
  rareItemImage: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  rareItemText: {
    color: '#ff6200',
    fontSize: 12,
    textAlign: 'center',
  },
  // Equipment
  equipmentContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  equipmentSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  equipmentLabel: {
    color: '#fff',
    fontSize: 16,
    width: 80,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentImage: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  equipmentText: {
    color: '#fff',
    fontSize: 14,
  },
  // Ingredients
  ingredientsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 15,
  },
  ingredientItem: {
    width: (width - 50) / 3,
    alignItems: 'center',
    marginVertical: 10,
  },
  ingredientImage: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  ingredientText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  // Countdown
  countdownContainer: {
    padding: 15,
    alignItems: 'center',
  },
  countdownText: {
    color: '#ff6200',
    fontSize: 14,
    marginVertical: 5,
  },
  // Modal Styles
  modal: {
    justifyContent: 'center',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 20,
    marginHorizontal: 20,
    maxHeight: height * 0.8,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: '#ff6200',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 5,
    width: '48%',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalItemImage: {
    width: 30,
    height: 30,
    marginRight: 10,
  },
  // Craft Modal
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#444',
    borderRadius: 5,
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#ff6200',
  },
  tabText: {
    color: '#fff',
    fontSize: 14,
  },
  ingredientSelection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  ingredientButton: {
    width: (width - 80) / 3,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#444',
    marginVertical: 5,
  },
  selectedIngredient: {
    borderWidth: 2,
    borderColor: '#ff6200',
  },
  disabledIngredient: {
    opacity: 0.5,
  },
  ingredientButtonText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  // Combat Modal
  combatContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  combatant: {
    alignItems: 'center',
    width: '45%',
  },
  combatantImage: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  combatantText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  versusText: {
    color: '#ff6200',
    fontSize: 24,
    fontWeight: '700',
  },
  combatLog: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    maxHeight: 100,
    marginVertical: 10,
  },
  combatLogText: {
    color: '#fff',
    fontSize: 12,
    marginVertical: 2,
  },
  combatLoading: {
    marginVertical: 20,
  },
  combatActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  combatResult: {
    alignItems: 'center',
    marginVertical: 20,
  },
  combatResultText: {
    color: '#ff6200',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
  },
  // Leaderboard
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  leaderboardRank: {
    color: '#ff6200',
    fontSize: 16,
    width: 50,
  },
  leaderboardName: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  leaderboardStats: {
    color: '#aaa',
    fontSize: 14,
  },
  // Quests & Tasks
  questItem: {
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    marginVertical: 5,
  },
  questText: {
    color: '#fff',
    fontSize: 14,
  },
  questReward: {
    color: '#ff6200',
    fontSize: 12,
    marginTop: 5,
  },
  taskItem: {
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    marginVertical: 5,
  },
  taskText: {
    color: '#fff',
    fontSize: 14,
  },
  taskReward: {
    color: '#ff6200',
    fontSize: 12,
    marginTop: 5,
  },
  // NPC Dialogue
  npcDialogue: {
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    marginVertical: 10,
  },
  npcDialogueText: {
    color: '#fff',
    fontSize: 14,
  },
  npcQuestText: {
    color: '#ff6200',
    fontSize: 12,
    marginTop: 5,
  },
  // Skills
  skillTree: {
    marginVertical: 10,
  },
  skillTreeTitle: {
    color: '#ff6200',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  skillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    marginVertical: 5,
  },
  skillText: {
    color: '#fff',
    fontSize: 14,
  },
  // Events
  eventItem: {
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 8,
    marginVertical: 5,
  },
  eventText: {
    color: '#fff',
    fontSize: 14,
  },
  eventTimer: {
    color: '#ff6200',
    fontSize: 12,
    marginTop: 5,
  },
  // Guide
  guideText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 15,
  },
  // Input & Picker
  input: {
    backgroundColor: '#444',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
  },
  picker: {
    backgroundColor: '#444',
    color: '#fff',
    borderRadius: 8,
    marginBottom: 15,
  },
});