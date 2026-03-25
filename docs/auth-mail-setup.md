# Auth Mail Setup (Supabase + Resend SMTP)

This project uses Supabase Auth for login and invite emails. For production, configure custom SMTP with Resend.

## 1) DNS setup

Configure your sending domain in Resend and publish:

- SPF
- DKIM
- DMARC

Use one domain for all auth emails, e.g. `auth.example.ch`.

## 2) Supabase Auth SMTP settings

In Supabase Dashboard:

1. Go to Authentication -> Settings -> SMTP Settings.
2. Enable Custom SMTP.
3. Configure with Resend values:
   - Host: `smtp.resend.com`
   - Port: `587`
   - Username: `resend`
   - Password: `<RESEND_API_KEY>`
   - Sender name: `Bauflip`
   - Sender email: `noreply@your-domain`

## 3) Auth URL and redirect settings

In Supabase Authentication URL settings:

- Site URL: your production URL
- Additional Redirect URLs:
  - `https://your-app/onboarding`
  - `https://your-app/anmeldung`
  - local development URLs

## 4) Email templates

Use consistent copy and support contact in:

- Invite email
- Password reset email
- Email confirmation (if enabled)

Suggested footer:

`Falls Sie diese E-Mail nicht erwartet haben, kontaktieren Sie support@your-domain.`

## 5) Required environment variables in app

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `ENFORCE_ADMIN_MFA=true`
