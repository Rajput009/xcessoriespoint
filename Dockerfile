# syntax=docker/dockerfile:1

FROM node:20-bookworm

# better-sqlite3 native build + Playwright runtime libs (kept for safety even if
# the chromium download is skipped at install time)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    XP_DB_PATH=/data/store.db \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 4173
CMD ["node", "server/index.mjs"]
