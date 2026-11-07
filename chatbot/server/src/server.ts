import dotenv from 'dotenv';
import { createApp } from './app.js';
import { pgListenerService } from './services/events/pg-listener.service.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3120', 10);
const app = createApp();

async function startServer() {
  // 1. Start dedicated PostgreSQL LISTEN client singleton
  await pgListenerService.start();

  // 2. Start Express HTTP server
  const server = app.listen(PORT, () => {
    console.log(`[rpm_V1 Gateway] Server listening on http://localhost:${PORT}`);
    console.log(`[rpm_V1 Gateway] Interactive Prototype: http://localhost:${PORT}/prototype`);
    console.log(`[rpm_V1 Gateway] SSE Events Stream: http://localhost:${PORT}/api/events/stream`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[rpm_V1 Gateway] Shutting down gracefully...');
    await pgListenerService.shutdown();
    server.close(() => {
      console.log('[rpm_V1 Gateway] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[rpm_V1 Gateway] Startup failure:', err);
    process.exit(1);
  });
}
