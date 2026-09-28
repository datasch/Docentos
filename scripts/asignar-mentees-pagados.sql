-- Asigna como mentee a quien se matriculo pagando desde la landing (pago ext:<pedido>)
-- y aun no tiene asignacion en ese curso. Mismo criterio que el alta: se respeta el
-- mentor que ya lo lleva; si no, la primera cuenta activa ADMIN o MENTOR.
-- Idempotente: volver a ejecutarlo no duplica nada.
INSERT INTO "MenteeAssignment" (id, "mentorId", "menteeId", "courseId", "totalVideosCount", "updatedAt")
SELECT gen_random_uuid()::text,
       COALESCE(
         (SELECT a."mentorId" FROM "MenteeAssignment" a WHERE a."menteeId" = p."userId" ORDER BY a."createdAt" LIMIT 1),
         (SELECT u.id FROM "User" u WHERE u.role IN ('ADMIN','MENTOR') AND u."isActive" ORDER BY u."createdAt" LIMIT 1)),
       p."userId", p."courseId",
       (SELECT count(*) FROM "VideoDriveLink" v JOIN "Module" m ON m.id = v."moduleId" WHERE m."courseId" = p."courseId"),
       NOW()
FROM (SELECT DISTINCT "userId", "courseId" FROM "Payment"
      WHERE "idempotencyKey" LIKE 'ext:%' AND status = 'COMPLETED') p
WHERE NOT EXISTS (SELECT 1 FROM "MenteeAssignment" a WHERE a."menteeId" = p."userId" AND a."courseId" = p."courseId")
RETURNING "menteeId", "courseId", "mentorId";
