A decentralized read to earn platform on Solana in its beta stage. 

We seek to power an ecosystem of creators and consumers/customers in a structured system that will reward the user and the creator in the same blockchain transaction. Powered by the love for anime, manga and webnovels, we're building the mobile version of our cozy part of the internet where love for literature and community is tokenized and turned into a throbbing and incentivized marketplace for stories, art, NFTs and an in-app currency.

## Features

- Read-to-earn platform for manga and novels
- Creator ecosystem with writer and artist support
- Weekly rewards system for active users
- Wallet integration for Solana blockchain
- In-app SMP token economy

## Weekly Rewards System

The platform includes an automated weekly rewards system that distributes SMP tokens to users based on their activity points. Every Sunday at midnight UTC, 2,000,000 SMP tokens are distributed proportionally to users based on their accumulated weekly points.

### How It Works

1. Users earn weekly points through platform activity
2. Points are tracked in the `weekly_points` field of the users table
3. The weekly rewards function runs automatically every Sunday
4. 2,000,000 SMP tokens are distributed proportionally to users with points
5. Tokens are added to users' off-chain wallet balances
6. Weekly points are reset after distribution
7. Users can withdraw their SMP tokens through the Novels page

### Technical Implementation

The weekly rewards system is implemented as a Supabase Edge Function (`weekly-rewards`) that runs on a scheduled basis. For more details, see the function documentation in `supabase/functions/weekly-rewards/README.md`.
