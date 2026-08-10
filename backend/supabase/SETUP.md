# Manual Supabase deployment

Основной путь — GitHub Action `.github/workflows/deploy-supabase.yml`. Ручной вариант нужен только для диагностики.

Из папки `backend`:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID --password 'YOUR_DB_PASSWORD'
npx supabase db push --linked --include-all --password 'YOUR_DB_PASSWORD'
npx supabase secrets set --project-ref YOUR_PROJECT_ID \
  TELEGRAM_BOT_TOKEN='...' \
  OWNER_TELEGRAM_ID='123456789' \
  TELEGRAM_WEBHOOK_SECRET='...' \
  CRON_SECRET='...' \
  DEPLOY_SECRET='...' \
  TOKEN_ENCRYPTION_KEY='64_HEX_CHARACTERS' \
  BOT_USERNAME='ira_workspace_bot' \
  APP_PUBLIC_URL='https://bolachkova004-droid.github.io/ira-workspace/'
npx supabase functions deploy telegram-auth --project-ref YOUR_PROJECT_ID --no-verify-jwt
npx supabase functions deploy workspace-api --project-ref YOUR_PROJECT_ID --no-verify-jwt
npx supabase functions deploy telegram-webhook --project-ref YOUR_PROJECT_ID --no-verify-jwt
npx supabase functions deploy process-notifications --project-ref YOUR_PROJECT_ID --no-verify-jwt
npx supabase functions deploy google-oauth-callback --project-ref YOUR_PROJECT_ID --no-verify-jwt
npx supabase functions deploy project-setup --project-ref YOUR_PROJECT_ID --no-verify-jwt
curl --fail-with-body -X POST \
  -H 'x-deploy-secret: YOUR_DEPLOY_SECRET' \
  'https://YOUR_PROJECT_ID.supabase.co/functions/v1/project-setup'
```

`--no-verify-jwt` отключает только gateway-проверку функций: `workspace-api` самостоятельно проверяет Bearer token через Supabase Auth и выполняет пользовательские запросы с RLS. Публичными остаются только узкие token-based действия ученического портала. Webhook, cron и setup проверяют отдельные секреты.

Google Calendar требует дополнительно `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET`; redirect URI — `https://YOUR_PROJECT_ID.supabase.co/functions/v1/google-oauth-callback`.

