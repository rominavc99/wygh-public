-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "newsletterName" TEXT NOT NULL DEFAULT 'De regreso a casa',
    "tagline" TEXT NOT NULL DEFAULT 'Una nota diaria entre amigos',
    "greetingTemplate" TEXT NOT NULL DEFAULT 'Hola, {nombre}, esto es lo que estarán haciendo tus amigos el día de hoy:',
    "sendTime" TEXT NOT NULL DEFAULT '20:00',
    "autoSend" BOOLEAN NOT NULL DEFAULT true,
    "fromName" TEXT NOT NULL DEFAULT 'De regreso a casa',
    "fromEmail" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("autoSend", "fromEmail", "fromName", "id", "newsletterName", "sendTime", "tagline") SELECT "autoSend", "fromEmail", "fromName", "id", "newsletterName", "sendTime", "tagline" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
