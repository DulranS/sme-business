"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useRequireRole } from "@/lib/roleGuard";
import { roleLabel } from "@/lib/permissions";
import type { AuditAction } from "@/lib/types";
import { Badge, Card, EmptyState, Field, Input, Label, PageHeader, Select, Stat, Table } from "@/components/ui";

const ACTION_TONE: Record<AuditAction, "good" | "amber" | "bad"> = {
  create: "good",
  update: "amber",
  delete: "bad",
};

// Owner-only, same as the underlying auditLog read (see firestore.rules).
// This is deliberately just a searchable window onto data the app already
// collects and already showed a 40-row preview of on the Team page — no new
// writes, no new permission, no new Firestore rule. The only thing added is
// the ability to actually find something in it once the log is bigger than
// "scroll a short list."
export default function ActivityPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner"]);
  const { auditLog } = useData();
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState<"all" | AuditAction>("all");

  const entities = useMemo(() => Array.from(new Set(auditLog.map((a) => a.entity))).sort(), [auditLog]);

  const todayCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return auditLog.filter((a) => a.at >= startOfToday.getTime()).length;
  }, [auditLog]);

  const deleteCount = useMemo(() => auditLog.filter((a) => a.action === "delete").length, [auditLog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLog.filter((a) => {
      if (entityFilter !== "all" && a.entity !== entityFilter) return false;
      if (actionFilter !== "all" && a.action !== actionFilter) return false;
      if (q && !`${a.summary} ${a.byName} ${a.entity}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [auditLog, search, entityFilter, actionFilter]);

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader title="Activity log" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Total entries" value={auditLog.length.toString()} />
        <Stat label="Today" value={todayCount.toString()} />
        <Stat label="Deletions" value={deleteCount.toString()} tone={deleteCount > 0 ? "bad" : "default"} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Field className="sm:col-span-1">
          <Label>Search</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, entity, or description"
          />
        </Field>
        <Field>
          <Label>Entity</Label>
          <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="all">All</option>
            {entities.map((ent) => (
              <option key={ent} value={ent}>
                {ent}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Action</Label>
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as "all" | AuditAction)}>
            <option value="all">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </Select>
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={auditLog.length === 0 ? "No activity yet" : "Nothing matches"}
          body={
            auditLog.length === 0
              ? "Every create, edit, and delete anyone on your team makes will show up here as it happens."
              : "Try a different search term or clear the filters."
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 px-3 font-medium">Who</th>
                <th className="py-2 px-3 font-medium">Action</th>
                <th className="py-2 px-3 font-medium">Entity</th>
                <th className="py-2 pl-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 align-top">
                  <td className="py-2.5 pr-3 text-muted whitespace-nowrap num">{new Date(a.at).toLocaleString()}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {a.byName} <span className="text-muted">({roleLabel(a.byRole)})</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge tone={ACTION_TONE[a.action]}>{a.action}</Badge>
                  </td>
                  <td className="py-2.5 px-3 text-muted whitespace-nowrap">{a.entity}</td>
                  <td className="py-2.5 pl-3">{a.summary}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {filtered.length > 500 && (
            <div className="text-[11px] text-muted mt-3">
              Showing the most recent 500 of {filtered.length} matching entries — narrow the search or filters to see
              more.
            </div>
          )}
        </Card>
      )}

      <div className="text-[11px] text-muted mt-3">
        This is an activity trail for spotting problems, not a tamper-proof ledger — treat a pattern here as a reason
        to ask questions, not as courtroom-grade proof on its own.
      </div>
    </>
  );
}
