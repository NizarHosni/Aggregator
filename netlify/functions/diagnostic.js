// Diagnostic endpoint for troubleshooting
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      node_version: process.version,
      backend_url: process.env.BACKEND_API_URL || 'not set',
      service: 'YoDoc API Gateway',
      version: '1.0.0',
    }),
  };
};

