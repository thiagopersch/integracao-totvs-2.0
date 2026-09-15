FROM node:20-alpine AS base
RUN corepack enable && corepack prepare npm@latest --activate
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Chromium do Alpine para o playwright-core (Teste de Ficha PS / automação de navegador) —
# playwright-core não baixa Chromium embutido, então aponta para o binário do sistema via
# PLAYWRIGHT_CHROMIUM_PATH. O Chromium do Alpine (musl) não é o binário oficial do Playwright,
# mas é o padrão conhecido de contorno em imagens Alpine (mesmo usado com Puppeteer).
FROM base AS chromium-base
RUN apk add --no-cache chromium nss freetype freetype-dev harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium-browser

FROM chromium-base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npm run build

FROM chromium-base AS production
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
