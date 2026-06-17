# ---- Stage 1: build the static assets ------------------------------------ #
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies (cached unless package files change).
COPY package*.json ./
RUN npm ci

# Vite inlines VITE_* vars at build time, so the backend URL must be present
# during `npm run build`. Provided via --build-arg / docker-compose args.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# ---- Stage 2: serve with nginx (lightweight) ----------------------------- #
FROM nginx:alpine AS runtime

# SPA-aware nginx config (client-side routing + gzip).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
