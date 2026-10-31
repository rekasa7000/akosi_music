import type { FastifyInstance } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "typebox";
import { prisma } from "@akosi/database";
import { sendMail } from "../auth/mailer.js";

const FeedbackType = Type.Union([Type.Literal("ERROR"), Type.Literal("FEEDBACK")]);

const SubmitFeedbackBody = Type.Object({
  type: FeedbackType,
  message: Type.String({ minLength: 1, maxLength: 2000 }),
  contactEmail: Type.Optional(Type.String({ format: "email" })),
  releaseId: Type.Optional(Type.String()),
  trackId: Type.Optional(Type.String()),
});

const SubmitFeedbackResponse = Type.Object({ ok: Type.Literal(true) });

export async function publicFeedbackRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    "/feedback",
    {
      // Unauthenticated and open to anyone with the tap-landing page —
      // matches the rate limit already used on other public
      // credential/content-submitting routes (public-cards.ts).
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        body: SubmitFeedbackBody,
        response: { 200: SubmitFeedbackResponse },
      },
    },
    async (request, reply) => {
      const { type, message, contactEmail, releaseId, trackId } = request.body;

      await prisma.feedbackSubmission.create({
        data: { type, message, contactEmail, releaseId, trackId },
      });

      // Best-effort notification — the row above is the actual record
      // of the submission, so a flaky SMTP connection shouldn't fail
      // the fan's request. Single-admin assumption matches the rest of
      // this codebase (see "Deferred: Multiple admins" in
      // docs/12-admin-authentication.md). Skipped until the admin has
      // a verified real email — the bootstrap placeholder isn't one.
      try {
        const admin = await prisma.user.findFirst({
          where: { role: "ADMIN", emailVerifiedAt: { not: null } },
          select: { email: true },
        });
        if (admin) {
          await sendMail({
            to: admin.email,
            subject: type === "ERROR" ? "New error report" : "New feedback",
            text: [
              message,
              contactEmail ? `\nReply to: ${contactEmail}` : null,
              releaseId ? `Release: ${releaseId}` : null,
              trackId ? `Track: ${trackId}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          });
        }
      } catch (err) {
        app.log.error(err, "Failed to send feedback notification email");
      }

      reply.send({ ok: true as const });
    },
  );
}
