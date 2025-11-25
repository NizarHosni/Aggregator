// Backend API URL - can be overridden via environment variable
const BACKEND_BASE_URL = process.env.BACKEND_API_URL || 'https://physician-search-api-production.up.railway.app';

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

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

  try {
    // Fix the double API path issue - ensure clean path
    let cleanPath = path;
    
    // Remove leading /api/ or /api if present
    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.substring(5);
    } else if (cleanPath.startsWith('/api')) {
      cleanPath = cleanPath.substring(4);
    }
    
    // Ensure path starts with /
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    // Construct backend URL with single /api
    const backendURL = `${BACKEND_BASE_URL}/api${cleanPath}`;
    
    console.log(`[api-proxy] ${event.httpMethod} ${path} -> ${backendURL}`);

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

    // Add body for POST, PUT, PATCH requests
    if (event.body && ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
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
      
      // Get response data
      const contentType = response.headers.get('content-type') || '';
      let data;
      
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Return response with proper status code
      return {
        statusCode: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': contentType || 'application/json',
        },
        body: typeof data === 'string' ? data : JSON.stringify(data),
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
            message: 'Backend server did not respond in time',
            suggestion: 'Please try again later or check backend service status'
          }),
        };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[api-proxy] Error:', error);
    console.error('[api-proxy] Backend URL:', BACKEND_BASE_URL);
    console.error('[api-proxy] Path:', path);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to connect to backend server';
    let suggestion = 'Check backend service status';
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        errorMessage = 'Backend server is not reachable';
        suggestion = 'Please check if the backend service is running';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Backend server did not respond in time';
        suggestion = 'Please try again later';
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
        suggestion,
        backendUrl: BACKEND_BASE_URL,
        path: path,
      }),
    };
  }
};
