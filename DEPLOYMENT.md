# Deployment Guide

## Frontend (Netlify)

The frontend is deployed to Netlify. The `api-proxy` function will automatically be deployed when you push to GitHub.

### Netlify Function Setup

1. The function is located at `netlify/functions/api-proxy.js`
2. Netlify will automatically detect and deploy it
3. Make sure `netlify.toml` has the correct `functions.directory` setting (it does)

### Environment Variables in Netlify

Go to your Netlify dashboard → Site settings → Environment variables and set:

- `BACKEND_API_URL` - Your backend API URL (without `/api` suffix)
  - Example: `https://your-backend.up.railway.app`
  - Or: `https://your-backend.onrender.com`

## Backend Deployment Options

### Option 1: Deploy to Railway

1. Go to [Railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Select the repository
5. Railway will auto-detect the `railway.json` config
6. Add environment variables:
   - `DATABASE_URL` - Your Neon database connection string
   - `JWT_SECRET` - A random secret string for JWT tokens
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `GOOGLE_PLACES_API_KEY` - Your Google Places API key
   - `ALLOWED_ORIGINS` - `https://yodoc.netlify.app,https://your-site.netlify.app`
7. Railway will generate a URL like `https://your-app.up.railway.app`
8. Copy this URL and update `BACKEND_API_URL` in Netlify environment variables

### Option 2: Deploy to Render

1. Go to [Render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Render will use the `render.yaml` config
5. Add the same environment variables as above
6. Render will generate a URL like `https://your-app.onrender.com`
7. Update `BACKEND_API_URL` in Netlify environment variables

### Option 3: Deploy to Vercel (Serverless Functions)

You can also deploy the backend as Vercel serverless functions, but this requires restructuring the code.

## Testing the Backend

Once deployed, test the backend health endpoint:

```bash
curl https://your-backend-url.com/api/health
```

Should return: `{"status":"ok"}`

## Troubleshooting

### 502 Bad Gateway Error

This means the Netlify function can't reach your backend. Check:

1. **Backend is running**: Verify your backend service is active in Railway/Render dashboard
2. **Backend URL is correct**: Check `BACKEND_API_URL` in Netlify environment variables
3. **CORS is configured**: Make sure your backend allows requests from `https://yodoc.netlify.app`
4. **Environment variables**: Ensure all required env vars are set in your backend service

### Function Not Found

If the Netlify function doesn't appear:

1. Check that `netlify/functions/api-proxy.js` exists
2. Verify `netlify.toml` has `directory = "netlify/functions"`
3. Trigger a new deploy in Netlify dashboard

