-- AlterTable
ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CommentMention" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    PRIMARY KEY ("commentId", "userId"),
    CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
