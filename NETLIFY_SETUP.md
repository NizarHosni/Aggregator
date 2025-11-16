# Netlify Setup Guide

## Current Issue
Your frontend is deployed to Netlify but it's trying to connect to `localhost:3001`, which doesn't exist on the internet. You need to:

1. **Deploy your backend** to a hosting service (Railway, Render, etc.)
2. **Set the environment variable** in Netlify to point to your deployed backend

## Step-by-Step Fix

### Step 1: Deploy Backend (Choose One)

#### Option A: Railway (Easiest)
1. Go to https://railway.app/
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `WissalNyati/Aggregator` repository
5. Railway will auto-detect it's a Node.js project
6. In the Railway dashboard, go to "Variables" tab and add:
   ```
   DATABASE_URL=your_neon_database_url
   JWT_SECRET=your-random-secret-key
   OPENAI_API_KEY=sk-...
   GOOGLE_PLACES_API_KEY=AIza...
   PORT=3001
   ALLOWED_ORIGINS=https://aiaggregator.netlify.app,http://localhost:5173
   NODE_ENV=production
   ```
7. Railway will auto-deploy and give you a URL like: `https://your-app-name.railway.app`
8. **Copy this URL** - you'll need it for Step 2

#### Option B: Render
1. Go to https://render.com/
2. Sign up/login with GitHub
3. Click "New +" → "Web Service"
4. Connect your `WissalNyati/Aggregator` repository
5. Settings:
   - **Name**: physician-search-api (or any name)
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:server`
   - **Environment**: Node
6. Add environment variables - click "Add Environment Variable" for each:
   
   **Important**: Add each variable separately with Key and Value fields
   
   - **Key**: `DATABASE_URL` | **Value**: `your_neon_database_url`
   - **Key**: `JWT_SECRET` | **Value**: `your-random-secret-key`
   - **Key**: `OPENAI_API_KEY` | **Value**: `sk-proj-...` (just the value, no quotes)
   - **Key**: `GOOGLE_PLACES_API_KEY` | **Value**: `AIza...`
   - **Key**: `PORT` | **Value**: `3001`
   - **Key**: `ALLOWED_ORIGINS` | **Value**: `https://aiaggregator.netlify.app,http://localhost:5173`
   - **Key**: `NODE_ENV` | **Value**: `production`
7. Click "Create Web Service"
8. Render will give you a URL like: `https://your-app-name.onrender.com`
9. **Copy this URL** - you'll need it for Step 2

### Step 2: Configure Netlify Environment Variable

1. Go to your Netlify dashboard: https://app.netlify.com/
2. Select your site (`aiaggregator`)
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-backend-url.com/api` (use the URL from Step 1)
   
   Example:
   - If Railway: `https://your-app-name.railway.app/api`
   - If Render: `https://your-app-name.onrender.com/api`

6. Click **Save**

### Step 3: Redeploy Netlify Site

1. In Netlify dashboard, go to **Deploys** tab
2. Click **Trigger deploy** → **Clear cache and deploy site**
3. Wait for the deployment to complete

### Step 4: Test

1. Visit your Netlify site: `https://aiaggregator.netlify.app`
2. Try to sign up or sign in
3. The errors should be gone!

## Troubleshooting

### Still seeing `localhost:3001` errors?
- Make sure you added `VITE_API_URL` in Netlify (not just in `.env` file)
- Make sure you redeployed after adding the variable
- Check the browser console - the API_URL should show your backend URL, not localhost

### Backend not responding?
- Check your backend logs in Railway/Render dashboard
- Make sure `ALLOWED_ORIGINS` includes `https://aiaggregator.netlify.app`
- Test your backend directly: `https://your-backend-url.com/api/health`

### CORS errors?
- Make sure your backend's `ALLOWED_ORIGINS` includes your Netlify URL
- Restart your backend service after updating environment variables

## Quick Checklist

- [ ] Backend deployed to Railway/Render
- [ ] Backend URL copied
- [ ] `VITE_API_URL` set in Netlify environment variables
- [ ] Netlify site redeployed
- [ ] Tested sign up/sign in

## Note About Chrome Extension Errors

The errors like:
```
chrome-extension://... Uncaught SyntaxError: Unexpected token 'export'
```

These are from browser extensions (ad blockers, etc.) and can be **safely ignored**. They don't affect your app's functionality.

