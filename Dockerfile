FROM node:22.12.0-alpine

# Set working directory
WORKDIR /app

# Copy package files and build configuration for better layer caching
COPY package*.json ./
COPY tsconfig*.json ./
COPY esbuild.config.ts ./

# Install all dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the TypeScript application with esbuild
RUN npm run build

# The server uses stdio transport, so no port exposure needed
CMD ["node", "dist/index.js"]
