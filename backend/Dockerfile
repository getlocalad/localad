FROM node:20-alpine

# Build-Kontext = Repo-Root (Railway baut ab dort)
WORKDIR /app/backend

# Abhaengigkeiten (Pfad relativ zu Repo-Root)
COPY backend/package.json ./
RUN npm install --omit=dev

# Backend-Quellcode
COPY backend/src/ ./src/

# Dashboard – statisch vom Express ausgeliefert
# server.js: resolve(__dirname, '../../dashboard')
# __dirname = /app/backend/src → ../../dashboard = /app/dashboard
COPY dashboard/ /app/dashboard/

EXPOSE 3000

CMD ["node", "src/server.js"]
