import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PokRoom } from './room.js';
import { PokerRoom } from './poker-room.js';
import { SpyfallRoom } from './spyfall-room.js';
import { OldMaidRoom } from './oldmaid-room.js';
import { WhoAmIRoom } from './whoami-room.js';
import { LiarRoom } from './liar-room.js';

// Colyseus routes matchmaking first, then delegates normal HTTP requests to Express.
const httpServer = createServer();
const production = process.env.NODE_ENV === 'production';
// npm runs workspace scripts from apps/server.
const clientDist = resolve(process.cwd(), process.env.CLIENT_DIST || '../client/dist');
if (production && !existsSync(resolve(clientDist, 'index.html'))) {
  throw new Error('Client build is missing. Run npm run build before npm start.');
}
const server = new Server({
  transport: new WebSocketTransport({
    server: httpServer, maxPayload: 4096, pingInterval: 10000,
  }),
  express: app => {
    app.disable('x-powered-by');
    app.get('/health', (_request, response) => response.json({ status: 'ok' }));
    if (production) {
      app.use('/assets', express.static(resolve(clientDist, 'assets'), {
        immutable: true, maxAge: '1y', dotfiles: 'deny',
      }));
      app.use('/images', express.static(resolve(clientDist, 'images'), {
        maxAge: 0, dotfiles: 'deny',
        setHeaders(response, path) {
          if (/-v\d+\.(?:webp|png|avif|jpg|svg)$/.test(path)) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }));
      app.use(express.static(clientDist, { maxAge: 0, dotfiles: 'deny' }));
      // Only application routes receive the SPA; missing assets and APIs stay 404.
      app.get(/^\/(?:games\/?|(?:rooms|play|poker|spyfall|oldmaid|whoami|liar)(?:\/.*)?)?$/, (_request, response) => {
        response.set('Cache-Control', 'no-cache');
        response.sendFile(resolve(clientDist, 'index.html'));
      });
    }
    app.use((_request, response) => response.status(404).json({ error: 'Not found' }));
  },
});
server.define('pok', PokRoom);
server.define('poker', PokerRoom);
server.define('spyfall', SpyfallRoom);
server.define('oldmaid', OldMaidRoom);
server.define('whoami', WhoAmIRoom);
server.define('liar', LiarRoom);
const port = Number(process.env.PORT ?? 2567);
await server.listen(port, '0.0.0.0');
console.log(`Wong Sian server listening on port ${port}`);
