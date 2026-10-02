import Fastify from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";

const app = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

app.get(
  "/health",
  {
    schema: {
      response: {
        200: Type.Object({
          status: Type.Literal("ok"),
        }),
      },
    },
  },
  async () => ({ status: "ok" as const }),
);

const port = Number(process.env.PORT ?? 4000);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
