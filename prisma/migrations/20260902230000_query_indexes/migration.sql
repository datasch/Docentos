-- Indices para las consultas de mentoria que hasta ahora recorrian la tabla completa.
-- MentorshipComment se filtra siempre por video (hilos raiz) o por comentario padre
-- (respuestas), y MenteeAssignment por mentor cuando un MENTOR consulta su cartera.

CREATE INDEX IF NOT EXISTS "MentorshipComment_videoId_parentId_createdAt_idx"
  ON "MentorshipComment" ("videoId", "parentId", "createdAt");

CREATE INDEX IF NOT EXISTS "MentorshipComment_parentId_createdAt_idx"
  ON "MentorshipComment" ("parentId", "createdAt");

CREATE INDEX IF NOT EXISTS "MentorshipComment_userId_idx"
  ON "MentorshipComment" ("userId");

CREATE INDEX IF NOT EXISTS "MenteeAssignment_mentorId_idx"
  ON "MenteeAssignment" ("mentorId");

CREATE INDEX IF NOT EXISTS "MenteeAssignment_mentorId_courseId_status_idx"
  ON "MenteeAssignment" ("mentorId", "courseId", "status");
