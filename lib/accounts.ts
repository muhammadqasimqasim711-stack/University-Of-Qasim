import { hashPassword, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { roleForCredentials, type SessionIdentity } from "@/lib/session";

const ADMIN_CONFIGURATION_ID = 1;

export async function accountForStudent(
  rollNumber: string,
  email?: string,
  password?: string,
): Promise<SessionIdentity | null> {
  const name = rollNumber.trim();
  if (!name) {
    return null;
  }

  const student = await prisma.student.findUnique({
    where: { rollNumber: name },
  });
  if (!student) {
    return null;
  }

  if (student.status !== "ACTIVE") {
    return null;
  }

  if (email !== undefined) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || student.email.trim().toLowerCase() !== trimmedEmail) {
      return null;
    }
  }

  if (password !== undefined) {
    if (!password) {
      return null;
    }
    if (!student.passwordHash) {
      // If legacy record without password hash, initialize their password
      await prisma.student.update({
        where: { id: student.id },
        data: { passwordHash: hashPassword(password) },
      });
    } else if (!verifyPassword(password, student.passwordHash)) {
      return null;
    }
  }

  return { role: "student", studentId: student.id };
}

export async function accountForTeacher(
  employeeId: string,
  email?: string,
  password?: string,
): Promise<SessionIdentity | null> {
  const name = employeeId.trim();
  if (!name) {
    return null;
  }

  const teacher = await prisma.teacher.findUnique({
    where: { employeeId: name },
  });
  if (!teacher) {
    return null;
  }

  if (teacher.status !== "ACTIVE") {
    return null;
  }

  if (email !== undefined) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || teacher.email.trim().toLowerCase() !== trimmedEmail) {
      return null;
    }
  }

  if (password !== undefined) {
    if (!password) {
      return null;
    }
    if (!teacher.passwordHash) {
      // If legacy record without password hash, initialize their password
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { passwordHash: hashPassword(password) },
      });
    } else if (!verifyPassword(password, teacher.passwordHash)) {
      return null;
    }
  }

  return { role: "teacher", teacherId: teacher.id };
}

export async function accountForAdmin(
  username: string,
  password: string,
): Promise<SessionIdentity | null> {
  const adminUsername = process.env.ADMIN_USERNAME ?? "";
  if (adminUsername && username === adminUsername) {
    const rows = await prisma.$queryRaw<Array<{ adminPasswordHash: string | null }>>`
      SELECT adminPasswordHash FROM MasterConfiguration WHERE id = ${ADMIN_CONFIGURATION_ID}
    `;
    const adminPasswordHash = rows[0]?.adminPasswordHash ?? "";
    if (adminPasswordHash) {
      return verifyPassword(password, adminPasswordHash) ? { role: "admin" } : null;
    }
  }

  const role = roleForCredentials(username, password);
  if (role) {
    return { role };
  }
  return null;
}

export async function accountForCredentials(
  username: string,
  password = "",
  email?: string,
): Promise<SessionIdentity | null> {
  if (password) {
    const adminAccount = await accountForAdmin(username, password);
    if (adminAccount) {
      return adminAccount;
    }
  }

  const studentAccount = await accountForStudent(username, email, password);
  if (studentAccount) {
    return studentAccount;
  }

  const teacherAccount = await accountForTeacher(username, email, password);
  if (teacherAccount) {
    return teacherAccount;
  }

  return null;
}

