# Deployment Guide

## Frontend (Netlify)

Your frontend is already deployed to Netlify at `https://aiaggregator.netlify.app`.

### Environment Variables for Netlify

Add these in your Netlify dashboard (Site settings → Environment variables):

```
VITE_API_URL=https://your-backend-url.com/api
```

## Backend Deployment

The backend needs to be deployed to a server. Here are your options:

### Option 1: Deploy to Railway (Recommended - Easy)

1. Go to https://railway.app/
2. Sign up/login
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will auto-detect it's a Node.js project
6. Add environment variables in Railway dashboard:
   ```
   DATABASE_URL=your_neon_database_url
   JWT_SECRET=your-random-secret-key
   OPENAI_API_KEY=sk-...
   GOOGLE_PLACES_API_KEY=AIza...
   PORT=3001
   ALLOWED_ORIGINS=https://aiaggregator.netlify.app,http://localhost:5173
   NODE_ENV=production
   ```
7. Railway will give you a URL like `https://your-app.railway.app`
8. Update Netlify's `VITE_API_URL` to point to this URL

### Option 2: Deploy to Render

1. Go to https://render.com/
2. Create a new "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm run dev:server` or `npx tsx server/index.ts`
5. Add environment variables (same as Railway)
6. Get your URL and update Netlify

### Option 3: Deploy to Fly.io

1. Install Fly CLI: `npm install -g @fly/cli`
2. Run `fly launch` in your project
3. Add secrets: `fly secrets set DATABASE_URL=... JWT_SECRET=...`
4. Deploy: `fly deploy`

### Option 4: Deploy to VPS (DigitalOcean, AWS EC2, etc.)

1. Set up a server with Node.js
2. Clone your repo
3. Install dependencies: `npm install`
4. Use PM2 to run: `pm2 start server/index.ts --interpreter tsx`
5. Set up nginx as reverse proxy
6. Configure environment variables

## Environment Variables Summary

### Backend (.env or hosting platform)
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-random-secret-key
OPENAI_API_KEY=sk-...
GOOGLE_PLACES_API_KEY=AIza...
PORT=3001
ALLOWED_ORIGINS=https://aiaggregator.netlify.app,http://localhost:5173
NODE_ENV=production
```

### Frontend (Netlify Environment Variables)
```
VITE_API_URL=https://your-backend-url.com/api
```

## Quick Fix for Current Issue

Since your frontend is on Netlify but backend is still localhost, you have two options:

1. **Temporary**: Update your local `.env` to include Netlify origin:
   ```
   ALLOWED_ORIGINS=https://aiaggregator.netlify.app,http://localhost:5173
   ```
   Then restart your server. But this only works if your localhost server is accessible from the internet (use ngrok or similar).

2. **Proper**: Deploy the backend to Railway/Render/Fly.io and update Netlify's `VITE_API_URL`.

## Testing Locally After Deployment

1. Keep `VITE_API_URL=http://localhost:3001/api` for local development
2. Netlify will use the production `VITE_API_URL` from environment variables

