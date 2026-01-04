# Render.com Deployment Guide

## Quick Fix for "vite: not found" Error

This error occurs when Render tries to run `npm run build` (which runs `vite build` for the frontend), but we're only deploying the **backend** to Render.

## Solution

### Option 1: Manual Configuration (If service was created manually)

1. Go to your Render service dashboard
2. Click **Settings** tab
3. Scroll to **Build & Deploy** section
4. Set **Build Command**: `npm install`
5. Set **Start Command**: `npm run start:dev`
6. Click **Save Changes**
7. Trigger a new deployment

### Option 2: Use Render Blueprint (Recommended)

1. Delete your existing manual service (if any)
2. In Render Dashboard, click **New +** → **Blueprint**
3. Connect your GitHub repository
4. Render will automatically read `render.yaml` and configure everything
5. Set environment variables in the dashboard
6. Deploy!

## Why This Works

- **Build Command**: `npm install` - Only installs dependencies, doesn't build frontend
- **Start Command**: `npm run start:dev` - Runs TypeScript directly using `tsx` (which is in dependencies)
- **No Vite**: Frontend build (`vite build`) is NOT executed on Render
- **Frontend**: Deployed separately on Netlify

## Configuration Details

- **Backend**: Render.com (TypeScript with tsx)
- **Frontend**: Netlify (Vite build)
- **Database**: Neon PostgreSQL (connection string in env vars)
- **Health Check**: `/api/health`
- **Port**: Auto-set by Render (uses `process.env.PORT`)

## Environment Variables

Set these in Render dashboard under your service's **Environment** tab:

- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - Authentication secret
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_PLACES_API_KEY` - Google Places API key
- `STRIPE_SECRET_KEY` - (Optional) Stripe secret key
- `NODE_ENV` - Set to `production`

See `render.yaml` for complete list of environment variables.

