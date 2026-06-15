# Portable container image — works on Fly.io, Railway, a VPS, or any Docker host.
FROM node:20-bookworm-slim

WORKDIR /app
COPY . .

# Install server + client deps and build the React frontend.
RUN npm run build:deploy

ENV PORT=4000
# In production set DATABASE_URL (a Postgres connection string, e.g. Neon) so
# the app uses Postgres. Without it, the app falls back to embedded PGlite.
EXPOSE 4000

CMD ["npm", "start"]
