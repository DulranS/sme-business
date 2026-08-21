"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Table,
  EmptyState,
} from "@/components/ui";
import type { TimeEntry, Project } from "@/lib/types";

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TimePage() {
  const { role } = useAuth();
  const {
    timeEntries,
    members,
    settings,
    projects,
    clockIn,
    clockOut,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    loading,
  } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const canManage = can(role, "manage:timeEntries");
  const canSeeAll = can(role, "view:allTimeEntries");

  const [jobLabel, setJobLabel] = useState("");
  const [billable, setBillable] = useState(true);
  const [hourlyRate, setHourlyRate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);

  // Manual/backfill entry, Owner/Manager only
  const [showManual, setShowManual] = useState(false);
  const [manualMemberUid, setManualMemberUid] = useState("");
  const [manualJobLabel, setManualJobLabel] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualRate, setManualRate] = useState("");
  const [manualProjectId, setManualProjectId] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const billableProjects = useMemo(
    () => [...projects].filter((p) => p.status !== "cancelled").sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const sorted = useMemo(() => [...timeEntries].sort((a, b) => b.clockIn - a.clockIn), [timeEntries]);
  const openEntries = sorted.filter((t) => !t.clockOut);
  const closedEntries = sorted.filter((t) => t.clockOut);

  const totalBillableMs = closedEntries
    .filter((t) => t.billable)
    .reduce((sum, t) => sum + ((t.clockOut ?? 0) - t.clockIn), 0);
  const totalBillableValue = closedEntries
    .filter((t) => t.billable && t.hourlyRate)
    .reduce((sum, t) => sum + (((t.clockOut ?? 0) - t.clockIn) / 3600000) * (t.hourlyRate ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Time"
        action={
          canManage ? (
            <Button onClick={() => setShowManual((s) => !s)}>{showManual ? "Cancel" : "+ Log for someone"}</Button>
          ) : undefined
        }
      />

      <Card className="mb-6">
        <div className="text-sm text-muted mb-4">
          {canSeeAll
            ? "Clock in when you start a job, clock out when you finish. Staff can only see their own hours; you see everyone's."
            : "Clock in when you start a job, clock out when you finish. Once you clock out, the entry is locked — if you make a mistake, ask your manager to fix it."}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!jobLabel.trim()) return;
            setBusy(true);
            try {
              await clockIn(jobLabel.trim(), {
                billable,
                hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
                projectId: projectId || undefined,
              });
              toast.success("Clocked in");
              setJobLabel("");
              setHourlyRate("");
              setProjectId("");
            } catch (err) {
              toast.error("Couldn't clock in", toastableErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <Field>
            <Label>Job / customer</Label>
            <Input
              required
              value={jobLabel}
              onChange={(e) => setJobLabel(e.target.value)}
              placeholder="e.g. Acme Corp — website redesign"
              autoFocus
            />
          </Field>
          <Field>
            <Label>Project (optional)</Label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">None</option>
              {billableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>Rate/hr (optional)</Label>
            <Input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
          </Field>
          <Field>
            <Label>Billable</Label>
            <Select value={billable ? "yes" : "no"} onChange={(e) => setBillable(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Clocking in…" : "Clock in"}
          </Button>
        </form>
        {billableProjects.length > 0 && (
          <div className="text-[11px] text-muted mt-2">
            Tag a project and, once you clock out, billable hours × rate roll straight into that project&apos;s
            actual cost — no need to also add it as a manual cost entry.
          </div>
        )}
      </Card>

      {showManual && canManage && (
        <Card className="mb-6">
          <div className="text-sm text-muted mb-4">
            Backfill a missed clock-in, or log time on behalf of someone else. This bypasses the normal
            clock in/out flow, so use it for corrections, not routine logging.
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const member = members.find((m) => m.id === manualMemberUid);
              if (!member || !manualJobLabel.trim() || !manualDate || !manualStart || !manualEnd) return;
              const clockInTs = new Date(`${manualDate}T${manualStart}`).getTime();
              const clockOutTs = new Date(`${manualDate}T${manualEnd}`).getTime();
              if (clockOutTs <= clockInTs) {
                toast.error("Couldn't save that entry", "Clock-out has to be after clock-in.");
                return;
              }
              setManualBusy(true);
              try {
                await addTimeEntry({
                  memberUid: member.id,
                  memberName: member.name,
                  jobLabel: manualJobLabel.trim(),
                  billable: true,
                  clockIn: clockInTs,
                  clockOut: clockOutTs,
                  hourlyRate: manualRate ? Number(manualRate) : undefined,
                  projectId: manualProjectId || undefined,
                });
                toast.success("Time entry added");
                setManualJobLabel("");
                setManualStart("");
                setManualEnd("");
                setManualRate("");
                setManualProjectId("");
                setShowManual(false);
              } catch (err) {
                toast.error("Couldn't save that entry", toastableErrorMessage(err));
              } finally {
                setManualBusy(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>Team member</Label>
                <Select required value={manualMemberUid} onChange={(e) => setManualMemberUid(e.target.value)}>
                  <option value="">Select…</option>
                  {members.filter((m) => m.active).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>Job / customer</Label>
                <Input required value={manualJobLabel} onChange={(e) => setManualJobLabel(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field>
                <Label>Date</Label>
                <Input required type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
              </Field>
              <Field>
                <Label>Start</Label>
                <Input required type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} />
              </Field>
              <Field>
                <Label>End</Label>
                <Input required type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>Rate/hr (optional)</Label>
                <Input type="number" min="0" step="0.01" value={manualRate} onChange={(e) => setManualRate(e.target.value)} />
              </Field>
              <Field>
                <Label>Project (optional)</Label>
                <Select value={manualProjectId} onChange={(e) => setManualProjectId(e.target.value)}>
                  <option value="">None</option>
                  {billableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={manualBusy}>
                {manualBusy ? "Saving…" : "Save entry"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {openEntries.length > 0 && (
        <Card className="mb-6">
          <div className="text-xs uppercase tracking-wider text-muted font-medium mb-3">Running now</div>
          <div className="space-y-3">
            {openEntries.map((t) => (
              <RunningRow
                key={t.id}
                entry={t}
                projectName={t.projectId ? projectById.get(t.projectId)?.name : undefined}
                onClockOut={async () => {
                  try {
                    await clockOut(t.id);
                    toast.success("Clocked out");
                  } catch (err) {
                    toast.error("Couldn't clock out", toastableErrorMessage(err));
                  }
                }}
                canManage={canManage}
              />
            ))}
          </div>
        </Card>
      )}

      {!loading && sorted.length === 0 && (
        <EmptyState title="No time logged yet" body="Clock in above and your hours will show up here." />
      )}

      {closedEntries.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card>
              <div className="text-xs uppercase tracking-wider text-muted font-medium mb-1">Billable hours logged</div>
              <div className="text-xl font-semibold num">{formatDuration(totalBillableMs)}</div>
            </Card>
            <Card>
              <div className="text-xs uppercase tracking-wider text-muted font-medium mb-1">Billable value</div>
              <div className="text-xl font-semibold num">{formatMoney(totalBillableValue, currency)}</div>
            </Card>
          </div>

          <Card>
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">Job</th>
                  {canSeeAll && <th className="py-2 px-3 font-medium">Who</th>}
                  <th className="py-2 px-3 font-medium">When</th>
                  <th className="py-2 px-3 font-medium text-right">Duration</th>
                  <th className="py-2 px-3 font-medium text-right">Value</th>
                  {canManage && <th className="py-2 pl-3 font-medium text-right">—</th>}
                </tr>
              </thead>
              <tbody>
                {closedEntries.map((t) => {
                  const durationMs = (t.clockOut ?? 0) - t.clockIn;
                  const value = t.hourlyRate ? (durationMs / 3600000) * t.hourlyRate : null;
                  const projectName = t.projectId ? projectById.get(t.projectId)?.name : undefined;
                  return (
                    <tr key={t.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3">
                        {t.jobLabel}
                        {projectName && (
                          <span className="ml-2">
                            <Badge tone="amber">{projectName}</Badge>
                          </span>
                        )}
                        {!t.billable && (
                          <span className="ml-2">
                            <Badge>Non-billable</Badge>
                          </span>
                        )}
                      </td>
                      {canSeeAll && <td className="py-2.5 px-3 text-muted">{t.memberName}</td>}
                      <td className="py-2.5 px-3 num text-muted">{formatClock(t.clockIn)}</td>
                      <td className="py-2.5 px-3 num text-right">{formatDuration(durationMs)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {value != null ? formatMoney(value, currency) : "—"}
                      </td>
                      {canManage && (
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="text-xs text-muted hover:text-fg mr-3"
                            onClick={() => setEditingEntry(t)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs text-bad hover:underline"
                            onClick={async () => {
                              try {
                                await deleteTimeEntry(t.id);
                                toast.success("Entry deleted");
                              } catch (err) {
                                toast.error("Couldn't delete that entry", toastableErrorMessage(err));
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      <Modal open={!!editingEntry} onClose={() => setEditingEntry(null)} title="Correct this time entry">
        {editingEntry && (
          <EditTimeEntryForm
            entry={editingEntry}
            projects={projects}
            onSave={async (patch) => {
              try {
                await updateTimeEntry(editingEntry.id, patch);
                toast.success("Time entry corrected");
                setEditingEntry(null);
              } catch (err) {
                toast.error("Couldn't save", toastableErrorMessage(err));
              }
            }}
            onCancel={() => setEditingEntry(null)}
          />
        )}
      </Modal>
    </>
  );
}

function EditTimeEntryForm({
  entry,
  projects,
  onSave,
  onCancel,
}: {
  entry: TimeEntry;
  projects: Project[];
  onSave: (patch: {
    jobLabel?: string;
    clockIn?: number;
    clockOut?: number;
    billable?: boolean;
    hourlyRate?: number;
    projectId?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const toISOFields = (ts: number) => {
    const d = new Date(ts);
    const date = d.toISOString().slice(0, 10);
    const time = d.toTimeString().slice(0, 5);
    return { date, time };
  };
  const startFields = toISOFields(entry.clockIn);
  const endFields = toISOFields(entry.clockOut ?? entry.clockIn);

  const [jobLabel, setJobLabel] = useState(entry.jobLabel);
  const [date, setDate] = useState(startFields.date);
  const [start, setStart] = useState(startFields.time);
  const [end, setEnd] = useState(endFields.time);
  const [billable, setBillable] = useState(entry.billable);
  const [hourlyRate, setHourlyRate] = useState(entry.hourlyRate?.toString() ?? "");
  const [projectId, setProjectId] = useState(entry.projectId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const clockInTs = new Date(`${date}T${start}`).getTime();
        const clockOutTs = new Date(`${date}T${end}`).getTime();
        if (clockOutTs <= clockInTs) {
          setError("Clock-out has to be after clock-in.");
          return;
        }
        setError("");
        setBusy(true);
        await onSave({
          jobLabel: jobLabel.trim(),
          clockIn: clockInTs,
          clockOut: clockOutTs,
          billable,
          hourlyRate: hourlyRate ? Number(hourlyRate) : undefined,
          projectId: projectId || undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <div className="text-xs text-muted">Correcting {entry.memberName}&apos;s entry.</div>
      <Field>
        <Label>Job / customer</Label>
        <Input required value={jobLabel} onChange={(e) => setJobLabel(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field>
          <Label>Date</Label>
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field>
          <Label>Start</Label>
          <Input required type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field>
          <Label>End</Label>
          <Input required type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Rate/hr (optional)</Label>
          <Input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
        </Field>
        <Field>
          <Label>Billable</Label>
          <Select value={billable ? "yes" : "no"} onChange={(e) => setBillable(e.target.value === "yes")}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Project (optional)</Label>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">None</option>
          {projects
            .filter((p) => p.status !== "cancelled")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
      </Field>
      {error && <div className="text-xs text-bad">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save correction"}
        </Button>
      </div>
    </form>
  );
}

function RunningRow({
  entry,
  projectName,
  onClockOut,
  canManage,
}: {
  entry: TimeEntry;
  projectName?: string;
  onClockOut: () => void;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const isMine = user?.uid === entry.memberUid;
  return (
    <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
      <div>
        <div className="font-medium">
          {entry.jobLabel}
          {projectName && (
            <span className="ml-2">
              <Badge tone="amber">{projectName}</Badge>
            </span>
          )}
        </div>
        <div className="text-xs text-muted">
          {entry.memberName} · started {formatClock(entry.clockIn)}
          {!entry.billable && " · non-billable"}
        </div>
      </div>
      {(isMine || canManage) && (
        <Button onClick={onClockOut} className="!py-1.5 !px-3 text-sm">
          Clock out
        </Button>
      )}
    </div>
  );
}
