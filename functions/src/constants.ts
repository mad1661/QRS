/**
 * Bootstrap superadmins. Keep in sync with:
 *   - src/lib/constants.ts (SUPERADMIN_EMAILS)
 *   - firestore.rules (superAdminEmails())
 */
export const SUPERADMIN_EMAILS: readonly string[] = ["mad1661@gmail.com"];

export function isSuperAdminEmail(email: string | undefined | null): boolean {
  return !!email && SUPERADMIN_EMAILS.includes(email.toLowerCase());
}
