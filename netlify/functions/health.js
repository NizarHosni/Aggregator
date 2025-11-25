// Health check endpoint for Netlify functions
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'YoDoc API Gateway',
      version: '1.0.0'
    }),
  };
};

