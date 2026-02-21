/*
this is the entry point that starts the http server.
it binds the express app to a port and handles graceful shutdown.
*/

import { createApp } from './app';
import { closeDatabase } from './db/connection';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[server] taiv fleet health server running on port ${PORT}`);
});

// close the db connection and stop accepting new requests on shutdown signals
function shutdown(signal: string): void {
  console.log(`[server] received ${signal}, shutting down gracefully`);
  server.close(() => {
    closeDatabase();
    console.log('[server] shutdown complete');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
