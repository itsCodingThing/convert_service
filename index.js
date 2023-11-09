import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";

import app from "./app/app.js";
import { config } from "./utils/utils.js";
import { errorHandler } from "./utils/errorHandler.js";

const fastify = Fastify({
    bodyLimit: 314572800,
    logger: true,
});

fastify.register(cors);
fastify.register(helmet);
fastify.register(multipart);

fastify.register(app, { prefix: "api" });
fastify.setErrorHandler(errorHandler);

// start server
fastify.listen({ port: config.server.port, host: config.server.host });
