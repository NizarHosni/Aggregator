// Simplified API Proxy - Hardcoded backend URL to eliminate env issues
const BACKEND_BASE_URL = 'https://physician-search-api-production.up.railway.app';

exports.handler = async (event) => {
  console.log('[api-proxy] Called:', event.httpMethod, event.queryStringParameters?.path);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Get path from query parameter
  const { path } = event.queryStringParameters || {};

  if (!path) {
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Missing path parameter' }),
    };
  }

  try {
    // Clean path - remove leading slash if present, remove /api prefix if present
    let cleanPath = path;
    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.substring(5);
    } else if (cleanPath.startsWith('/api')) {
      cleanPath = cleanPath.substring(4);
    } else if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    // Construct backend URL
    const backendURL = `${BACKEND_BASE_URL}/api/${cleanPath}`;

    console.log('[api-proxy] Proxying to:', backendURL);

    // Prepare request options
    const options = {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Forward Authorization header if present
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader) {
      options.headers['Authorization'] = authHeader;
    }

    // Add body for non-GET requests
    if (event.body && event.httpMethod !== 'GET') {
      options.body = event.body;
    }

    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(backendURL, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Get response data
      const contentType = response.headers.get('content-type') || '';
      let data;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Return successful response
      return {
        statusCode: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType || 'application/json',
        },
        body: typeof data === 'string' ? data : JSON.stringify(data),
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('[api-proxy] Request timeout');
        // Return 200 to prevent frontend crashes
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request timeout',
            message: 'Service is taking longer than expected. Please try again.',
          }),
        };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[api-proxy] Error:', error);
    console.error('[api-proxy] Path:', path);

    // RETURN 200 TO PREVENT FRONTEND CRASHES
    // Always return 200 with error in body instead of 502
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'Please try again in a few moments',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
