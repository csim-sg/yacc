FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci
RUN npm run build -w @yacc/common && npm run build -w @yacc/backend

FROM node:22-alpine AS production
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/package.json
COPY packages/common/package.json ./packages/common/package.json
COPY packages/frontend/package.json ./packages/frontend/package.json
COPY packages/frontend-angular/package.json ./packages/frontend-angular/package.json
RUN npm ci --omit=dev --workspace @yacc/backend
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/common ./packages/common
EXPOSE 3000
CMD ["node", "packages/backend/dist/index.js"]
