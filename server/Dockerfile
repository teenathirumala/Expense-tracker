# syntax=docker/dockerfile:1
# ---------- Stage 1: install production dependencies ----------
# A separate stage, so the final image only gets the finished node_modules,
# not npm's download cache or anything else left over from installing.
FROM node:20-alpine AS deps
WORKDIR /app

# Copy ONLY the package files first. Docker caches each step, so as long as these
# two files don't change, the slow `npm ci` step is reused on the next build,
# even when your code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 2: the image that actually runs ----------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

# Don't run as root: if someone broke into the app, they'd have fewer permissions.
# The official Node image comes with a ready-made "node" user.
USER node

ENV PORT=5001
EXPOSE 5001

# Docker checks this every 30s and marks the container healthy or unhealthy.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "index.js"]