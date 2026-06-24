const axios = require('axios');

const rateLimitHeader = 'X-RateLimit-Limit';
const rateLimitRemainingHeader = 'X-RateLimit-Remaining';

axios.interceptors.push(
  new axiosInterceptor({
    request: (config) => {
      if (config.headers && config.headers[rateLimitHeader] && config.headers[rateLimitRemainingHeader] && parseInt(config.headers[rateLimitRemainingHeader]) <= 0) {
        throw new Error(`Rate limited. Limit: ${config.headers[rateLimitHeader]}, Remaining: ${config.headers[rateLimitRemainingHeader]}`);
      }
      return config;
    }
  })
);

// ... rest of the code remains the same ...