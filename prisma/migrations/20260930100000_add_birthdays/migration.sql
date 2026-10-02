-- AlterTable
ALTER TABLE "User" ADD COLUMN "birthday" TEXT;
ALTER TABLE "User" ADD COLUMN "birthdayPromptDismissed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "birthdayEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "birthdaySendTime" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "Settings" ADD COLUMN "birthdayGreetingTemplate" TEXT NOT NULL DEFAULT 'Hola, {nombre}, hoy celebramos a alguien importante:';
ALTER TABLE "Settings" ADD COLUMN "birthdayHeroTitle" TEXT NOT NULL DEFAULT 'FELIZ CUMPLEAÑOS {NOMBRE}. LOS IMPORTANTES TE DESEAN LO MEJOR';
ALTER TABLE "Settings" ADD COLUMN "birthdayHeroParagraph" TEXT NOT NULL DEFAULT 'Hoy es el cumpleaños de {nombre}. Agradecemos todos los momentos contigo, y esperamos que te lo pases muy bien hoy (y siempre).';
ALTER TABLE "Settings" ADD COLUMN "birthdayTopTitle" TEXT NOT NULL DEFAULT 'Top 5 momentos que tuviste al llegar a tu casa en este último año';

-- CreateTable
CREATE TABLE "BirthdayNewsletter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BirthdayNewsletter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BirthdayNewsletter_heroPhotoId_fkey" FOREIGN KEY ("heroPhotoId") REFERENCES "HeroPhoto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BirthdayNewsletter_userId_date_key" ON "BirthdayNewsletter"("userId", "date");
