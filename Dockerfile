# ---- Builder stage ----
FROM node:24-alpine AS builder
WORKDIR /app

# Enable corepack & install pnpm
RUN corepack enable pnpm && corepack use pnpm@latest-10

# Copy only dependency files first (better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts && pnpm store prune

# Copy source and build
COPY . .
RUN pnpm build


# ---- Runtime stage ----
FROM node:24-alpine AS runtime
WORKDIR /app


# Copy only built app + required files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "dist/main"]
