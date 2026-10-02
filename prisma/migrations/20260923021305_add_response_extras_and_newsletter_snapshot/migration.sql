-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NewsletterSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "greetingTemplate" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_NewsletterSend" ("date", "error", "id", "recipientCount", "responseCount", "sentAt", "status") SELECT "date", "error", "id", "recipientCount", "responseCount", "sentAt", "status" FROM "NewsletterSend";
DROP TABLE "NewsletterSend";
ALTER TABLE "new_NewsletterSend" RENAME TO "NewsletterSend";
CREATE UNIQUE INDEX "NewsletterSend_date_key" ON "NewsletterSend"("date");
CREATE TABLE "new_Response" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "atHome" BOOLEAN NOT NULL,
    "homePlan" TEXT,
    "awayPlan" TEXT,
    "stayedHome" BOOLEAN NOT NULL DEFAULT false,
    "tonightPlan" TEXT,
    "food" TEXT NOT NULL,
    "goingOut" BOOLEAN NOT NULL,
    "goingOutWhere" TEXT,
    "note" TEXT,
    "photoFilename" TEXT,
    "photoDescription" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Response" ("atHome", "awayPlan", "createdAt", "date", "food", "goingOut", "goingOutWhere", "homePlan", "id", "note", "updatedAt", "userId") SELECT "atHome", "awayPlan", "createdAt", "date", "food", "goingOut", "goingOutWhere", "homePlan", "id", "note", "updatedAt", "userId" FROM "Response";
DROP TABLE "Response";
ALTER TABLE "new_Response" RENAME TO "Response";
CREATE UNIQUE INDEX "Response_userId_date_key" ON "Response"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
