-- CreateTable
CREATE TABLE "MasterConfiguration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "libraryName" TEXT NOT NULL,
    "borrowingPeriodDays" INTEGER NOT NULL,
    "maxBooksPerStudent" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
