import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { tasksRouter } from './routes/tasks.router.js';
import { reportsRouter } from './routes/reports.router.js';
import { audioRouter } from './routes/audio.router.js';
import { eventsStreamRouter } from './routes/events-stream.router.js';
import { healthRouter } from './routes/health.router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  // Standard middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve static interactive prototype demo
  const prototypeDir = path.join(__dirname, 'prototype');
  app.use('/prototype', express.static(prototypeDir));

  // Root route renders the interactive prototype HTML demo
  app.get('/', (req, res) => {
    res.sendFile(path.join(prototypeDir, 'index.html'));
  });

  // API Routes
  app.use('/api', healthRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/audio', audioRouter);
  app.use('/api/events', eventsStreamRouter);

  return app;
}
