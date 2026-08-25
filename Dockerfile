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

# Ensure the DB mount point exists AND is writable by the runtime user —
# Railway mounts volumes root-owned, and the non-root `node` user needs to
# create/write store.db inside it
RUN mkdir -p /data && chown -R node:node /data

# NODE_ENV is deliberately NOT set to production here, otherwise `npm ci`
# would skip devDependencies (vite, tailwind, etc.) and the build would fail.
ENV XP_DB_PATH=/data/store.db \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Drop dev dependencies (vite, tailwind, typescript, ...) from the final image
RUN npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 4173
# Run as the non-root node user — the app only writes to /data (volume) and tmp
USER node
CMD ["node", "server/index.mjs"]
