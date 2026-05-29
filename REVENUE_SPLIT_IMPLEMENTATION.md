# Revenue Split Implementation

## Overview
This document outlines the implementation of the new revenue split system for chapter payments on Sempai HQ. The system distributes payments transparently between creators, Sempai HQ, and the Founder Fund.

## Revenue Split Structure

### **Payment Distribution (50/30/20 Split):**
- **Creator/Novelist**: 50% ($0.0125 per chapter)
- **Sempai HQ**: 30% ($0.0075 per chapter)  
- **Founder Fund**: 20% ($0.005 per chapter)

### **Wallet Destinations:**
- **Creator**: Individual novelist's wallet (from novel data)
- **Sempai HQ**: `4EeY4iAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr` (Squads wallet)
- **Founder Fund**: `62PPSRhAk6hdn85MUoYAnUDisswZRfos68Zqf7N1QLkr`

## Technical Implementation

### **1. Payment Split Function**
```javascript
const [creatorAmount, sempaiHqAmount, founderFundAmount] = splitAmountWithResidual(
  paymentAmount,
  [50, 30, 20] // 50% creator, 30% Sempai HQ, 20% Founder Fund
);
```

### **2. SOL Transfer Instructions**
```javascript
// 50% to Creator
SystemProgram.transfer({
  fromPubkey: userPublicKey,
  toPubkey: authorPublicKey,
  lamports: creatorAmount,
}),
// 30% to Sempai HQ
SystemProgram.transfer({
  fromPubkey: userPublicKey,
  toPubkey: SEMPAI_HQ_WALLET,
  lamports: sempaiHqAmount,
}),
// 20% to Founder Fund
SystemProgram.transfer({
  fromPubkey: userPublicKey,
  toPubkey: FOUNDER_FUND_WALLET,
  lamports: founderFundAmount,
})
```

### **3. Token Transfer Instructions**
```javascript
// For SMP, USDC, and other tokens
// 50% to Creator ATA
createTransferInstruction(userAta, creatorAta, userPublicKey, creatorDestAmount);
// 30% to Sempai HQ ATA
createTransferInstruction(userAta, sempaiHqDestAta, userPublicKey, sempaiHqDestAmount);
// 20% to Founder Fund ATA
createTransferInstruction(userAta, founderFundAta, userPublicKey, totalFounderFundAmount);
```

### **4. Reward Calculation**
```javascript
const totalPayment = 1000; // Total SMP tokens for $0.025
const creatorReward = Math.floor(totalPayment * 0.5); // 500 tokens (50%)
const sempaiHqReward = Math.floor(totalPayment * 0.3); // 300 tokens (30%)
const founderFundReward = totalPayment - creatorReward - sempaiHqReward; // 200 tokens (20%)
```

## Database Tracking

### **Wallet Events Table**
Each payment generates 4 wallet events:

1. **Creator Deposit**: 50% of payment
   - `destination_user_id`: novel owner's ID
   - `amount_change`: +creatorReward
   - `metadata`: `{ split_type: "creator", percentage: 50 }`

2. **Sempai HQ Deposit**: 30% of payment
   - `destination_user_id`: "sempai-hq-system"
   - `amount_change`: +sempaiHqReward
   - `metadata`: `{ split_type: "sempai-hq", percentage: 30 }`

3. **Founder Fund Deposit**: 20% of payment
   - `destination_user_id`: "founder-fund-system"
   - `amount_change`: +founderFundReward
   - `metadata`: `{ split_type: "founder-fund", percentage: 20 }`

4. **User Withdrawal**: Full payment amount
   - `destination_user_id`: user's ID
   - `amount_change`: -requiredSmp
   - `event_type`: "withdrawal"

### **Wallet Balances Table**
Updates user and creator balances:
```javascript
// User balance decreases
await supabase.from("wallet_balances").update({ 
  amount: newSmpBalance 
}).eq("wallet_address", activeWalletAddress);

// Creator balance increases
await supabase.from("users").update({ 
  balance: newAuthorBalance 
}).eq("id", novelOwner.id);
```

## Fallback Mechanisms

### **ATA Missing Handling**
If a recipient's Associated Token Account doesn't exist:

1. **Creator ATA Missing**: Reroute creator's share to Founder Fund
2. **Sempai HQ ATA Missing**: Reroute Sempai HQ's share to Founder Fund
3. **Founder Fund ATA Must Exist**: Throws error if missing

### **Residual Handling**
The `splitAmountWithResidual` function ensures exact payment amounts:
- First two recipients get calculated amounts
- Last recipient gets remaining balance
- Prevents rounding errors and ensures total matches

## Security & Transparency

### **On-Chain Transparency**
- All transfers are visible on Solana blockchain
- Each recipient receives funds directly
- No intermediaries or hidden fees
- Clear audit trail for all transactions

### **Database Transparency**
- Detailed wallet events track every split
- Metadata shows percentage breakdowns
- System user IDs for organizational accounts
- Full transaction history available

## User Experience

### **Payment Flow**
1. User clicks payment button
2. Single transaction created with 3 transfer instructions
3. Transaction signed and sent to blockchain
4. All 3 recipients receive funds simultaneously
5. Database updated with detailed tracking

### **Loading States**
- Payment buttons show spinner during processing
- "Processing..." message indicates active transaction
- All buttons disabled during processing
- Clear success/error feedback

## Benefits

### **For Creators**
- **Higher Revenue**: 50% vs previous 30%
- **Direct Payment**: Funds go directly to creator wallet
- **Transparent Tracking**: Clear view of earnings
- **No Delays**: Immediate on-chain settlement

### **For Sempai HQ**
- **Sustainable Operations**: 30% covers platform costs
- **Development Funding**: Supports feature development
- **Marketing Budget**: Enables user acquisition
- **Infrastructure**: Maintains servers and services

### **For Founder Fund**
- **Long-term Vision**: 20% for strategic initiatives
- **Emergency Reserve**: Handles unexpected costs
- **Growth Opportunities**: Funds expansion projects
- **Risk Management**: Provides financial stability

## Price Action Considerations

### **Trading Tool Benefits**
- **Token Utility**: SMP tokens have real use case
- **Buy Pressure**: Platform operations require SMP
- **Value Accrual**: Success drives token demand
- **Circular Economy**: Revenue supports ecosystem

### **Economic Sustainability**
- **No Hidden Fees**: Transparent 50/30/20 split
- **Market Based**: Prices determined by users
- **Value Creation**: Content drives token value
- **Long-term Focus**: Sustainable revenue model

## Implementation Files

### **Modified Files:**
1. **`src/app/novel/[id]/chapter/[chapter]/page.js`**
   - Updated payment split logic
   - New wallet addresses
   - Enhanced database tracking
   - Loading states for all buttons

2. **`src/styles/ChapterPage.module.css`**
   - Added spinner animation
   - Improved button styling

### **Key Functions:**
- `createPaymentTransactionClient()`: Creates multi-recipient transactions
- `splitAmountWithResidual()`: Handles payment distribution
- `processChapterPayment()`: Orchestrates payment flow
- `handleBenefactorUnlock()`: Processes benefactor payments

## Testing Checklist

### **Functional Testing:**
- [ ] Single chapter payment ($0.025)
- [ ] 3 chapters payment ($3.00)
- [ ] Full novel payment ($15.00)
- [ ] Benefactor early access ($1.00)
- [ ] SOL, USDC, and SMP payments

### **Split Verification:**
- [ ] Creator receives 50%
- [ ] Sempai HQ receives 30%
- [ ] Founder Fund receives 20%
- [ ] Total amounts match exactly
- [ ] No rounding errors

### **Database Verification:**
- [ ] Wallet events created correctly
- [ ] Balances updated accurately
- [ ] Metadata includes split percentages
- [ ] Transaction history complete

### **Edge Cases:**
- [ ] ATA missing fallbacks
- [ ] Network error handling
- [ ] Insufficient funds
- [ ] Transaction failures

## Migration Notes

### **Backward Compatibility:**
- Existing payment flows continue to work
- No breaking changes to user experience
- Database schema remains compatible
- External wallet support unchanged

### **Rollback Plan:**
- Previous split ratios can be restored
- Wallet addresses can be reverted
- Database tracking can be simplified
- Fallback mechanisms ensure safety

## Future Enhancements

### **Potential Improvements:**
1. **Dynamic Splits**: Adjust percentages based on performance
2. **Tiered Splits**: Different splits for premium content
3. **Creator Bonuses**: Additional rewards for top performers
4. **Staking Rewards**: Share revenue with token stakers

### **Analytics:**
1. **Revenue Dashboard**: Track splits in real-time
2. **Creator Analytics**: Individual earnings insights
3. **Platform Metrics**: Overall revenue trends
4. **Token Economics**: SMP token flow analysis

## Conclusion

This revenue split implementation creates a transparent, fair, and sustainable economic model for Sempai HQ. The 50/30/20 split ensures creators are well-compensated while providing necessary funding for platform operations and long-term growth.

The on-chain transparency and detailed database tracking build trust with all stakeholders, while the fallback mechanisms ensure reliability. The system is designed to scale with platform growth and adapt to future needs.

The implementation maintains the excellent user experience with loading states and clear feedback, while providing the economic foundation for long-term success.
