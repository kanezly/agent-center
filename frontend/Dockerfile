# AgentCenter Frontend Dockerfile
# NOTE: This Dockerfile requires the frontend/lib directory to be present.
# Run npm install locally first to generate required files, or mount the complete source.
FROM node:20-alpine AS builder

WORKDIR /app

# Configure npm to use Tencent Cloud mirror
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_DOMAIN=http://localhost:8010

# Set environment variables for build time
ENV NEXT_PUBLIC_API_DOMAIN=${NEXT_PUBLIC_API_DOMAIN}

# Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code (including lib/ directory with API clients, hooks, state, utils, constants)
COPY frontend/ .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Configure npm to use Tencent Cloud mirror
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_DOMAIN=http://localhost:8010

# Set environment variables for runtime
ENV NEXT_PUBLIC_API_DOMAIN=${NEXT_PUBLIC_API_DOMAIN}

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
