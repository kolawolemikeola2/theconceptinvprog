# Supabase integration kit — The Concept Investment Program

This package wires Supabase email/password authentication, user profiles, USD investment applications, private receipt uploads, admin approval, active investments and 24 monthly ROI records at 2.5% per month.

## 1. Install dependencies in your existing Expo project

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-image-picker
```

## 2. Add environment variables

Copy `.env.example` values into a `.env` file at the project root. Get the Project URL and publishable/anon key from Supabase Dashboard > Project Settings > API. Never put the `service_role` key in the mobile app or `.env` variable prefixed with `EXPO_PUBLIC_`.

## 3. Run the database setup

Open Supabase Dashboard > SQL Editor and run `supabase/schema.sql` in full. This creates the profile trigger, tables, RLS rules, private `payment-receipts` bucket and the secure admin review function.

## 4. Copy files into your app

Copy `lib/supabase.ts`, `services/investments.ts`, `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/` and `app/admin-review.tsx` into the matching paths. Replace `app/(tabs)/index.tsx`, `app/(tabs)/investments.tsx`, `app/(tabs)/roi.tsx`, `app/(tabs)/apply-investment.tsx` and `app/(tabs)/profile.tsx` with the versions in this package. Keep your existing remaining tabs and theme module.

The root layout imports `AppThemeProvider` from `constants/app-theme.tsx`; keep your existing theme module in that location. If your current root layout has additional providers, merge them rather than deleting them.

## 5. Configure Supabase Auth

In Supabase Dashboard > Authentication > URL Configuration, add your app's supported redirect URLs for email confirmation and password recovery. For development, test registration with email confirmation enabled. If confirmation is enabled, a new user must click the email link before signing in. If you prefer instant registration for a private demo, you can disable email confirmation in Supabase Auth settings, but do not use that setting as a substitute for production security.

## 6. Configure the admin

1. Register your own account through the app.
2. In Supabase SQL Editor, promote only your intended administrator account by running the example at the bottom of `supabase/schema.sql`, replacing `YOUR_ADMIN_EMAIL` with that exact email.
3. Insert verified payment account details into `public.payment_accounts` from Supabase SQL Editor. Use only the company's confirmed receiving account. The investor app intentionally blocks submission if no active payment account exists.
4. Open `/admin-review` while signed in as that admin. Pending applications show receipt previews and can be approved or rejected. Approving creates an active investment and 24 monthly ROI payment rows. The investor cannot approve their own application.

Example payment account insert (replace with real verified details):

```sql
insert into public.payment_accounts (bank_name, account_name, account_number, currency, payment_instructions, is_active)
values ('VERIFIED BANK', 'VERIFIED COMPANY ACCOUNT NAME', 'VERIFIED ACCOUNT NUMBER', 'USD', 'Use your application amount and keep the transfer receipt.', true);
```

## 7. Start and test

```bash
npx expo start -c
```

Test in this order: register; confirm email if enabled; sign in; sign out; sign in again; configure payment account; submit an application with a receipt; sign in as admin and approve/reject; confirm that approval creates the investment and 24 ROI records.

## Important financial behavior

ROI is stored as a fixed 2.5% of the approved original principal each month for 24 months. For example, $10,000 gives an illustrative $250 monthly ROI. The schema records scheduled ROI amounts but does not itself transfer money or mark ROI as paid. Those statuses should be updated only by authorized administrators or a verified payment integration. This implementation does not calculate compounding.

The SQL secures investor data with Row Level Security. A production launch should still include company/legal review of investment terms, payment verification procedures, backup strategy, and tests on a staging Supabase project before handling real money.
