-- Comentarios y reacciones por grupo. Lo que ya existía queda en el grupo de
-- su respuesta (el inicial, si la respuesta está ahí).
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Reaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reaction_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reaction" ("groupId", "createdAt", "emoji", "id", "kind", "responseId", "userId") SELECT COALESCE((SELECT rg."groupId" FROM "ResponseGroup" rg WHERE rg."responseId" = t."responseId" ORDER BY (rg."groupId" = 'grupo-inicial') DESC LIMIT 1), 'grupo-inicial'), t."createdAt", t."emoji", t."id", t."kind", t."responseId", t."userId" FROM "Reaction" t;
DROP TABLE "Reaction";
ALTER TABLE "new_Reaction" RENAME TO "Reaction";
CREATE UNIQUE INDEX "Reaction_responseId_groupId_userId_emoji_key" ON "Reaction"("responseId", "groupId", "userId", "emoji");
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "responseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "photoFilename" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME,
    "parentId" TEXT,
    CONSTRAINT "Comment_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Comment" ("groupId", "createdAt", "editedAt", "id", "parentId", "photoFilename", "responseId", "text", "userId") SELECT COALESCE((SELECT rg."groupId" FROM "ResponseGroup" rg WHERE rg."responseId" = t."responseId" ORDER BY (rg."groupId" = 'grupo-inicial') DESC LIMIT 1), 'grupo-inicial'), t."createdAt", t."editedAt", t."id", t."parentId", t."photoFilename", t."responseId", t."text", t."userId" FROM "Comment" t;
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE INDEX "Comment_responseId_groupId_idx" ON "Comment"("responseId", "groupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

