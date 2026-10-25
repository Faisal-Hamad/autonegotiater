FROM docker.io/library/node:22-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --include=dev --no-fund
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY frontend/app ./app
COPY frontend/components ./components
COPY frontend/lib ./lib
COPY frontend/public ./public
COPY frontend/next.config.ts frontend/tsconfig.json frontend/postcss.config.mjs ./
ENV NODE_ENV=production USE_MOCK_DATA=false AUTONEG_ISOLATED_DEMO_BUILD=false NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://autoneg-backend-web-r5:8000
RUN npm run build
FROM docker.io/library/node:22-alpine
WORKDIR /app
ENV NODE_ENV=production USE_MOCK_DATA=false AUTONEG_ISOLATED_DEMO_BUILD=false NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 API_INTERNAL_URL=http://autoneg-backend-web-r5:8000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node","server.js"]
