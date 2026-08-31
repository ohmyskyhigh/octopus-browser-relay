import { createRelayApplication } from './bootstrap.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const application = createRelayApplication(config);

let stopping = false;
async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  application.logger.info({ signal }, 'Stopping relay');
  try {
    await application.stop();
    process.exitCode = 0;
  } catch (error) {
    application.logger.error({ error }, 'Relay shutdown failed');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

try {
  await application.start();
} catch (error) {
  application.logger.fatal({ error }, 'Relay startup failed');
  try {
    application.store.close();
  } catch {
    // Ignore close errors after failed startup.
  }
  process.exitCode = 1;
}
