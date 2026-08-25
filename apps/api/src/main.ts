import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp({
  corsOrigin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
  serviceName: env.API_SERVICE_NAME,
  version: env.API_VERSION,
});

const server = createServer(app);

server.listen(env.PORT, () => {
  console.log(`API server listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; closing API server`);
  server.close((error) => {
    if (error) {
      console.error('API server shutdown failed', error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
