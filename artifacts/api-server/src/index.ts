import app from "./app";
import { logger } from "./lib/logger";

// Render injects PORT automatically; default to 10000 (Render's standard port)
// so the server starts correctly in all environments.
const rawPort = process.env["PORT"] ?? "10000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
