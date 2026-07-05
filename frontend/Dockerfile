# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine

# Default backend upstream; override with BACKEND_URL env at runtime.
ENV BACKEND_URL=http://backend:8000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
