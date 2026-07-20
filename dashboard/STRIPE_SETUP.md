# Stripe Setup Guide for vlayer Dashboard

## 1. Create Stripe Products

Go to [Stripe Dashboard > Products](https://dashboard.stripe.com/products) and create:

### Product 1: vlayer Pro Monthly
1. Click **+ Add product**
2. **Name**: `vlayer Pro Monthly`
3. **Description**: `vlayer Pro plan — HIPAA compliance scanning for teams`
4. **Pricing**:
   - Price: `$49.00`
   - Billing period: `Monthly`
   - Currency: `USD`
5. Click **Save product**
6. Copy the **Price ID** (starts with `price_`) — you'll need this for `STRIPE_PRO_MONTHLY_PRICE_ID`

### Product 2: vlayer Pro Annual
1. Click **+ Add product**
2. **Name**: `vlayer Pro Annual`
3. **Description**: `vlayer Pro plan — annual billing (save 20%)`
4. **Pricing**:
   - Price: `$470.00`
   - Billing period: `Yearly`
   - Currency: `USD`
5. Click **Save product**
6. Copy the **Price ID** (starts with `price_`) — you'll need this for `STRIPE_PRO_ANNUAL_PRICE_ID`

## 2. Configure Customer Portal

Go to [Stripe Dashboard > Settings > Billing > Customer portal](https://dashboard.stripe.com/settings/billing/portal):

1. **Business information**: Set company name to `FPI Enterprises Inc`
2. **Functionality**:
   - Enable **Invoices** (customers can view invoice history)
   - Enable **Cancel subscriptions** (customers can cancel)
   - Enable **Switch plans** (if you want to allow monthly/annual switching)
   - Enable **Update payment methods**
3. **Links**: Set the default return URL to `https://app.vlayer.app/settings`
4. Click **Save changes**

## 3. Configure Webhook

Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks):

1. Click **+ Add endpoint**
2. **Endpoint URL**: `https://app.vlayer.app/api/webhooks/stripe`
3. **Events to listen to** — select these 4:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. On the webhook detail page, click **Reveal** under "Signing secret"
6. Copy the signing secret (starts with `whsec_`) — you'll need this for `STRIPE_WEBHOOK_SECRET`

## 4. Get API Keys

Go to [Stripe Dashboard > Developers > API keys](https://dashboard.stripe.com/apikeys):

1. Copy the **Publishable key** (starts with `pk_live_` or `pk_test_`)
2. Copy the **Secret key** (starts with `sk_live_` or `sk_test_`)

> **Tip**: Use test mode keys (`pk_test_`, `sk_test_`) for development, then switch to live keys for production.

## 5. Set Environment Variables in Vercel

Run these commands (or set them in the [Vercel Dashboard > Settings > Environment Variables](https://vercel.com/francosimon-7079s-projects/dashboard/settings/environment-variables)):

```bash
# Stripe API keys
npx vercel env add STRIPE_SECRET_KEY           # paste sk_live_... or sk_test_...
npx vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # paste pk_live_... or pk_test_...

# Stripe webhook secret
npx vercel env add STRIPE_WEBHOOK_SECRET       # paste whsec_...

# Price IDs (from Step 1)
npx vercel env add STRIPE_PRO_MONTHLY_PRICE_ID # paste price_... from monthly product
npx vercel env add STRIPE_PRO_ANNUAL_PRICE_ID  # paste price_... from annual product
```

Make sure to add them for **all environments** (Production, Preview, Development).

## 6. Supabase Database Setup

Run this SQL in [Supabase Dashboard > SQL Editor](https://supabase.com/dashboard):

```sql
-- Ensure profiles table has subscription columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- If the profiles table doesn't exist yet, create it:
-- CREATE TABLE profiles (
--   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   email TEXT,
--   plan TEXT DEFAULT 'free',
--   stripe_customer_id TEXT,
--   subscription_id TEXT,
--   subscription_status TEXT DEFAULT 'none',
--   current_period_end TIMESTAMPTZ,
--   cancel_at_period_end BOOLEAN DEFAULT FALSE,
--   trial_end TIMESTAMPTZ,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- Create a trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan, created_at)
  VALUES (NEW.id, NEW.email, 'free', NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## 7. Test the Integration

1. **Deploy**: Push changes to GitHub (auto-deploys to Vercel)
2. **Sign up** at https://app.vlayer.app/signup
3. **Go to Pricing** → Click "Start Free Trial"
4. **Complete checkout** with [Stripe test card](https://docs.stripe.com/testing#cards):
   - Card: `4242 4242 4242 4242`
   - Exp: any future date
   - CVC: any 3 digits
5. **Verify**: You should be redirected to dashboard with Pro plan active
6. **Check webhook**: Go to Stripe Dashboard > Webhooks to see the event was received

## Environment Variables Summary

| Variable | Where to get it | Example |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe > API keys | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe > API keys | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe > Webhooks > endpoint | `whsec_...` |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe > Products > Monthly | `price_...` |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe > Products > Annual | `price_...` |
