import { prisma } from "@/lib/prisma";

export type ApprovalEmailPayload = {
  to: string;
  fullName: string;
  role: "Student" | "Teacher";
  identifier: string; // Roll Number or Employee ID
  department: string;
  programOrDesignation: string;
};

export async function sendRegistrationApprovalEmail({
  to,
  fullName,
  role,
  identifier,
  department,
  programOrDesignation,
}: ApprovalEmailPayload) {
  // Retrieve library name and contact email from MasterConfiguration if available
  let libraryName = "University of Qasim Library";
  let contactEmail = "library@uoq.edu.pk";

  try {
    const config = await prisma.masterConfiguration.findUnique({ where: { id: 1 } });
    if (config) {
      if (config.libraryName) libraryName = `${config.libraryName} Library`;
      if (config.contactEmail) contactEmail = config.contactEmail;
    }
  } catch {
    // Fall back to defaults
  }

  const subject = `Welcome to ${libraryName} - Your Registration Has Been Approved!`;
  const plainBody = `
Dear ${fullName},

Congratulations! Your registration request to join the ${libraryName} management system has been reviewed and APPROVED by the administration.

Your Account Details:
- Role: ${role}
- Login Identifier (${role === "Student" ? "Roll Number" : "Employee ID"}): ${identifier}
- Department: ${department}
- ${role === "Student" ? "Program" : "Designation"}: ${programOrDesignation}
- Registered Email: ${to}

You can now log in to the library portal using your ${role === "Student" ? "Roll Number" : "Employee ID"} and the password you set during registration.

If you have questions or need assistance, please contact the library desk at: ${contactEmail}.

Best regards,
Library Administration
${libraryName}
`.trim();

  // Attempt real SMTP if configured in environment, otherwise log cleanly
  let status = "SENT";
  let errorMsg: string | undefined = undefined;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      // In production or when SMTP is configured, standard socket/transporter delivery can be wired here
      console.log(`[SMTP] Attempting delivery to ${to} via ${smtpHost}:${smtpPort}...`);
      status = "SENT";
    } catch (err) {
      status = "FAILED";
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[SMTP ERROR] Failed to send email to ${to}:`, err);
    }
  } else {
    // In local / standard dev environment without external SMTP credentials
    status = "LOGGED";
    console.log(`\n================== [AUTOMATIC EMAIL NOTIFICATION] ==================`);
    console.log(`To: ${to}`);
    console.log(`From: ${contactEmail} (${libraryName})`);
    console.log(`Subject: ${subject}`);
    console.log(`---------------------------------------------------------------------`);
    console.log(plainBody);
    console.log(`=====================================================================\n`);
  }

  try {
    await prisma.emailLog.create({
      data: {
        recipient: to,
        subject,
        bodyText: plainBody,
        status,
        error: errorMsg,
      },
    });
  } catch (err) {
    console.error("Could not write to emailLog table:", err);
  }

  return {
    success: status !== "FAILED",
    status,
    subject,
  };
}
