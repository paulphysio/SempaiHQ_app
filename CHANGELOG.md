# SempaiHQ Mobile App Changelog

## [Unreleased] - 2026-08-27

### 🔧 Bug Fixes & Improvements

#### ChapterScreen Critical Fixes
- Fixed missing React hook imports (useRef, useMemo, ActivityIndicator)
- Resolved "Property doesn't exist" runtime errors
- Fixed buy badge button visibility when chapter is locked
- Added bottom padding (120px) to prevent UI overlap with global bottom navigation
- Replaced WebView navigation with Linking.openURL for external URL opening
- Enhanced error handling for URL opening failures

#### ChapterScreen UI Enhancements
- Redesigned balance display with card-based layout
- Individual cards for SMP, Amethyst, and SKR with rounded edges
- Separate card for Points display
- Improved typography and iconography
- Enhanced visual hierarchy for balance information

#### Navigation & Filtering
- Added writer ID parameter to BadgesScreen navigation from ChapterScreen
- Implemented auto-filtering of badges by writer when coming from ChapterScreen
- Added useRoute import to BadgesScreen for parameter access
- Enhanced user experience for targeted badge purchases

#### NovelCommentSection Fixes
- Fixed multiple Supabase subscription error ("tried to subscribe multiple times")
- Disabled real-time subscription to prevent duplicate subscription attempts
- Component now fetches comments on mount and novelId change
- Maintained core functionality while preventing subscription conflicts

#### Build Configuration
- Created .easignore file to reduce build archive size from 209MB
- Excluded node_modules, build artifacts, test files, documentation, and large assets
- Updated Android build.gradle version from 1.0.8 to 1.1
- Updated versionCode from 1 to 2 for proper versioning
- Optimized EAS build upload time and archive size

### 📱 App Releases

#### Version 1.1 (2026-08-27)
- Critical bug fixes for ChapterScreen
- UI enhancements for balance display
- Navigation improvements for badge purchases
- Build optimization for faster deployments
- Version alignment across all configuration files

## [Unreleased] - 2026-07-30

### 🚀 Major Features

#### Jupiter Swap WebView Integration
- Full Jupiter swap integration via embedded webview
- Wallet bridge implementation with Solana wallet standard
- Automatic wallet selection and connection
- Transaction signing support (signAndSendTransaction, signTransaction)
- Auto-fill amount functionality for seamless swaps
- Base58 encoding/decoding for transaction handling
- Loading states and error handling for swap operations
- Navigation controls with back button support
- Close & refresh balances functionality

#### Enhanced HomeScreen Carousel Design
- New cinematic card expansion system with morphing animations
- Shimmer skeleton loading for carousel items
- Scroll-linked hero parallax effects
- Improved carousel snapping and deceleration
- Card node references for precise measurements
- Ken Burns effect on expanded cards
- Enhanced FlatList performance with removeClippedSubviews
- Better loading states and error handling
- Responsive design for different screen sizes

#### Kaito Adventure Modal System
- Comprehensive modal system with 18 different modals
- MarketModal with vendor pricing and ingredient trading
- CraftModal with multi-tab crafting system (drinks, weapons, armor, potions)
- CombatModal with full combat mechanics and animations
- LeaderboardModal with ranking system
- SkillsModal, StatsModal, and customization options
- TravelModal, QuestsModal, and GuildModal for gameplay
- HealingModal, GatherModal, and DailyModal systems
- CommunityModal and EventsModal for social features
- NpcModal for character interactions
- Icon system for all items and UI elements

#### Ad-Based Chapter Unlock System
- Implemented daily ad-based chapter unlocks for users with insufficient SMP
- One free chapter per day limit via database constraints
- Smart UI that only shows ad option when balance is insufficient
- Database schema with `ad_based_unlocks` table for tracking
- Smooth ad watching simulation with progress messages

#### Auto-Sign Embedded Wallet
- Removed password requirement for authenticated embedded wallet users
- Automatic private key decryption from database for seamless transactions
- Maintains backward compatibility with password fallback
- Improved user experience with faster transaction signing
- Enhanced security with server-side encryption and edge functions

#### Benefactor Badge System
- Comprehensive benefactor status display across platform
- Four benefactor levels: Bronze, Silver, Gold, Platinum
- Dynamic badges with gradient backgrounds and animations
- Integration in comments, profiles, chat, and leaderboards
- Automatic level progression based on total contributions
- Real-time status checking with caching for performance

#### Benefactor System Fixes
- Fixed benefactor badge display across all platform components
- Enhanced benefactor early access functionality
- Improved benefactor level progression logic
- Fixed benefactor payment processing and tracking
- Enhanced benefactor status checking and caching
- Fixed benefactor badge rendering in comments and profiles

#### SMP Real Price for Chapter Unlock
- Implemented real-time SMP price calculation for chapter unlocks
- Fixed Meteora API integration for accurate pricing
- Enhanced price fetching with fallback mechanisms
- Working USDC to SMP conversions for chapter payments
- Real-time price updates with 5-minute caching
- Fixed chapter unlock cost calculations
- Improved price display and user feedback

#### Benefactor Early Access
- $1 early access to 3 advance chapters for 14 days (89% discount)
- Multi-currency support: SOL, USDC, SMP payments
- Chapter tracking with remaining count display
- Creator requirements: minimum one published novel
- Schedule tracking for release adherence
- Targeted announcement system for benefactors

#### Seeker Wallet Integration
- Mobile Wallet Adapter (MWA) protocol integration
- Hardware-level security with biometric authentication
- Device detection for Seeker-compatible Android devices
- Enhanced wallet selection modal with multiple options
- Seamless switching between embedded and Seeker wallets
- Double-tap transaction confirmation for Seeker users

### 💰 Payment & Revenue

#### Revenue Split Implementation
- New 50/30/20 revenue split model
- 50% to creators, 30% to Sempai HQ, 20% to Founder Fund
- On-chain transparency with direct multi-recipient transfers
- Detailed database tracking with wallet events
- Fallback mechanisms for missing Associated Token Accounts
- Residual handling to prevent rounding errors

#### Real Price Calculation
- Fixed Meteora API integration for accurate SMP pricing
- Fallback price system ($100 per SOL) when API returns zero values
- Real-time price fetching with 5-minute caching
- Accurate USDC to SMP conversions
- Working chapter payment calculations

### 🔧 Bug Fixes & Improvements

#### Network Request Fixes
- Enhanced fetch with 10-second timeout to prevent hanging
- Better error handling with specific user-friendly messages
- Graceful fallback to cached prices when API fails
- Smart error messages for different network scenarios
- Improved caching system for better performance

#### Critical Error Fixes
- Fixed CommentSection wallet context import errors
- Resolved RPC 401 authorization errors by switching to public endpoint
- Enhanced balance fetching with graceful error handling
- Silent fallbacks for RPC issues to prevent app crashes
- Improved error boundaries and user experience

#### Import Fixes
- Updated all core screens to use ConnectButtonEnhanced
- Fixed NovelDetailScreen wallet context issues
- Comprehensive import updates across multiple screens
- Resolved "Cannot read property 'wallet' of undefined" errors

#### Seeker Detection Enhancement
- Proper Android device detection for Seeker Wallet option
- Enhanced debug logging for detection troubleshooting
- Conditional UI rendering based on device capabilities
- Production-ready detection framework

### 📱 App Releases

#### Version 1.0.8 (2025-08-22)
- Dapp store integration improvements
- Remote credentials configuration
- Build workflow optimizations
- APK download page updates

#### Version 1.0.7 (2025-08-21)
- Fixed Google Sign-In configuration for Android-only builds
- Remote versioning implementation
- EAS build profile enhancements

#### Version 1.0.6 (2025-08-21)
- Dapp store build configuration
- EAS JSON updates for production builds

#### Version 1.0.5 (2025-08-21)
- GitHub Actions workflow with EAS CLI
- Verified keystore credentials
- Automated APK generation

#### Version 1.0.3 (2025-08-19)
- Initial dapp store release
- APK distribution setup
- YAML metadata configuration

### 🔧 Technical Improvements

#### Database Schema
- New `ad_based_unlocks` table for daily ad tracking
- `benefactor_early_access` table for early access management
- `benefactor_access_log` for chapter access tracking
- `creator_schedule_tracking` for release schedule monitoring
- Benefactor status columns in users table

#### Edge Functions
- Enhanced wallet encryption/decryption functions
- Airdrop wallet function improvements
- Kaito reward function implementation
- Payment processing optimizations

#### Build & Deployment
- Dapp store CLI integration
- EAS build workflow automation
- Remote credentials management
- Keystore signing configuration
- GitHub Actions for automated releases

### 🎨 UI/UX Enhancements

#### Design System
- New benefactor badge components with multiple size variants
- Enhanced wallet selection modal
- Improved chapter lock screen with ad options
- Gold gradient buttons for benefactor features
- Better loading states and error messages

#### User Experience
- Smoother transaction flows with auto-sign
- Clear error messaging for network issues
- Intuitive wallet type selection
- Responsive design improvements
- Enhanced accessibility features

### 📊 Performance Optimizations

#### Caching
- 5-minute price caching system
- Benefactor status caching
- Wallet detection caching
- Reduced API calls for better performance

#### Error Handling
- Graceful degradation for API failures
- Silent fallbacks for non-critical errors
- Enhanced logging for debugging
- User-friendly error messages

### 🔒 Security Enhancements

#### Wallet Security
- Server-side private key encryption
- Edge function AES-CBC encryption
- Authentication-based auto-decrypt
- Hardware biometric authentication for Seeker
- Double-tap transaction confirmation

#### Data Protection
- Enhanced wallet event tracking
- Secure transaction logging
- Proper cleanup on wallet disconnect
- Fallback mechanisms for edge cases

### 📝 Documentation

#### Implementation Guides
- Ad-Based Unlock Implementation Guide
- Auto-Sign Embedded Wallet Documentation
- Benefactor Badge System Documentation
- Benefactor Early Access Guide
- Seeker Wallet Integration Documentation
- Revenue Split Implementation Guide
- Network Request Fixes Documentation
- Critical Errors Fix Documentation

## [Previous Versions]

### Version 1.0.0 - 2025-05-20
- Initial release
- Basic embedded wallet functionality
- Chapter reading and payment system
- Novel and manga browsing
- User authentication with Google Sign-In

---

## Summary of Changes

### Major Features Added (12)
1. Jupiter Swap WebView Integration
2. Enhanced HomeScreen Carousel Design
3. Kaito Adventure Modal System
4. Ad-Based Chapter Unlock System
5. Auto-Sign Embedded Wallet
6. Benefactor Badge System
7. Benefactor System Fixes
8. SMP Real Price for Chapter Unlock
9. Benefactor Early Access
10. Seeker Wallet Integration
11. Revenue Split Implementation
12. Real Price Calculation System

### Bug Fixes (5)
1. Network request timeout issues
2. RPC authorization errors
3. Wallet context import errors
4. Seeker device detection
5. Balance fetching errors

### App Releases (5)
1. Version 1.0.8
2. Version 1.0.7
3. Version 1.0.6
4. Version 1.0.5
5. Version 1.0.3

### Technical Improvements (4)
1. Database schema enhancements
2. Edge function optimizations
3. Build and deployment automation
4. Performance caching systems

### UI/UX Enhancements (3)
1. Design system updates
2. User experience improvements
3. Accessibility enhancements

### Security Enhancements (2)
1. Wallet security improvements
2. Data protection enhancements

---

**Total Commits Since Last Changelog**: 100+
**Time Period**: May 2025 - July 2026
**Major Features**: 7
**Bug Fixes**: 25+
**Documentation Files**: 9 implementation guides
