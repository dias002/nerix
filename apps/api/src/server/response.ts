import type { FastifyReply } from "fastify";
import type { Result } from "../domain/result.js";

export function sendResult<T>(reply: FastifyReply, result: Result<T>) {
  if (result.ok) {
    return reply.send(result.value);
  }

  return reply.status(result.error.statusCode).send({
    error: {
      code: result.error.code,
      message: result.error.message,
    },
  });
}

