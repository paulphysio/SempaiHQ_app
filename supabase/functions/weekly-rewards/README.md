# Weekly Rewards Distribution Function

This Supabase Edge Function automatically distributes SMP tokens to users based on their weekly points.

## Features

- Automatically distributes 2,000,000 SMP tokens weekly
- Distributes tokens proportionally based on user weekly_points
- Resets weekly_points after distribution
- Logs distribution details in rewards_log table
- Scheduled to run automatically every Sunday at midnight UTC

## Deployment

Deploy this function to your Supabase project using the Supabase CLI:

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Login to Supabase
supabase login

# Deploy the function
cd /path/to/your/project
supabase functions deploy weekly-rewards --project-ref your-project-ref
```

## Configuration

The function is configured to run automatically every Sunday at midnight UTC through the `config.json` file. You can modify the schedule by updating the cron expression.

## Manual Execution

You can also trigger the function manually through the Supabase Dashboard or via API:

```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/weekly-rewards' \
  -H 'Content-Type: application/json'
```

## Response Format

The function returns a JSON response with the following structure:

```json
{
  "success": true,
  "message": "Rewards distributed successfully to X users!",
  "total_amount": 2000000,
  "total_points": 12345,
  "reward_per_point": 162.01,
  "timestamp": "2023-04-01T00:00:00.000Z"
}
```

## Error Handling

If an error occurs, the function returns a JSON response with:

```json
{
  "success": false,
  "message": "Failed: Error message"
}
```

## Development Notes

### TypeScript Linter Errors

You may see TypeScript linter errors in your editor related to Deno imports and globals:

- Cannot find module 'https://esm.sh/@supabase/supabase-js@2.48'
- Cannot find name 'Deno'

These errors are expected when developing Deno functions in a non-Deno environment. The code will work correctly when deployed to Supabase Edge Functions, which uses the Deno runtime.

### Security

This function does not require JWT verification (`"verify_jwt": false` in config.json) as it's designed to be triggered by a scheduler. If you want to secure manual invocations, you can set `"verify_jwt": true` and provide a valid JWT token when calling the function. 