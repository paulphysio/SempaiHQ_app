import { StyleSheet } from 'react-native';

// Kaito Adventure Design System - Japanese Dark-Orange
const KA_COLORS = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  bgInput: '#0f0e0d',
  orangePrimary: '#cc5500',
  orangeBright: '#ff6b35',
  orangeSoft: '#e67e22',
  orangeDim: '#8b4513',
  redAccent: '#c41e3a',
  redDeep: '#8b0000',
  gold: '#c9a84c',
  goldBright: '#ffd700',
  ivory: '#f5e6d3',
  ivoryDim: '#c4b5a0',
  ink: '#2a2520',
  border: '#2d2418',
  textPrimary: '#f5e6d3',
  textSecondary: '#a09080',
  textMuted: '#6b5d4f',
  success: '#4a7c59',
  successBright: '#6ab77a',
  danger: '#c41e3a',
  dangerSoft: '#8b3a3a',
};

const styles = StyleSheet.create({
  // App Shell
  app: {
    flex: 1,
    backgroundColor: KA_COLORS.bgPrimary,
    position: 'relative',
  },

  // Ember Particles
  emberContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },

  ember: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: KA_COLORS.orangePrimary,
  },

  // Main Card
  card: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 8,
    overflow: 'hidden',
  },

  // Stats Panel
  statsPanel: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: KA_COLORS.orangePrimary,
    padding: 16,
    position: 'relative',
  },

  avatarFrame: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: KA_COLORS.orangeDim,
    padding: 3,
    backgroundColor: KA_COLORS.bgCard,
  },

  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  statIcon: {
    color: KA_COLORS.orangeSoft,
    fontSize: 14,
    fontFamily: 'Yoruka',
  },

  statLabel: {
    color: KA_COLORS.textMuted,
    fontSize: 12,
    fontFamily: 'Yoruka',
  },

  statValue: {
    color: KA_COLORS.ivory,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Yoruka',
  },

  // XP Bar
  xpTrack: {
    height: 6,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 3,
    overflow: 'hidden',
  },

  xpFill: {
    height: '100%',
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 3,
  },

  xpText: {
    fontSize: 12,
    fontFamily: 'Yoruka',
    color: KA_COLORS.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },

  // Town Banner
  townBanner: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderTopWidth: 2,
    borderTopColor: KA_COLORS.orangeDim,
    padding: 12,
  },

  townName: {
    fontSize: 18,
    fontFamily: 'Yoruka',
    fontWeight: '700',
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },

  townLevel: {
    fontSize: 12,
    fontFamily: 'Yoruka',
    color: KA_COLORS.textMuted,
    backgroundColor: KA_COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
  },

  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  weatherIcon: {
    color: KA_COLORS.orangeSoft,
  },

  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    backgroundColor: 'rgba(196, 30, 58, 0.1)',
    borderLeftWidth: 2,
    borderLeftColor: KA_COLORS.redAccent,
    marginTop: 8,
  },

  // Game Message
  message: {
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: KA_COLORS.gold,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Yoruka',
    color: KA_COLORS.ivoryDim,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Inventory
  inventoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  inventoryTitle: {
    fontSize: 14,
    fontFamily: 'Yoruka',
    color: KA_COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  inventoryActions: {
    flexDirection: 'row',
    gap: 6,
  },

  inventoryActionBtn: {
    fontSize: 12,
    fontFamily: 'Yoruka',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: KA_COLORS.ink,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    color: KA_COLORS.textMuted,
    borderRadius: 2,
  },

  inventoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    maxHeight: 200,
  },

  inventoryItem: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    width: 100,
  },

  inventoryItemRare: {
    borderColor: KA_COLORS.gold,
    backgroundColor: '#1a1508',
  },

  itemIcon: {
    width: 32,
    height: 32,
  },

  itemName: {
    fontSize: 11,
    fontFamily: 'Yoruka',
    color: KA_COLORS.ivoryDim,
    textAlign: 'center',
  },

  itemQty: {
    fontSize: 11,
    fontFamily: 'Yoruka',
    color: KA_COLORS.orangeSoft,
    fontWeight: '600',
    backgroundColor: KA_COLORS.ink,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },

  itemEquipBtn: {
    fontSize: 10,
    fontFamily: 'Yoruka',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    color: KA_COLORS.textMuted,
    borderRadius: 2,
  },

  // Equipment
  equipmentBar: {
    flexDirection: 'row',
    gap: 16,
    padding: 10,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
  },

  equipSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  equipSlotValue: {
    color: KA_COLORS.gold,
    fontWeight: '600',
  },

  equipSlotEmpty: {
    color: KA_COLORS.textMuted,
    fontStyle: 'italic',
  },

  rareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontFamily: 'Yoruka',
    color: KA_COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },

  // Section Divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
    color: KA_COLORS.textMuted,
    fontSize: 12,
    fontFamily: 'Yoruka',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: KA_COLORS.border,
  },

  // Typography
  title: {
    fontSize: 20,
    fontFamily: 'Yoruka',
    fontWeight: '700',
    color: KA_COLORS.ivory,
    letterSpacing: 2,
  },

  subtitle: {
    color: KA_COLORS.textSecondary,
    fontSize: 14,
    fontFamily: 'Yoruka',
    letterSpacing: 1,
  },

  // Command Bar
  commandBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: KA_COLORS.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
    padding: 12,
    paddingBottom: 20,
  },

  commandGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },

  // Buttons
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    fontSize: 13,
    fontFamily: 'Yoruka',
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    backgroundColor: KA_COLORS.bgCard,
    color: KA_COLORS.ivoryDim,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  btnPrimary: {
    borderColor: KA_COLORS.orangePrimary,
    backgroundColor: 'rgba(204, 85, 0, 0.15)',
    color: KA_COLORS.orangeBright,
  },

  btnDanger: {
    borderColor: KA_COLORS.redAccent,
    backgroundColor: 'rgba(196, 30, 58, 0.12)',
    color: '#e08a96',
  },

  btnSuccess: {
    borderColor: KA_COLORS.success,
    backgroundColor: 'rgba(74, 124, 89, 0.12)',
    color: KA_COLORS.successBright,
  },

  btnIcon: {
    fontSize: 16,
    fontFamily: 'Yoruka',
  },

  // Dropdown
  dropdownMenu: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    padding: 4,
    minWidth: 180,
  },

  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: 'Yoruka',
    color: KA_COLORS.ivoryDim,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  dropdownHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 11,
    fontFamily: 'Yoruka',
    color: KA_COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  dropdownDivider: {
    height: 1,
    backgroundColor: KA_COLORS.border,
    marginVertical: 4,
  },

  // Modal
  modalContent: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
  },

  modalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
    padding: 16,
    backgroundColor: 'rgba(204, 85, 0, 0.05)',
  },

  modalTitle: {
    fontSize: 18,
    fontFamily: 'Yoruka',
    fontWeight: '700',
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },

  modalBody: {
    padding: 20,
    maxHeight: '70%',
  },

  // Panel
  panel: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    padding: 16,
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },

  panelTitle: {
    fontSize: 15,
    fontFamily: 'Yoruka',
    fontWeight: '700',
    color: KA_COLORS.ivory,
    letterSpacing: 1,
  },

  // Countdown
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontFamily: 'Yoruka',
    color: KA_COLORS.orangeSoft,
  },

  // Task Item
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 3,
    marginBottom: 6,
  },

  taskProgress: {
    flex: 1,
    height: 4,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 2,
    overflow: 'hidden',
  },

  taskProgressFill: {
    height: '100%',
    backgroundColor: KA_COLORS.orangePrimary,
    borderRadius: 2,
  },

  // List
  listItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
    color: KA_COLORS.ivoryDim,
    fontSize: 14,
    fontFamily: 'Yoruka',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Input
  input: {
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
    color: KA_COLORS.ivory,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Yoruka',
  },

  // Progress Bar
  progressTrack: {
    height: 8,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 4,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  healthFill: {
    backgroundColor: KA_COLORS.redAccent,
  },

  // Navbar
  navbar: {
    backgroundColor: KA_COLORS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  navbarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  navbarBrandText: {
    color: KA_COLORS.ivory,
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'Yoruka',
    letterSpacing: 2,
  },

  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  navLinkActive: {
    borderColor: 'rgba(204, 85, 0, 0.3)',
    backgroundColor: 'rgba(204, 85, 0, 0.08)',
  },

  navLinkText: {
    fontSize: 13,
    fontFamily: 'Yoruka',
    letterSpacing: 1,
  },

  navLinkTextActive: {
    color: KA_COLORS.orangeBright,
  },

  navLinkTextInactive: {
    color: KA_COLORS.textSecondary,
  },
});

export { styles, KA_COLORS };
