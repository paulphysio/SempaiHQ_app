# Ad-Based Chapter Unlock Implementation

## Overview
This implementation allows users who don't have sufficient SMP (0.0025) to watch an advertisement and unlock one chapter per day for free.

## Features Implemented

### 1. Database Schema
- **New Table**: `ad_based_unlocks`
  - Tracks daily ad-based unlocks per user
  - Enforces one chapter per day limit via unique constraint
  - Includes proper indexes for performance

### 2. Frontend Logic
- **Balance Checking**: Automatically detects when user has insufficient SMP
- **Ad Option Display**: Shows ad unlock option only when user lacks sufficient SMP
- **Daily Limit Enforcement**: Tracks and prevents multiple ad unlocks per day
- **Chapter-Specific Tracking**: Prevents unlocking the same chapter twice via ads

### 3. User Experience
- **Smart UI**: Only shows ad option when SMP balance is insufficient
- **Clear Messaging**: Informs users about daily limits and unlock status
- **Smooth Flow**: Simulated ad watching with progress messages
- **Fallback Option**: Users can still pay with SMP if they prefer

## Implementation Details

### Database Migration
Run the SQL migration in `supabase/migrations/20250420_add_ad_based_unlocks.sql` or `run_ad_unlock_migration.sql`:

```sql
CREATE TABLE IF NOT EXISTS ad_based_unlocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  novel_id UUID NOT NULL REFERENCES novels(id),
  chapter_number INTEGER NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ad_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, chapter_number, DATE(ad_watched_at))
);
```

### Key Functions Added

#### `checkAdUnlockEligibility(userId)`
- Checks if user has already used ad unlock today
- Verifies if specific chapter was already unlocked via ad
- Returns boolean indicating eligibility

#### `handleAdBasedUnlock()`
- Simulates ad watching process
- Records unlock in database
- Updates both `ad_based_unlocks` and `chapter_payments` tables
- Unlocks chapter for reading

### UI Changes

#### New States Added
- `hasInsufficientSmp`: Detects low SMP balance
- `hasUsedAdUnlockToday`: Tracks daily usage
- `showAdOption`: Controls ad button visibility

#### Enhanced Lock Screen
- Shows ad unlock button when SMP insufficient
- Displays clear messaging about limits
- Provides SMP payment as fallback option
- Green styled ad button with hover effects

### CSS Styling
- `.adUnlock`: Green gradient button for ad option
- `.alternativeOption`: Styled text for payment alternatives
- Hover effects and animations for better UX

## Testing Instructions

### 1. Database Setup
1. Run the migration SQL in your Supabase dashboard
2. Verify the `ad_based_unlocks` table exists

### 2. Test Scenarios

#### Scenario A: User with Insufficient SMP
1. Connect wallet with < 0.0025 SMP balance
2. Navigate to a locked chapter
3. **Expected**: See green "Watch Ad - Free Unlock" button
4. Click the button
5. **Expected**: See progress messages, then chapter unlocks

#### Scenario B: Daily Limit Enforcement
1. Use ad unlock once successfully
2. Try to unlock another chapter the same day
3. **Expected**: Button shows "Ad Unlock Used Today" (disabled)

#### Scenario C: Chapter Already Unlocked
1. Unlock a chapter via ad
2. Navigate away and back to same chapter
3. **Expected**: Chapter remains unlocked, no ad option shown

#### Scenario D: User with Sufficient SMP
1. Connect wallet with >= 0.0025 SMP balance
2. Navigate to locked chapter
3. **Expected**: Only SMP payment option shown, no ad option

### 3. Edge Cases to Test
- Network errors during ad unlock
- Database timeouts
- Multiple rapid button clicks
- Page refresh during ad simulation

## Integration Notes

### Ad Network Integration
Currently uses simulated ad watching. To integrate with real ad networks:
1. Replace the simulation in `handleAdBasedUnlock()`
2. Add ad network callbacks
3. Implement proper ad verification

### Production Considerations
- Add proper error handling for ad network failures
- Implement analytics for ad performance
- Consider cooldown periods between ad attempts
- Add user preferences for ad-based unlocks

## Files Modified

### Frontend
- `src/app/novel/[id]/chapter/[chapter]/page.js` - Main implementation
- `src/styles/ChapterPage.module.css` - New styles

### Database
- `supabase/migrations/20250420_add_ad_based_unlocks.sql` - New table
- `run_ad_unlock_migration.sql` - Migration script

### Documentation
- `AD_BASED_UNLOCK_IMPLEMENTATION.md` - This file

## Future Enhancements
1. Real ad network integration
2. Multiple ad types (video, interactive, etc.)
3. Ad reward variations (bonus chapters, etc.)
4. User analytics and reporting
5. A/B testing for ad placement
