# Build Stage for Client
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Build Stage for Server
FROM node:18-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./

# Production Stage
FROM node:18-alpine
ENV NODE_ENV=production
WORKDIR /app

# Copy server files
COPY --from=server-builder /app/server /app/server
# Copy client build to the location server.js expects
COPY --from=client-builder /app/client/dist /app/client/dist

# Also need the root package.json if the start script is run from root, 
# but server.js is run from root via 'node server/server.js'. 
# Let's just install prod dependencies in server directly, which we did in server-builder, 
# but we need to make sure we run it from /app
COPY package.json ./

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 5001

# Start the server
CMD ["node", "server/server.js"]
