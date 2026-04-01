# Enhanced ConnectButton with Seeker Wallet Support

This enhanced version of the ConnectButton now supports both the original embedded wallet and the new Seeker Wallet integration.

## Features

### Dual Wallet Support
- **Embedded Wallet**: Original password-protected wallet with biometric support
- **Seeker Wallet**: Hardware-level security with Seed Vault technology

### Enhanced User Experience
- Wallet selection modal with clear feature comparison
- Persistent wallet type preference
- Enhanced dropdown showing wallet type
- Unified transaction signing interface

## Installation

The enhanced ConnectButton requires these additional dependencies:
```bash
npm install @solana-mobile/mobile-wallet-adapter-protocol @solana-mobile/mobile-wallet-adapter-protocol-web3js
```

## Usage

### Basic Usage
```javascript
import ConnectButton, { EmbeddedWalletProvider, EmbeddedWalletContext } from './components/ConnectButtonEnhanced';

// In your App.js
<EmbeddedWalletProvider>
  <YourApp />
</EmbeddedWalletProvider>

// In your screens
import { useContext } from 'react';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';

const MyScreen = () => {
  const { 
    wallet, 
    isWalletConnected, 
    walletType,
    createEmbeddedWallet,
    connectSeekerWallet,
    disconnectWallet,
    signAndSendTransaction
  } = useContext(EmbeddedWalletContext);

  return (
    <View>
      <ConnectButton />
      {/* Your screen content */}
    </View>
  );
};
```

### Context Values
The `EmbeddedWalletContext` provides:

```javascript
{
  wallet: { publicKey },           // Current wallet public key
  secretKey: Uint8Array,         // Private key (embedded wallet only)
  isWalletConnected: boolean,     // Connection status
  walletType: 'embedded' | 'seeker' | null,  // Current wallet type
  createEmbeddedWallet: Function,  // Create new embedded wallet
  retrieveEmbeddedWallet: Function, // Restore existing embedded wallet
  connectSeekerWallet: Function,  // Connect to Seeker Wallet
  disconnectWallet: Function,     // Disconnect current wallet
  signAndSendTransaction: Function, // Sign and send transactions
  isLoading: boolean,            // Loading state
  error: string,                 // Error message
  useBiometrics: boolean,        // Biometric preference
  setUseBiometrics: Function,    // Set biometric preference
  isSeekerConnected: boolean     // Seeker-specific connection status
}
```

## Wallet Types Comparison

### Embedded Wallet
✓ **Password & Biometric Protection** - Multi-layer security
✓ **Account-based Recovery** - Recover through your Sempai account
✓ **Cross-device Sync** - Access from multiple devices
✓ **Full Control** - Complete wallet management

### Seeker Wallet
✓ **Hardware Security** - Seed Vault technology
✓ **Double-tap Transactions** - Consistent UX across apps
✓ **Seeker ID Support** - Human-readable addresses
✓ **Genesis Token Benefits** - Exclusive features for Seeker users

## Implementation Details

### Seeker Wallet Integration
- Uses Mobile Wallet Adapter (MWA) protocol
- Hardware-level biometric authentication
- Automatic dApp recognition
- Genesis Token verification

### Embedded Wallet Features
- Encrypted private key storage
- Biometric authentication support
- Account-based backup and recovery
- Cross-device synchronization

## Migration

To update existing screens:

1. Update imports:
```javascript
// Old
import { EmbeddedWalletContext } from '../components/ConnectButton';
import ConnectButton from '../components/ConnectButton';

// New
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import ConnectButton from '../components/ConnectButtonEnhanced';
```

2. Update App.js provider:
```javascript
// Old
import { EmbeddedWalletProvider } from './components/ConnectButton';

// New
import { EmbeddedWalletProvider } from './components/ConnectButtonEnhanced';
```

## Development Notes

### Requirements
- Expo development build required for Seeker Wallet testing
- Android development environment setup
- Seeker phone or emulator with Seeker Wallet app

### Testing
- Embedded wallet: Works with standard Expo Go
- Seeker wallet: Requires development build
- Use `expo start --dev-client` for testing

## Troubleshooting

### Common Issues

1. **Seeker Wallet not connecting**
   - Ensure development build is installed
   - Check Seeker Wallet app is installed
   - Verify MWA dependencies are installed

2. **Import errors**
   - Run `npm install` to install new dependencies
   - Clear Expo cache: `expo start -c`

3. **Transaction signing issues**
   - Check wallet type in context
   - Ensure proper error handling for both wallet types

### Debug Mode
Enable debug logging to troubleshoot:
```javascript
// In ConnectButtonEnhanced.js
console.log('[Wallet Type]', walletType);
console.log('[Connection Status]', isWalletConnected);
```

## Future Enhancements

- [ ] Multiple wallet connections
- [ ] Wallet switching without disconnect
- [ ] Enhanced transaction history
- [ ] NFT support for Seeker Wallet
- [ ] Genesis Token integration
- [ ] Seeker ID resolution

## Support

For issues or questions:
1. Check console logs for error messages
2. Verify all dependencies are installed
3. Ensure proper development environment setup
4. Test with both wallet types if applicable
