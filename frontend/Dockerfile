# RAGI web — Created by Arnold Rurangwa / Arnova Group
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG RAGI_API_ORIGIN=http://api:8410
ENV RAGI_API_ORIGIN=$RAGI_API_ORIGIN NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
USER node
EXPOSE 3410
CMD ["npx", "next", "start", "-p", "3410"]
