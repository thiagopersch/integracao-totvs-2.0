FROM node:20-alpine AS base
RUN corepack enable && corepack prepare npm@latest --activate
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma

FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM base AS production
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
