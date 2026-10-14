FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY scripts/setup-ocr.mjs ./scripts/setup-ocr.mjs
RUN DATA_DIR=/opt/aigak-assets node scripts/setup-ocr.mjs
COPY . .
RUN npm run build
ENV NODE_ENV=production HOST=0.0.0.0 BROWSER_CHANNEL="" DATA_DIR=/app/data
CMD ["node", "--import", "tsx", "server/index.ts"]
