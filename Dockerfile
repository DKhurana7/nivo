FROM node:22.22-bookworm-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && npm run check:server
FROM node:22.22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=127.0.0.1 PORT=8787 DATABASE_PATH=/app/data/nivo.sqlite
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/lib ./src/lib
COPY package.json ./
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
CMD ["node", "--import", "tsx", "server/index.ts"]
