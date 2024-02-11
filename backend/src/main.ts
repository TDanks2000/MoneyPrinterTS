import path from 'node:path';
const env_path = path.join(__dirname, '../../.env');
require('dotenv').config({ path: env_path });

import cors from '@fastify/cors';
import Fastify from 'fastify';
import { routes } from './routes';

const fastify = Fastify({
  logger: true,
});

fastify.register(cors, {
  origin: '*',
  methods: 'GET',
});

fastify.register(routes, { prefix: '/api' });

fastify.listen({ port: 3000 }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});
