const makeRequest = async (url, options) => {
  const headers = {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': '1643723900'
  };
  const response = await fetch(url, {
    headers
  });
  if (response.ok) {
    return response.json();
  } else {
    const error = await response.json();
    if (error.error.type === 'rate_limit_error') {
      console.log('Server is temporarily limiting requests (not your usage limit)');
      return;
    }
    throw error;
  }
};

const generate = async () => {
  try {
    const response = await makeRequest('https://api.anthropic.com/endpoint', {});
    console.log(response);
  } catch (error) {
    console.error(error);
  }
};

generate();