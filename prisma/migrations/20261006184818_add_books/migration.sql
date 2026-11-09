-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorName" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "edition" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "bookName" TEXT NOT NULL,
    "subName" TEXT NOT NULL DEFAULT '',
    "barcode" TEXT NOT NULL,
    "bookInformation" TEXT NOT NULL DEFAULT '',
    "imagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_barcode_key" ON "Book"("barcode");
