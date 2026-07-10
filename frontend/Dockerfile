# Stage 1: Build the React app
FROM node:24-alpine AS build

WORKDIR /app

# Copy package files first for better caching
# Use a glob so both `package.json` and `package-lock.json` are included reliably
COPY package*.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the app (output goes to /app/dist)
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built files from the builder stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy entrypoint script that will generate a runtime env-config.js
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy a custom nginx config if you need SPA routing
# (optional, see note below)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]