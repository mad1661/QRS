// Bootstrap admins. Keep in sync with superAdminEmails() in firestore.rules.
export const SUPERADMIN_EMAILS: readonly string[] = [
  "REPLACE_WITH_SUPERADMIN_EMAIL",
];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && SUPERADMIN_EMAILS.includes(email);
}

export type AccountStatus = "pending" | "approved" | "denied";
