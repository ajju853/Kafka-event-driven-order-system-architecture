FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src/ ./shared/src/
COPY services/notification-service/ ./services/notification-service/

RUN npm ci
RUN npm run build --workspace=shared
RUN npm run build --workspace=services/notification-service

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/notification-service/dist ./dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/notification-service/package.json ./
EXPOSE 4003
CMD ["node", "dist/index.js"]
