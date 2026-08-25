"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { roleLabel, ROLE_DESCRIPTIONS } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { Badge, Button, Card, Field, Input, Label, Modal, PageHeader, Select, Table, EmptyState } from "@/components/ui";

const ROLES: Role[] = ["manager", "staff"]; // an invite can only ever offer manager or staff — owner is fixed at signup

export default function TeamPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner"]);
  const { businessId } = useAuth();
  const { members, invites, auditLog, createInvite, revokeInvite, changeMemberRole, setMemberActive } = useData();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);

  if (guardLoading || !allowed) return null;

  const activeMembers = members.filter((m) => m.active);
  const inactiveMembers = members.filter((m) => !m.active);
  const pendingInvites = invites.filter((i) => i.status === "pending");

  function inviteLink(inviteId: string) {
    if (typeof window === "undefined" || !businessId) return "";
    return `${window.location.origin}/join?biz=${businessId}&invite=${inviteId}`;
  }

  async function copyLink(inviteId: string) {
    const link = inviteLink(inviteId);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied", "Share it with them directly — WhatsApp, in person, however you'd normally reach them.");
    } catch {
      toast.info("Copy this link", link);
    }
  }

  return (
    <>
      <PageHeader title="Your Team" action={<Button onClick={() => setModalOpen(true)}>+ Invite someone</Button>} />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {(["owner", "manager", "staff"] as Role[]).map((r) => (
          <Card key={r}>
            <div className="text-sm font-medium">{roleLabel(r)}</div>
            <div className="text-xs text-muted mt-1">{ROLE_DESCRIPTIONS[r]}</div>
          </Card>
        ))}
      </div>

      {activeMembers.length === 0 ? (
        <EmptyState title="Just you so far" body="Invite a manager or staff member to give them their own login." />
      ) : (
        <Card className="mb-6">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Active</div>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Email</th>
                <th className="py-2 px-3 font-medium">Role</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{m.name}</td>
                  <td className="py-2.5 px-3 text-muted">{m.email}</td>
                  <td className="py-2.5 px-3">
                    {m.role === "owner" ? (
                      <Badge tone="amber">Owner</Badge>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          changeMemberRole(m.id, e.target.value as Role)
                            .then(() => toast.success("Role updated"))
                            .catch((err) => toast.error("Couldn't update role", toastableErrorMessage(err)))
                        }
                        className="bg-panel2 border border-line rounded-md px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {roleLabel(r)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                    {m.role !== "owner" && (
                      <button
                        onClick={() =>
                          setMemberActive(m.id, false)
                            .then(() => toast.success("Access removed"))
                            .catch((err) => toast.error("Couldn't remove access", toastableErrorMessage(err)))
                        }
                        className="text-xs text-muted hover:text-bad"
                      >
                        Remove access
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {pendingInvites.length > 0 && (
        <Card className="mb-6">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Pending invites</div>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Email</th>
                <th className="py-2 px-3 font-medium">Role</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((i) => (
                <tr key={i.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{i.name}</td>
                  <td className="py-2.5 px-3 text-muted">{i.email}</td>
                  <td className="py-2.5 px-3">
                    <Badge>{roleLabel(i.role)}</Badge>
                  </td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                    <button onClick={() => copyLink(i.id)} className="text-xs text-amber-soft hover:underline mr-3">
                      Copy link
                    </button>
                    <button
                      onClick={() =>
                        revokeInvite(i.id)
                          .then(() => toast.success("Invite revoked"))
                          .catch((err) => toast.error("Couldn't revoke invite", toastableErrorMessage(err)))
                      }
                      className="text-xs text-muted hover:text-bad"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {inactiveMembers.length > 0 && (
        <Card className="mb-6">
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Removed</div>
          <Table>
            <tbody>
              {inactiveMembers.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-muted">{m.name}</td>
                  <td className="py-2.5 px-3 text-muted">{m.email}</td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      onClick={() =>
                        setMemberActive(m.id, true)
                          .then(() => toast.success("Access restored"))
                          .catch((err) => toast.error("Couldn't restore access", toastableErrorMessage(err)))
                      }
                      className="text-xs text-muted hover:text-fg"
                    >
                      Restore access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {auditLog.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-muted uppercase tracking-wider">Recent activity</div>
            <Link href="/activity" className="text-xs text-amber-soft hover:opacity-80">
              View full log →
            </Link>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {auditLog.slice(0, 40).map((a) => (
              <div key={a.id} className="flex items-start justify-between text-xs gap-3 border-b border-line last:border-0 pb-2 last:pb-0">
                <div>
                  <span className="text-fg">{a.summary}</span>
                  <span className="text-muted"> — {a.byName} ({roleLabel(a.byRole)})</span>
                </div>
                <div className="text-muted whitespace-nowrap num">{new Date(a.at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted mt-3">
            This is an activity trail for spotting problems, not a tamper-proof ledger — treat a pattern here as a reason to ask
            questions, not as courtroom-grade proof on its own.
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Invite someone">
        <InviteForm
          onDone={(inviteId) => {
            setModalOpen(false);
            setLinkFor(inviteId);
          }}
        />
      </Modal>

      <Modal open={!!linkFor} onClose={() => setLinkFor(null)} title="Invite created">
        {linkFor && (
          <div className="space-y-4">
            <div className="text-sm text-muted">
              Share this link with them — they&apos;ll create their own login when they open it. It only works for the email
              address you invited.
            </div>
            <div className="bg-panel2 border border-line rounded-md px-3 py-2 text-xs break-all num">{inviteLink(linkFor)}</div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  copyLink(linkFor);
                }}
              >
                Copy link
              </Button>
              <Button onClick={() => setLinkFor(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function InviteForm({ onDone }: { onDone: (inviteId: string) => void }) {
  const { createInvite } = useData();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const inviteId = await createInvite(email, name, role);
          toast.success("Invite created");
          onDone(inviteId);
        } catch (err) {
          toast.error("Couldn't create the invite", toastableErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Their name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nimal" />
      </Field>
      <Field>
        <Label>Their email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nimal@example.com" />
      </Field>
      <Field>
        <Label>Role</Label>
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)} — {ROLE_DESCRIPTIONS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create invite"}
        </Button>
      </div>
    </form>
  );
}
