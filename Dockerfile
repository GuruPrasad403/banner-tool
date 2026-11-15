# Banner Validator & Screenshot Tool — production image (e.g. for Render)
# Single service: Express API + Puppeteer backend, serving the built
# dashboard from dist/ (see the production block in src/server.js).
FROM node:22-bookworm-slim

# System libraries required by the Chromium build that Puppeteer downloads
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer caching). Puppeteer's postinstall
# downloads its Chromium build into the image.
COPY package.json package-lock.json ./
RUN npm ci

# App source + production frontend build
COPY . .
RUN npm run build

ENV NODE_ENV=production

# Render (and most hosts) inject PORT; server.js falls back to 3001 locally.
CMD ["node", "src/server.js"]
