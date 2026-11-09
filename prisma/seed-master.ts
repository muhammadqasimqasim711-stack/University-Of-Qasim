import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ACADEMIC_STRUCTURE: Record<string, string[]> = {
  "Computer Science": [
    "BS Computer Science",
    "BS Artificial Intelligence",
    "BS Software Engineering",
    "BS Data Science",
    "BS Information Technology",
  ],
  Biology: [
    "DPT",
    "BS Biotechnology",
    "BS Microbiology",
    "BS Biochemistry",
    "BS Botany",
    "BS Zoology",
    "BS Chemistry",
  ],
  Engineering: [
    "BS Mathematics",
    "BS Electrical Engineering",
    "BS Mechanical Engineering",
    "BS Civil Engineering",
  ],
  "Management Sciences": [
    "BBA",
    "BS Accounting & Finance",
    "BS Economics",
    "BS Commerce",
  ],
  "Social Sciences & Humanities": [
    "BS English",
    "BS Psychology",
    "BS International Relations",
    "BS Media Studies",
  ],
};

const SEMESTERS = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8",
  "Semester 9",
  "Semester 10",
  "Semester 11",
  "Semester 12",
];

const BATCH_SESSIONS = [
  "2022-2027",
  "2023-2028",
  "2024-2029",
  "2025-2030",
  "2026-2031",
  "2027-2032",
];

const DESIGNATIONS = [
  "Lecturer",
  "Assistant Professor",
  "Associate Professor",
  "Professor",
  "Visiting Faculty",
  "Head of Department (HOD)",
  "Dean",
  "Lab Instructor",
];

async function main() {
  console.log("🌱 Seeding master configuration data...\n");

  // 1. Seed Departments + Programs
  for (const [deptName, programs] of Object.entries(ACADEMIC_STRUCTURE)) {
    const dept = await prisma.department.upsert({
      where: { name: deptName },
      update: {},
      create: { name: deptName },
    });
    console.log(`  ✅ Department: ${dept.name} (id=${dept.id})`);

    for (const progName of programs) {
      await prisma.program.upsert({
        where: { name_departmentId: { name: progName, departmentId: dept.id } },
        update: {},
        create: { name: progName, departmentId: dept.id },
      });
      console.log(`     📘 Program: ${progName}`);
    }
  }

  // 2. Seed Semesters
  console.log("");
  for (const name of SEMESTERS) {
    await prisma.semester.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✅ Semester: ${name}`);
  }

  // 3. Seed Batch Sessions
  console.log("");
  for (const name of BATCH_SESSIONS) {
    await prisma.batchSession.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✅ Batch Session: ${name}`);
  }

  // 4. Seed Designations
  console.log("");
  for (const title of DESIGNATIONS) {
    await prisma.designation.upsert({
      where: { title },
      update: {},
      create: { title },
    });
    console.log(`  ✅ Designation: ${title}`);
  }

  console.log("\n🎉 Master configuration seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
