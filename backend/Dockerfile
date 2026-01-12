# ---- Base image ----
FROM node:20-alpine

# ---- Set working directory ----
WORKDIR /app

# ---- Install dependencies first (better caching) ----
COPY package*.json ./
RUN npm ci

# ---- Copy source code ----
COPY . .

# ---- Build TypeScript ----
RUN npm run build

# ---- Expose port (Koyeb uses $PORT internally) ----
EXPOSE 3000

# ---- Start server ----
CMD ["node", "dist/index.js"]
