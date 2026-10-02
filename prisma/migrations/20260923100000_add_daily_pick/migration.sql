-- CreateTable
CREATE TABLE "DailyPick" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "heroPhotoId" TEXT,
    "heroPhotoManual" BOOLEAN NOT NULL DEFAULT false,
    "phraseId" TEXT,
    CONSTRAINT "DailyPick_heroPhotoId_fkey" FOREIGN KEY ("heroPhotoId") REFERENCES "HeroPhoto" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailyPick_phraseId_fkey" FOREIGN KEY ("phraseId") REFERENCES "Phrase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
