-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "weeklySummaryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "weeklySummaryDay" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Settings" ADD COLUMN "weeklySummaryTime" TEXT NOT NULL DEFAULT '10:00';
ALTER TABLE "Settings" ADD COLUMN "inactivityNudgeEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "inactivityNudgeDays" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Settings" ADD COLUMN "inactivityNudgeTime" TEXT NOT NULL DEFAULT '12:00';
ALTER TABLE "Settings" ADD COLUMN "inactivityNudgeSubject" TEXT NOT NULL DEFAULT '¿Acaso eres demasiado importante para nosotros?';
ALTER TABLE "Settings" ADD COLUMN "inactivityNudgeTemplate" TEXT NOT NULL DEFAULT 'Tienes {dias} días sin enviar una respuesta al newsletter de los importantes. Eres un sándwich remojado 🥪';

-- CreateTable
CREATE TABLE "WeeklySummarySend" (
    "weekStart" TEXT NOT NULL PRIMARY KEY,
    "weekEnd" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "InactivityNudge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "missedDays" INTEGER NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InactivityNudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InactivityNudge_userId_date_key" ON "InactivityNudge"("userId", "date");
