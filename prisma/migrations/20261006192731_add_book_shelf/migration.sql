-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorName" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "edition" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "bookName" TEXT NOT NULL,
    "subName" TEXT NOT NULL DEFAULT '',
    "shelf" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT NOT NULL,
    "bookInformation" TEXT NOT NULL DEFAULT '',
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Book" ("authorName", "barcode", "bookInformation", "bookName", "category", "createdAt", "edition", "id", "imagePath", "publisher", "subName") SELECT "authorName", "barcode", "bookInformation", "bookName", "category", "createdAt", "edition", "id", "imagePath", "publisher", "subName" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE UNIQUE INDEX "Book_barcode_key" ON "Book"("barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
