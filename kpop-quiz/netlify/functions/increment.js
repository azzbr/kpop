exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get current counter from environment variable
    let totalTests = parseInt(process.env.KPOP_QUIZ_TOTAL_TESTS || '0');

    // Increment the counter
    totalTests += 1;

    // Note: In a production environment, you would update a persistent storage
    // For now, we'll return the incremented value
    // To make this persistent, you can:
    // 1. Use Netlify's KV storage (if available in your plan)
    // 2. Use a database service like PlanetScale or Supabase
    // 3. Use Netlify's build hooks to update environment variables

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ totalTests }),
    };
  } catch (error) {
    console.error('Error in increment function:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
