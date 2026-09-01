FROM node:22.16-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps apps
COPY packages packages
RUN if [ -f package-lock.json ]; then npm ci --include-workspace-root --workspace=@spheric/api --workspace=@spheric/db --workspace=@spheric/shared; else npm install --include-workspace-root --workspace=@spheric/api --workspace=@spheric/db --workspace=@spheric/shared; fi
RUN npm run build -w @spheric/shared && npm run build -w @spheric/db && npm run build -w @spheric/api

FROM node:22.16-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["node","apps/api/dist/server.js"]
