FROM node:22.16-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps apps
COPY packages packages
RUN if [ -f package-lock.json ]; then npm ci --include-workspace-root --workspace=@spheric/web; else npm install --include-workspace-root --workspace=@spheric/web; fi
RUN npm run build -w @spheric/web

FROM node:22.16-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node","apps/web/server.js"]
