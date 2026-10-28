# Production image: compiled JS and production dependencies only.
# docker-compose overrides the command with `start:dev` for local development.

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production MODE=PROD
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8000
CMD ["node", "dist/main"]
