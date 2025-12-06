# Deployment Guide - Railway & Netlify

This guide will help you deploy YoDoc safely to Railway (backend) and Netlify (frontend).

## 🚂 Railway Configuration (Backend)

### Step 1: Create Railway Project

1. Go to [Railway](https://railway.app)
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `Aggregator` repository
5. Railway will auto-detect the project

### Step 2: Configure Environment Variables

In Railway dashboard, go to your project → **Variables** tab and add:

#### Required Variables

```bash
# Database
DATABASE_URL=your_neon_database_connection_string

# JWT Authentication
JWT_SECRET=generate_a_random_secure_string_here_min_32_chars

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS - Add your Netlify URL here (get this after deploying frontend)
ALLOWED_ORIGINS=https://your-app-name.netlify.app,https://yodoc.netlify.app

# Client URL (for email links and redirects)
CLIENT_URL=https://your-app-name.netlify.app
```

#### Optional but Recommended

```bash
# OpenAI API (for intelligent query parsing)
OPENAI_API_KEY=sk-proj-your-openai-key-here

# Google Places API (for enhanced location data)
GOOGLE_PLACES_API_KEY=your-google-places-api-key

# Email Configuration (for verification emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
EMAIL_FROM=your-email@gmail.com
FRONTEND_URL=https://your-app-name.netlify.app
```

#### Stripe Configuration (for Premium Subscriptions)

```bash
# Stripe Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key

# Stripe Webhook Secret (get after setting up webhook)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Product/Price IDs (create in Stripe Dashboard)
STRIPE_PREMIUM_PRICE_ID=price_your_premium_price_id
STRIPE_PREMIUM_PRODUCT_ID=prod_your_premium_product_id
```

### Step 3: Configure Build Settings

Railway should auto-detect, but verify:
- **Build Command**: `npm install` (or leave empty, Railway auto-detects)
- **Start Command**: `npm run start:server`
- **Root Directory**: `/` (root of repo)

### Step 4: Get Your Railway URL

After deployment, Railway will provide a URL like:
```
https://your-app-name.up.railway.app
```

**Important**: Copy this URL - you'll need it for Netlify configuration.

---

## 🌐 Netlify Configuration (Frontend)

### Step 1: Create Netlify Site

1. Go to [Netlify](https://app.netlify.com)
2. Sign up/login with GitHub
3. Click "Add new site" → "Import an existing project"
4. Connect your GitHub repository
5. Select the `Aggregator` repository

### Step 2: Configure Build Settings

In Netlify dashboard → **Site settings** → **Build & deploy**:

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: `18` or `20` (in Environment variables)

### Step 3: Configure Environment Variables

Go to **Site settings** → **Environment variables** and add:

#### Required Variables

```bash
# Backend API URL (use your Railway URL from Step 4 above)
VITE_API_URL=https://your-app-name.up.railway.app/api
```

**Important**: 
- Use your Railway backend URL
- Make sure it ends with `/api`
- Use `https://` (not `http://`)

### Step 4: Update netlify.toml (Optional)

If you want to hardcode the API URL in the config file, edit `netlify.toml`:

```toml
[build.environment]
  VITE_API_URL = "https://your-app-name.up.railway.app/api"
```

**Note**: Environment variables in Netlify dashboard override `netlify.toml`, so you can set it in either place.

### Step 5: Deploy

1. Netlify will automatically deploy on every push to `main` branch
2. Or click "Trigger deploy" → "Deploy site" for manual deploy
3. Wait for build to complete
4. Your site will be available at: `https://your-app-name.netlify.app`

---

## 🔗 Connecting Frontend to Backend

### After Both Are Deployed:

1. **Get your Netlify URL**: `https://your-app-name.netlify.app`

2. **Update Railway CORS**:
   - Go to Railway → Your project → Variables
   - Update `ALLOWED_ORIGINS`:
     ```
     ALLOWED_ORIGINS=https://your-app-name.netlify.app,https://yodoc.netlify.app
     ```
   - Update `CLIENT_URL`:
     ```
     CLIENT_URL=https://your-app-name.netlify.app
     ```
   - Railway will automatically redeploy

3. **Verify Connection**:
   - Open your Netlify site
   - Open browser DevTools → Network tab
   - Try to sign up or search
   - Check if API calls go to your Railway backend

---

## 🔐 Stripe Webhook Setup (For Premium Subscriptions)

### Step 1: Get Webhook URL

Your webhook endpoint will be:
```
https://your-app-name.up.railway.app/api/webhooks/stripe
```

### Step 2: Configure in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-app-name.up.railway.app/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to Railway environment variables as `STRIPE_WEBHOOK_SECRET`

---

## ✅ Verification Checklist

After deployment, verify:

### Backend (Railway)
- [ ] Server starts without errors
- [ ] Database connection successful
- [ ] CORS allows your Netlify domain
- [ ] API endpoints respond (check Railway logs)

### Frontend (Netlify)
- [ ] Build completes successfully
- [ ] `VITE_API_URL` points to Railway backend
- [ ] Site loads without errors
- [ ] Can make API calls (check Network tab)

### Integration
- [ ] Sign up works
- [ ] Login works
- [ ] Search works
- [ ] Favorites save correctly
- [ ] Subscription page loads (if logged in)

---

## 🐛 Troubleshooting

### Backend Issues

**Database Connection Error**
- Verify `DATABASE_URL` is correct
- Check if Neon database is active
- Ensure connection string includes `?sslmode=require`

**CORS Errors**
- Verify `ALLOWED_ORIGINS` includes your Netlify URL
- Check Railway logs for CORS errors
- Ensure no trailing slashes in URLs

**Port Issues**
- Railway auto-assigns `PORT` - don't hardcode it
- Use `process.env.PORT` in code (already done)

### Frontend Issues

**API Calls Failing**
- Verify `VITE_API_URL` in Netlify environment variables
- Check Network tab for actual API URL being used
- Ensure Railway backend is running and accessible

**Build Fails**
- Check Netlify build logs
- Verify Node version (should be 18+)
- Check for TypeScript errors

### Stripe Issues

**Webhook Not Working**
- Verify webhook URL is correct
- Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check Railway logs for webhook errors
- Ensure webhook events are selected in Stripe

---

## 🔒 Security Best Practices

1. **Never commit** `.env` files or API keys
2. **Use environment variables** for all secrets
3. **Rotate keys** if accidentally exposed
4. **Use production Stripe keys** (not test keys) in production
5. **Enable HTTPS** (automatic on Railway and Netlify)
6. **Review CORS settings** regularly
7. **Monitor Railway logs** for suspicious activity

---

## 📝 Quick Reference

### Railway Environment Variables (Backend)
```
DATABASE_URL
JWT_SECRET
PORT
NODE_ENV=production
ALLOWED_ORIGINS
CLIENT_URL
OPENAI_API_KEY (optional)
GOOGLE_PLACES_API_KEY (optional)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM (optional)
STRIPE_SECRET_KEY (for subscriptions)
STRIPE_WEBHOOK_SECRET (for subscriptions)
STRIPE_PREMIUM_PRICE_ID (for subscriptions)
STRIPE_PREMIUM_PRODUCT_ID (for subscriptions)
```

### Netlify Environment Variables (Frontend)
```
VITE_API_URL=https://your-railway-url.up.railway.app/api
```

---

## 🚀 Deployment Workflow

1. **Deploy Backend First** (Railway)
   - Set up environment variables
   - Get Railway URL
   - Verify backend is running

2. **Deploy Frontend** (Netlify)
   - Set `VITE_API_URL` to Railway URL
   - Get Netlify URL

3. **Update Backend CORS**
   - Add Netlify URL to `ALLOWED_ORIGINS`
   - Update `CLIENT_URL`

4. **Set Up Stripe** (if using subscriptions)
   - Create products/prices in Stripe
   - Set up webhook endpoint
   - Add Stripe keys to Railway

5. **Test Everything**
   - Sign up/login
   - Search functionality
   - Favorites
   - Subscriptions (if enabled)

---

That's it! Your app should now be live and working. 🎉

