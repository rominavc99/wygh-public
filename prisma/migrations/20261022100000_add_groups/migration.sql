-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("groupId", "userId"),
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResponseGroup" (
    "responseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    PRIMARY KEY ("responseId", "groupId"),
    CONSTRAINT "ResponseGroup_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResponseGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_inviteToken_key" ON "Group"("inviteToken");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "ResponseGroup_groupId_idx" ON "ResponseGroup"("groupId");


-- Grupo inicial: todo lo que ya existía (usuarios y respuestas) queda en
-- él, así que nada cambia para nadie hasta que se cree otro grupo. Toma el
-- nombre actual del boletín si ya hay Settings.
INSERT INTO "Group" ("id", "name")
VALUES ('grupo-inicial', COALESCE((SELECT "newsletterName" FROM "Settings" WHERE "id" = 1), 'De regreso a casa'));

INSERT INTO "GroupMember" ("groupId", "userId")
SELECT 'grupo-inicial', "id" FROM "User";

INSERT INTO "ResponseGroup" ("responseId", "groupId")
SELECT "id", 'grupo-inicial' FROM "Response";
