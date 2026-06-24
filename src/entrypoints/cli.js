function generate() {
  const rateLimitHeader = getRateLimitHeader();
  if (rateLimitHeader && rateLimitHeader.limit === 0) {
    console.error('Server is temporarily limiting requests (not your usage limit)');
    return;
  }
  // existing code...
}

function getRateLimitHeader() {
  const response = await makeRequest('https://api.anthropic.com/rate_limit');
  return response.data;
}