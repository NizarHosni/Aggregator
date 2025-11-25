// Backend API URL - can be overridden via environment variable
const BACKEND_BASE_URL = process.env.BACKEND_API_URL || 'https://physician-search-api-production.up.railway.app';

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  try {
    // Get path from query parameter
    const { path } = event.queryStringParameters || {};
    
    if (!path) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Missing path parameter' }),
      };
    }

    // FIX THE DOUBLE API PATH - remove extra /api if present
    let cleanPath = path;
    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.substring(5); // Remove '/api/'
    } else if (cleanPath.startsWith('/api')) {
      cleanPath = cleanPath.substring(4); // Remove '/api'
    }
    
    // Ensure path starts with /
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    // Construct backend URL with single /api
    const backendURL = `${BACKEND_BASE_URL}/api${cleanPath}`;
    
    console.log(`[api-proxy] ${event.httpMethod} ${path} -> ${backendURL}`);
    console.log(`[api-proxy] Backend base URL: ${BACKEND_BASE_URL}`);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
    };

    // Forward Authorization header if present
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Prepare fetch options
    const fetchOptions = {
      method: event.httpMethod,
      headers,
    };

    // Add body for POST, PUT requests
    if (event.body && ['POST', 'PUT'].includes(event.httpMethod)) {
      fetchOptions.body = event.body;
    }

    // Make request to backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    try {
      const response = await fetch(backendURL, {
        ...fetchOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.text();
      
      // Try to parse as JSON
      let body;
      try {
        body = JSON.parse(data);
      } catch {
        body = data;
      }

      return {
        statusCode: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': response.headers.get('content-type') || 'application/json',
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('[api-proxy] Request timeout:', backendURL);
        return {
          statusCode: 504,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            error: 'Request timeout',
            message: 'Backend server did not respond in time'
          }),
        };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[api-proxy] Error:', error);
    console.error('[api-proxy] Error name:', error?.name);
    console.error('[api-proxy] Error message:', error?.message);
    console.error('[api-proxy] Backend URL:', BACKEND_BASE_URL);
    console.error('[api-proxy] Path:', event.queryStringParameters?.path);
    console.error('[api-proxy] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to connect to backend server';
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        errorMessage = 'Backend server is not reachable. Please check if the server is running.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Backend server did not respond in time.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      statusCode: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Bad Gateway',
        message: errorMessage,
        backendUrl: BACKEND_BASE_URL,
        path: event.queryStringParameters?.path,
        details: process.env.NODE_ENV === 'development' ? (error?.stack || JSON.stringify(error)) : undefined
      }),
    };
  }
};

