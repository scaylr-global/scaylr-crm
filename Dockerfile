# Portable container image — works on Fly.io, Railway, a VPS, or any Docker host.
# Mount a persistent volume at /data so SQLite survives restarts.
FROM node:20-bookworm-slim

# better-sqlite3 needs a C++ compiler at build time
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Install server + client deps and build the React frontend.
RUN npm run build:deploy

ENV PORT=4000
# Point DB_PATH at your mounted volume so data persists across redeploys.
# e.g.  docker run -v scaylr-data:/data -e DB_PATH=/data/scaylr.db ...
ENV DB_PATH=/data/scaylr.db
# Set ANTHROPIC_API_KEY at runtime for AI features.
EXPOSE 4000

CMD ["npm", "start"]
