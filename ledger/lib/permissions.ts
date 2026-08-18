import type { Role } from "./types";

// The single source of truth for "what can this role do" on the client side
// — used to decide what to show/hide/disable in the UI. This is a UX layer,
// not the security boundary: the real enforcement lives in firestore.rules,
// which encode the same matrix at the database level (see the comment block
// at the top of firestore.rules). If the two ever disagree, the rules win
// and the person just sees a failed write with a Firestore permission
// error — this file existing keeps that from being the normal experience.
//
// Deliberately coarse: Owner and Manager are treated identically almost
// everywhere except delete, team management, settings and payroll — the
// hard line in this app is Staff vs. everyone else, because Staff is the
// role handed to someone the business hasn't built years of trust with yet.

export type Permission =
  | "view:dashboard"
  | "view:reports" // profitability, statements, balance sheet
  | "view:payroll" // employees page (pay rates)
  | "view:settings"
  | "view:team"
  | "view:auditLog"
  | "view:products" // full product records, including cost prices
  | "view:catalog" // cost-stripped product list (name/price only)
  | "manage:products" // create/edit/delete products, purchases, purchase orders
  | "manage:sales" // create/edit sales
  | "delete:sales"
  | "manage:expenses"
  | "delete:records" // purchases, expenses, capital entries, loans, purchase orders
  | "manage:loans"
  | "manage:employees"
  | "manage:capital"
  | "manage:team" // invite/deactivate/change roles
  | "manage:settings"
  | "manage:notifications" // create/read/dismiss notifications
  | "create:sale" // the one thing every role can do
  | "create:cashCount"
  | "create:receivablePayment"
  | "view:receivables";

const OWNER_MANAGER_SHARED: Permission[] = [
  "view:dashboard",
  "view:reports",
  "view:products",
  "manage:products",
  "manage:sales",
  "manage:expenses",
  "manage:loans",
  "manage:capital",
  "manage:notifications",
  "create:sale",
  "create:cashCount",
  "create:receivablePayment",
  "view:receivables",
];

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    ...OWNER_MANAGER_SHARED,
    "view:payroll",
    "view:settings",
    "view:team",
    "view:auditLog",
    "delete:sales",
    "delete:records",
    "manage:employees",
    "manage:team",
    "manage:settings",
  ],
  manager: [...OWNER_MANAGER_SHARED],
  staff: ["view:catalog", "create:sale", "create:cashCount", "create:receivablePayment"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

export function roleLabel(role: Role): string {
  return { owner: "Owner", manager: "Manager", staff: "Staff" }[role];
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full access. Only the owner can manage the team, change settings, view the audit log, or delete records.",
  manager: "Can run day-to-day operations — sales, stock, expenses, orders — but can't delete records, see payroll, manage the team, or change settings.",
  staff: "Can log sales, record customer payments, and count cash at the end of a shift. Can't edit or delete anything once saved, and can't see cost prices, other reports, or payroll.",
};
