FROM node:18-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy packages
COPY packages/backend ./packages/backend
COPY packages/common ./packages/common

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build backend
RUN pnpm --filter @yacc-inbox/backend build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only production files
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000

CMD ["node", "dist/index.js"]
