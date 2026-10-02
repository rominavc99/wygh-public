-- AlterTable
ALTER TABLE "Response" ADD COLUMN "phraseId" TEXT;
ALTER TABLE "Response" ADD COLUMN "phraseText" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HeroPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "description" TEXT,
    "date" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HeroPhoto_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HeroPhoto" ("createdAt", "date", "description", "filename", "id") SELECT "createdAt", "date", "description", "filename", "id" FROM "HeroPhoto";
DROP TABLE "HeroPhoto";
ALTER TABLE "new_HeroPhoto" RENAME TO "HeroPhoto";
CREATE UNIQUE INDEX "HeroPhoto_filename_key" ON "HeroPhoto"("filename");
CREATE TABLE "new_Phrase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "date" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Phrase_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Phrase" ("createdAt", "id", "text") SELECT "createdAt", "id", "text" FROM "Phrase";
DROP TABLE "Phrase";
ALTER TABLE "new_Phrase" RENAME TO "Phrase";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
