# The Concept Investment Program — Management Upgrade

This update expands the existing Expo Router / Supabase project. It does not replace your project.

## What's included

- The investor application already retrieves the active company payment account from `payment_accounts`; the expanded admin portal now lets an administrator add/update those details.
- Admin portal sections: overview, investor directory, applications, ROI, company bank account, and push notifications.
- Investor directory uses a Supabase Edge Function to read authenticated user emails safely; it supports search and CSV export that opens in Excel.
- Suspend/restore calls Supabase Auth Admin from the Edge Function and updates `profiles.account_status`. The root app also checks account status on session start.
- ROI payout/reinvestment RPCs only process pending ROI that is due. Cash payout records a reference/notes; reinvestment requires administrator notes confirming the investor's explicit consent. These operations record the outcome; they do not transfer money.
- Expo push token registration on physical devices, admin push messaging, and live in-app notifications.
- The root layout is now the single theme provider so dark mode applies to the admin portal as well as investor screens.

## Required setup

1. **Protect secrets.** The `.env` file was intentionally excluded from this updated ZIP. Do not share a service-role key or put it in the mobile app. Restore your local `.env` privately with:
   - `EXPO_PUBLIC_SUPABASE_URL=...`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
2. In Supabase SQL Editor, run `supabase/management-upgrade.sql` after your existing `supabase/schema.sql`.
3. Deploy the Edge Function from the project root:
   ```sh
   supabase functions deploy admin-management
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```
   Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions. The service-role key belongs only in Edge Function secrets.
4. Install dependencies with Yarn:
   ```sh
   yarn install
   ```
   New dependencies are Expo SDK-compatible `expo-device`, `expo-file-system`, `expo-notifications`, and `expo-sharing`.
5. Rebuild the native app after adding push-notification dependencies (for example, with your existing EAS build workflow). Push tokens require a physical device and valid EAS project configuration.
6. Ensure the intended administrator has `profiles.role = 'admin'`. Promote only the trusted account in Supabase SQL Editor:
   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id and u.email = 'YOUR_ADMIN_EMAIL';
   ```
7. Add the verified company bank account from Admin portal → Bank. Investors will see the currently active account on the application payment step.

## Important operational notes

- CSV export is Excel-compatible; it is not a binary `.xlsx` workbook. Open the shared `.csv` file in Excel and use Save As `.xlsx` if you need that format.
- Supabase Auth banning prevents future sign-in; existing sessions are also checked by the app. Apply the SQL migration before testing this.
- Push notifications can only reach users who grant notification permission and have registered a valid Expo push token. In-app notifications are saved separately.
- Mark ROI as paid only after the transfer is confirmed. Recording ROI does not initiate a transfer.
- Reinvestment must be explicitly requested by the investor and recorded in the admin notes. Do not mark reinvested based only on an assumption.
- Review the project's legal terms and applicable financial-services requirements before operating a real investment product.
