-- Ajustes del boletín por grupo, y envíos/recordatorios/portadas por grupo.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tagline" TEXT NOT NULL DEFAULT 'Una nota diaria entre amigos',
    "greetingTemplate" TEXT NOT NULL DEFAULT 'Hola, {nombre}, esto es lo que estarán haciendo tus amigos el día de hoy:',
    "sendTime" TEXT NOT NULL DEFAULT '20:00',
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "heroEnabled" BOOLEAN NOT NULL DEFAULT false,
    "heroTitle" TEXT NOT NULL DEFAULT '',
    "heroParagraph" TEXT NOT NULL DEFAULT '',
    "heroImageUrl" TEXT NOT NULL DEFAULT '',
    "heroLinkUrl" TEXT NOT NULL DEFAULT '',
    "heroLinkText" TEXT NOT NULL DEFAULT 'Leer más',
    "selectedPhraseId" TEXT NOT NULL DEFAULT ''
);
-- El grupo inicial hereda los ajustes del boletín que había en Settings;
-- cualquier otro grupo (o una instalación sin Settings) queda con los
-- valores por defecto.
INSERT INTO "new_Group" ("createdAt", "id", "inviteToken", "name", "suspended", "tagline", "greetingTemplate", "sendTime", "reminderEnabled", "heroEnabled", "heroTitle", "heroParagraph", "heroImageUrl", "heroLinkUrl", "heroLinkText", "selectedPhraseId")
SELECT g."createdAt", g."id", g."inviteToken", g."name", g."suspended",
    COALESCE(s."tagline", 'Una nota diaria entre amigos'),
    COALESCE(s."greetingTemplate", 'Hola, {nombre}, esto es lo que estarán haciendo tus amigos el día de hoy:'),
    COALESCE(s."sendTime", '20:00'),
    COALESCE(s."reminderEnabled", true),
    COALESCE(s."heroEnabled", false),
    COALESCE(s."heroTitle", ''),
    COALESCE(s."heroParagraph", ''),
    COALESCE(s."heroImageUrl", ''),
    COALESCE(s."heroLinkUrl", ''),
    COALESCE(s."heroLinkText", 'Leer más'),
    COALESCE(s."selectedPhraseId", '')
FROM "Group" g
LEFT JOIN "Settings" s ON s."id" = 1 AND g."id" = 'grupo-inicial';
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");
CREATE UNIQUE INDEX "Group_inviteToken_key" ON "Group"("inviteToken");
CREATE TABLE "new_DailyPick" (
    "groupId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "heroPhotoId" TEXT,
    "heroPhotoManual" BOOLEAN NOT NULL DEFAULT false,
    "phraseId" TEXT,

    PRIMARY KEY ("groupId", "date"),
    CONSTRAINT "DailyPick_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyPick_heroPhotoId_fkey" FOREIGN KEY ("heroPhotoId") REFERENCES "HeroPhoto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailyPick_phraseId_fkey" FOREIGN KEY ("phraseId") REFERENCES "Phrase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyPick" ("groupId", "date", "heroPhotoId", "heroPhotoManual", "phraseId") SELECT 'grupo-inicial', "date", "heroPhotoId", "heroPhotoManual", "phraseId" FROM "DailyPick";
DROP TABLE "DailyPick";
ALTER TABLE "new_DailyPick" RENAME TO "DailyPick";
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "newsletterName" TEXT NOT NULL DEFAULT 'De regreso a casa',
    "tagline" TEXT NOT NULL DEFAULT 'Una nota diaria entre amigos',
    "autoSend" BOOLEAN NOT NULL DEFAULT true,
    "fromName" TEXT NOT NULL DEFAULT 'De regreso a casa',
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "lockResponsesAfterSend" BOOLEAN NOT NULL DEFAULT true,
    "birthdayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "birthdaySendTime" TEXT NOT NULL DEFAULT '09:00',
    "birthdayGreetingTemplate" TEXT NOT NULL DEFAULT 'Hola, {nombre}, hoy celebramos a alguien importante:',
    "birthdayHeroTitle" TEXT NOT NULL DEFAULT 'FELIZ CUMPLEAÑOS {NOMBRE}. LOS IMPORTANTES TE DESEAN LO MEJOR',
    "birthdayHeroParagraph" TEXT NOT NULL DEFAULT 'Hoy es el cumpleaños de {nombre}. Agradecemos todos los momentos contigo, y esperamos que te lo pases muy bien hoy (y siempre).',
    "birthdayTopTitle" TEXT NOT NULL DEFAULT 'Top 5 momentos que tuviste al llegar a tu casa en este último año',
    "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummaryDay" INTEGER NOT NULL DEFAULT 1,
    "weeklySummaryTime" TEXT NOT NULL DEFAULT '10:00',
    "inactivityNudgeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inactivityNudgeDays" INTEGER NOT NULL DEFAULT 3,
    "inactivityNudgeTime" TEXT NOT NULL DEFAULT '12:00',
    "inactivityNudgeSubject" TEXT NOT NULL DEFAULT '¿Acaso eres demasiado importante para nosotros?',
    "inactivityNudgeTemplate" TEXT NOT NULL DEFAULT 'Tienes {dias} días sin enviar una respuesta al newsletter de los importantes. Eres un sándwich remojado 🥪',
    "extrasEmailTime" TEXT NOT NULL DEFAULT '11:00',
    "streakEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onThisDayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "anniversaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wrappedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "extraordinaryResponsesEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Settings" ("anniversaryEnabled", "autoSend", "birthdayEnabled", "birthdayGreetingTemplate", "birthdayHeroParagraph", "birthdayHeroTitle", "birthdaySendTime", "birthdayTopTitle", "extraordinaryResponsesEnabled", "extrasEmailTime", "fromEmail", "fromName", "id", "inactivityNudgeDays", "inactivityNudgeEnabled", "inactivityNudgeSubject", "inactivityNudgeTemplate", "inactivityNudgeTime", "lockResponsesAfterSend", "newsletterName", "onThisDayEnabled", "streakEmailEnabled", "tagline", "weeklySummaryDay", "weeklySummaryEnabled", "weeklySummaryTime", "welcomeEmailEnabled", "wrappedEnabled") SELECT "anniversaryEnabled", "autoSend", "birthdayEnabled", "birthdayGreetingTemplate", "birthdayHeroParagraph", "birthdayHeroTitle", "birthdaySendTime", "birthdayTopTitle", "extraordinaryResponsesEnabled", "extrasEmailTime", "fromEmail", "fromName", "id", "inactivityNudgeDays", "inactivityNudgeEnabled", "inactivityNudgeSubject", "inactivityNudgeTemplate", "inactivityNudgeTime", "lockResponsesAfterSend", "newsletterName", "onThisDayEnabled", "streakEmailEnabled", "tagline", "weeklySummaryDay", "weeklySummaryEnabled", "weeklySummaryTime", "welcomeEmailEnabled", "wrappedEnabled" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_ReminderSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,
    CONSTRAINT "ReminderSend_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReminderSend" ("groupId", "date", "id", "recipientCount", "sentAt") SELECT 'grupo-inicial', "date", "id", "recipientCount", "sentAt" FROM "ReminderSend";
DROP TABLE "ReminderSend";
ALTER TABLE "new_ReminderSend" RENAME TO "ReminderSend";
CREATE UNIQUE INDEX "ReminderSend_groupId_date_key" ON "ReminderSend"("groupId", "date");
CREATE TABLE "new_NewsletterSend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "contentText" TEXT NOT NULL DEFAULT '',
    "greetingTemplate" TEXT NOT NULL DEFAULT '',
    "heroJson" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "NewsletterSend_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_NewsletterSend" ("groupId", "archived", "contentHtml", "contentText", "date", "error", "greetingTemplate", "heroJson", "id", "recipientCount", "responseCount", "sentAt", "status") SELECT 'grupo-inicial', "archived", "contentHtml", "contentText", "date", "error", "greetingTemplate", "heroJson", "id", "recipientCount", "responseCount", "sentAt", "status" FROM "NewsletterSend";
DROP TABLE "NewsletterSend";
ALTER TABLE "new_NewsletterSend" RENAME TO "NewsletterSend";
CREATE INDEX "NewsletterSend_date_idx" ON "NewsletterSend"("date");
CREATE UNIQUE INDEX "NewsletterSend_groupId_date_key" ON "NewsletterSend"("groupId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

