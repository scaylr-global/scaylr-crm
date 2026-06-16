import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import './db/index.js';
import { seedIfEmpty } from './db/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import leadRoutes from './routes/leads.js';
import callRoutes from './routes/calls.js';
import followupRoutes from './routes/followups.js';
import targetRoutes from './routes/targets.js';
import activityRoutes from './routes/activity.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';

// Seed default data on first run
seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/followups', followupRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

// In production, serve the built React frontend from the same server so the
// whole app lives on one origin (no Vite proxy needed). The client's /api
// calls are relative, so they hit the routes above automatically.
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-/api route returns index.html for client-side routing.
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\nScaylr CRM running on http://localhost:${PORT}`);
  console.log(clientDist && fs.existsSync(clientDist) ? 'Serving built frontend ✓' : 'API only (no client build found)');
});
