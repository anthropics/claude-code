FROM node:18-alpine

WORKDIR /app

# Install the latest version globally
RUN npm install -g @upstash/context7-mcp@latest

# Default command to run the server
CMD ["context7-mcp"]
