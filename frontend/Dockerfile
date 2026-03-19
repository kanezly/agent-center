# AgentCenter Frontend Dockerfile
# Universal image - environment variables are injected at runtime
# Run npm install locally first to generate required files, or mount the complete source.
FROM node:20-alpine AS builder

WORKDIR /app

# Configure npm to use Tencent Cloud mirror
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code (including lib/ directory with API clients, hooks, state, utils, constants)
COPY frontend/ .

# Build application (no build-time env vars needed)
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Configure npm to use Tencent Cloud mirror
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# Runtime environment variables (defaults, can be overridden at container start)
ENV API_DOMAIN=http://localhost:8010
ENV WS_DOMAIN=ws://localhost:8010

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/types ./types
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/next.config.js .
COPY --from=builder /app/middleware.ts .
COPY --from=builder /app/tailwind.config.ts .

# Expose port
EXPOSE 3010

# Run the application
CMD ["npm", "start"]
