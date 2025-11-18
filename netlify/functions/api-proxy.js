// Backend API URL
const BACKEND_BASE_URL = 'https://physician-search-api-production.up.railway.app';

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

    // Make request to backend
    const response = await fetch(backendURL, fetchOptions);
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
  } catch (error) {
    console.error('[api-proxy] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch from backend',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

