# Setup Verification Checklist

## ✅ Backend Status
- **Railway Backend**: `https://physician-search-api-production.up.railway.app`
- **Health Check**: ✅ OK (`/api/health` returns `{"status":"ok"}`)

## ✅ Frontend Configuration
- **Netlify Site**: `https://yodoc.netlify.app`
- **Netlify Function**: `api-proxy.js` configured correctly
- **Backend URL**: Set in `netlify.toml` and `api-proxy.js`

## 🔍 Railway Environment Variables Checklist

Make sure these are set in your Railway dashboard:

### Required Variables:
- ✅ `DATABASE_URL` - Your Neon database connection string
- ✅ `JWT_SECRET` - Random secret string for JWT tokens
- ✅ `OPENAI_API_KEY` - Your OpenAI API key
- ✅ `GOOGLE_PLACES_API_KEY` - Your Google Places API key
- ✅ `PORT` - Usually Railway sets this automatically (default: 3001)

### CORS Configuration:
- ✅ `ALLOWED_ORIGINS` - Optional, but recommended:
  ```
  https://yodoc.netlify.app,http://localhost:5173,http://localhost:3000
  ```
  
  **Note**: The backend code already includes `https://yodoc.netlify.app` in default origins, so this is optional unless you want to add more domains.

### Admin Access:
- ✅ `ADMIN_EMAILS` - Comma-separated list of admin email addresses:
  ```
  admin@example.com,owner@example.com
  ```

## 🔍 Netlify Environment Variables Checklist

In Netlify Dashboard → Site settings → Environment variables:

- ✅ `BACKEND_API_URL` - Should be: `https://physician-search-api-production.up.railway.app`
  - **Note**: This is already set in `netlify.toml`, but you can override it here if needed
- ✅ `VITE_API_URL` - Should be: `https://physician-search-api-production.up.railway.app`
  - **Note**: This is already set in `netlify.toml` for build-time

## 🧪 Testing Checklist

1. **Backend Health**: ✅ Verified
   ```bash
   curl https://physician-search-api-production.up.railway.app/api/health
   # Should return: {"status":"ok"}
   ```

2. **Netlify Function Health**:
   Visit: `https://yodoc.netlify.app/.netlify/functions/health`
   Should return: `{"status":"ok","timestamp":"...","service":"YoDoc API Gateway"}`

3. **Auth Endpoint** (after signing in):
   The `/auth/me` endpoint should work through the proxy

4. **CORS Test**:
   - Open browser console on `https://yodoc.netlify.app`
   - Try to make an API request
   - Should not see CORS errors

## 🐛 Troubleshooting

### If you still see 502 errors:

1. **Check Railway Logs**:
   - Go to Railway dashboard → Your service → Logs
   - Look for startup errors or connection issues

2. **Check Netlify Function Logs**:
   - Go to Netlify dashboard → Functions → api-proxy → Logs
   - Look for connection errors or timeout issues

3. **Verify Environment Variables**:
   - Railway: All required variables are set
   - Netlify: `BACKEND_API_URL` is set (or using default)

4. **Test Direct Connection**:
   ```bash
   curl https://physician-search-api-production.up.railway.app/api/auth/me \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Common Issues:

- **502 Bad Gateway**: Backend is down or unreachable
- **CORS Errors**: Backend `ALLOWED_ORIGINS` doesn't include your Netlify URL
- **401 Unauthorized**: JWT token expired or invalid
- **504 Gateway Timeout**: Backend taking too long to respond (>25 seconds)

## ✅ Current Status

- ✅ Backend is running and healthy
- ✅ Frontend is configured correctly
- ✅ CORS allows Netlify frontend
- ✅ Netlify function proxy is set up
- ✅ Error handling is improved

Everything should be working now! 🎉

