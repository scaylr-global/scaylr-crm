# Portable container image — works on Fly.io, Railway, a VPS, or any Docker host.
FROM node:20-bookworm-slim

# Build tools in case better-sqlite3 needs to compile from source.
RUN apt-get update && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Install server + client deps and build the React frontend.
RUN npm run build:deploy

ENV PORT=4000
# Point at a mounted volume in production so data persists:
ENV DB_PATH=/data/scaylr.db
EXPOSE 4000

CMD ["npm", "start"]
