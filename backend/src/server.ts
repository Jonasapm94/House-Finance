import { buildApp } from './app';

const PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);

async function start(): Promise<void> {
  const app = await buildApp({ logger: true });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`Server running on http://0.0.0.0:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
