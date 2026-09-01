FROM node:22.16-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps apps
COPY packages packages
RUN if [ -f package-lock.json ]; then npm ci --include-workspace-root --workspace=@spheric/worker --workspace=@spheric/shared --workspace=@spheric/db --workspace=@spheric/connectors --workspace=@spheric/agents; else npm install --include-workspace-root --workspace=@spheric/worker --workspace=@spheric/shared --workspace=@spheric/db --workspace=@spheric/connectors --workspace=@spheric/agents; fi
RUN npm run build -w @spheric/shared && npm run build -w @spheric/db && npm run build -w @spheric/connectors && npm run build -w @spheric/agents && npm run build -w @spheric/worker

FROM node:22.16-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["node","apps/worker/dist/worker.js"]
