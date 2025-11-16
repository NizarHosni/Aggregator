# Railway Environment Variables Setup Guide

## ⚠️ Common Error

If you see this error:
```
ERROR: invalid key-value pair "= OPENAI_API_KEY=\"sk-...\"": empty key
```

**This means you're pasting the variable in the wrong format!**

## ✅ Correct Way to Add Variables in Railway

Railway has **two separate fields** for each environment variable:
1. **Key** field (variable name)
2. **Value** field (variable value)

### Step-by-Step:

1. Go to your Railway project dashboard
2. Click on the **"Variables"** tab
3. Click **"New Variable"** button
4. You'll see two fields:
   - **Key**: Type the variable name (e.g., `OPENAI_API_KEY`)
   - **Value**: Type the variable value (e.g., `sk-proj-...`)
5. Click **"Add"**
6. Repeat for each variable

### ❌ WRONG Way (This causes the error):
```
Pasting this in one field:
OPENAI_API_KEY=sk-proj-...
```

### ✅ CORRECT Way:
```
Key field:   OPENAI_API_KEY
Value field: sk-proj-...your-actual-key-here...
```

**Note**: Never commit API keys to GitHub! Always use environment variables.

## Required Variables

Add these variables one by one in Railway:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon database connection string |
| `JWT_SECRET` | Any random string (e.g., `my-secret-key-123`) |
| `OPENAI_API_KEY` | Your OpenAI API key (starts with `sk-`) |
| `GOOGLE_PLACES_API_KEY` | Your Google Places API key (starts with `AIza`) |
| `PORT` | `3001` |
| `ALLOWED_ORIGINS` | `https://aiaggregator.netlify.app,http://localhost:5173` |
| `NODE_ENV` | `production` |

## Tips

- **No quotes needed**: Railway handles quotes automatically, just paste the raw value
- **No spaces**: Make sure there are no spaces before/after the `=` if copying from somewhere
- **One at a time**: Add each variable separately, don't try to paste multiple at once
- **Case sensitive**: Variable names are case-sensitive, use exact names shown above

## After Adding Variables

1. Railway will automatically redeploy your service
2. Check the "Deployments" tab to see the build progress
3. Once deployed, you'll get a URL like `https://your-app.railway.app`
4. Test it: `https://your-app.railway.app/api/health` should return `{"status":"ok"}`

