FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src/ ./shared/src/
COPY services/order-service/ ./services/order-service/

RUN npm ci
RUN npm run build --workspace=shared
RUN npm run build --workspace=services/order-service

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/order-service/dist ./dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/order-service/package.json ./
EXPOSE 4001
CMD ["node", "dist/index.js"]
