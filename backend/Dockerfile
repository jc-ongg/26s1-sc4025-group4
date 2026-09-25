FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
RUN npm ci --workspace backend --include-workspace-root
COPY backend/download-model.mjs backend/download-model.mjs
RUN node backend/download-model.mjs
COPY backend backend
RUN npm run generate --workspace backend && npm run build --workspace backend
WORKDIR /app/backend
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm start"]
