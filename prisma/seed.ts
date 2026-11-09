import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.masterConfiguration.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      libraryName: "University of Qasim",
      borrowingPeriodDays: 14,
      maxBooksPerStudent: 3,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
