-- Boletín de cumpleaños y resumen semanal por grupo. Lo enviado antes queda
-- en el grupo inicial.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklySummarySend" (
    "groupId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,

    PRIMARY KEY ("groupId", "weekStart"),
    CONSTRAINT "WeeklySummarySend_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WeeklySummarySend" ("groupId", "error", "recipientCount", "sentAt", "status", "weekEnd", "weekStart") SELECT 'grupo-inicial', "error", "recipientCount", "sentAt", "status", "weekEnd", "weekStart" FROM "WeeklySummarySend";
DROP TABLE "WeeklySummarySend";
ALTER TABLE "new_WeeklySummarySend" RENAME TO "WeeklySummarySend";
CREATE TABLE "new_BirthdayNewsletter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "heroPhotoId" TEXT,
    "heroPhotoManual" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "sentAt" DATETIME,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "momentCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "greetingTemplate" TEXT NOT NULL DEFAULT '',
    "heroJson" TEXT NOT NULL DEFAULT '',
    "momentsJson" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BirthdayNewsletter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BirthdayNewsletter_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BirthdayNewsletter_heroPhotoId_fkey" FOREIGN KEY ("heroPhotoId") REFERENCES "HeroPhoto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BirthdayNewsletter" ("groupId", "contentHtml", "contentText", "createdAt", "date", "error", "greetingTemplate", "heroJson", "heroPhotoId", "heroPhotoManual", "id", "momentCount", "momentsJson", "recipientCount", "sentAt", "status", "userId") SELECT 'grupo-inicial', "contentHtml", "contentText", "createdAt", "date", "error", "greetingTemplate", "heroJson", "heroPhotoId", "heroPhotoManual", "id", "momentCount", "momentsJson", "recipientCount", "sentAt", "status", "userId" FROM "BirthdayNewsletter";
DROP TABLE "BirthdayNewsletter";
ALTER TABLE "new_BirthdayNewsletter" RENAME TO "BirthdayNewsletter";
CREATE UNIQUE INDEX "BirthdayNewsletter_userId_groupId_date_key" ON "BirthdayNewsletter"("userId", "groupId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- La migración de grupos dejó como fecha de entrada al grupo inicial el
-- momento de la migración; para las estadísticas, quien ya estaba entró
-- cuando lo dieron de alta.
UPDATE "GroupMember"
SET "joinedAt" = (SELECT u."createdAt" FROM "User" u WHERE u."id" = "GroupMember"."userId")
WHERE "groupId" = 'grupo-inicial'
  AND "joinedAt" <= datetime((SELECT "createdAt" FROM "Group" WHERE "id" = 'grupo-inicial'), '+1 minute');
