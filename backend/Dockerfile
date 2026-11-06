# ================================
# Stage 1: Development
# ================================
FROM node:22-alpine AS development

WORKDIR /app

# Install OpenSSL (dibutuhkan oleh Prisma)
RUN apk add --no-cache openssl

# Copy package files dan install dependencies
COPY package*.json ./
RUN npm install

# Copy seluruh source code
COPY . .

# Generate Prisma client di dalam container
RUN npx prisma generate

EXPOSE 5000

CMD ["npm", "run", "dev"]

# ================================
# Stage 2: Production
# ================================
FROM node:22-alpine AS production

WORKDIR /app

# Install OpenSSL (dibutuhkan oleh Prisma)
RUN apk add --no-cache openssl

# Hanya install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Buat folder uploads
RUN mkdir -p uploads

EXPOSE 5000

CMD ["npm", "run", "start"]
