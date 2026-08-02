# Manual Supabase deployment

The recommended path is the GitHub Action in `.github/workflows/deploy-supabase.yml`.

For CLI deployment from the `backend` directory:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase db push
npx supabase secrets set \
  TELEGRAM_BOT_TOKEN="..." \
  OWNER_SETUP_CODE="..." \
  TELEGRAM_WEBHOOK_SECRET="..." \
  CRON_SECRET="..." \
  BOT_USERNAME="ira_workspace_bot" \
  APP_PUBLIC_URL="https://bolachkova004-droid.github.io/ira-workspace/"
npx supabase functions deploy workspace-api --no-verify-jwt
npx supabase functions deploy telegram-webhook --no-verify-jwt
npx supabase functions deploy process-notifications --no-verify-jwt
```

Then open the Mini App in Telegram, enter the workspace-api URL and `OWNER_SETUP_CODE`, and click **Подключить облако**. The app calls `configure-bot`, which installs the webhook, commands, menu button and five-minute Cron job.
