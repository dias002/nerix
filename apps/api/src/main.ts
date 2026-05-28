import { config } from "./config.js";
import { createApp } from "./server/create-app.js";

const app = await createApp({
  logger: true,
});

await app.listen({
  port: config.API_PORT,
  host: "127.0.0.1",
});
