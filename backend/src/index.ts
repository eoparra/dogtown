import { app, enforceProductionSecurityGuards } from './app.js';
import { prisma } from './db.js';
import { config } from './config.js';

const PORT = config.PORT || 3001;

async function start() {
  await enforceProductionSecurityGuards();
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Server closed.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
