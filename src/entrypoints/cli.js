function makeRequest(options) {
  const { headers, ...rest } = options;
  const response = await fetch(options.url, {
    headers: {
      ...headers,
      'Anthropic-Client-Id': 'YOUR_CLIENT_ID',
      'Anthropic-Client-Secret': 'YOUR_CLIENT_SECRET'
    },
    ...rest
  });
  if (response.ok) {
    return response.json();
  } else if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
      return makeRequest(options);
    } else {
      throw new Error('Rate limit exceeded');
    }
  } else {
    throw new Error(`Error: ${response.status} ${response.statusText}`);
  }
}
