"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney, todayIso } from "@/lib/format";
import type { ProjectFinancials } from "@/lib/calculations";
import { summarizeMilestones } from "@/lib/calculations";
import type {
  Project,
  ProjectCostSegment,
  ProjectMilestone,
  ProjectStatus,
  MilestoneStatus,
  Purchase,
  Expense,
  Sale,
  TimeEntry,
  Product,
} from "@/lib/types";
import { PROJECT_COST_CATEGORIES } from "@/lib/types";
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
  Stat,
  Table,
  EmptyState,
} from "@/components/ui";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

function statusTone(status: ProjectStatus): "default" | "good" | "bad" | "amber" {
  if (status === "completed") return "good";
  if (status === "cancelled") return "bad";
  if (status === "active") return "amber";
  return "default";
}

export default function ProjectsPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const {
    projects,
    addProject,
    updateProject,
    deleteProject,
    projectCostSegments,
    addProjectCostSegment,
    updateProjectCostSegment,
    deleteProjectCostSegment,
    projectMilestones,
    addProjectMilestone,
    updateProjectMilestone,
    deleteProjectMilestone,
    projectFinancials,
    projectPortfolio,
    purchases,
    expenses,
    sales,
    timeEntries,
    products,
    settings,
    loading,
  } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const sortedProjects = useMemo(() => {
    const rank: Record<ProjectStatus, number> = { active: 0, planning: 1, on_hold: 2, completed: 3, cancelled: 4 };
    return [...projects].sort((a, b) => rank[a.status] - rank[b.status] || b.startDate.localeCompare(a.startDate));
  }, [projects]);

  const detailProject = projects.find((p) => p.id === detailId) ?? null;

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(p: Project) {
    setEditing(p);
    setFormOpen(true);
  }

  function handleDelete(p: Project) {
    if (
      !confirm(
        `Delete "${p.name}"? This removes the project and its cost segments — any Purchases, Expenses, or Sales tagged to it stay on record, just without the tag. This can't be undone.`
      )
    )
      return;
    deleteProject(p.id)
      .then(() => {
        toast.success("Project deleted", p.name);
        if (detailId === p.id) setDetailId(null);
      })
      .catch((err) => toast.error("Couldn't delete", toastableErrorMessage(err)));
  }

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader title="Projects" action={<Button onClick={openNew}>+ New project</Button>} />

      {!loading && projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Quote a job — a build, a renovation, a client engagement, a custom order — and track every cost against it as it comes in, so you know at a glance whether it actually made money."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Stat label="Active projects" value={String(projectPortfolio.activeCount)} />
            <Stat label="Quoted (active)" value={formatMoney(projectPortfolio.totalQuotedActive, currency)} />
            <Stat
              label="Profit so far (active)"
              value={formatMoney(projectPortfolio.totalProfitActive, currency)}
              tone={projectPortfolio.totalProfitActive >= 0 ? "good" : "bad"}
            />
            <Stat
              label="Over budget"
              value={String(projectPortfolio.overBudgetCount)}
              tone={projectPortfolio.overBudgetCount > 0 ? "bad" : "default"}
            />
          </div>

          <Card>
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">Project</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium text-right">Quoted</th>
                  <th className="py-2 px-3 font-medium text-right">Actual cost</th>
                  <th className="py-2 px-3 font-medium text-right">Profit</th>
                  <th className="py-2 px-3 font-medium">Budget used</th>
                  <th className="py-2 pl-3 font-medium text-right">·</th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((p) => {
                  const f = projectFinancials.get(p.id);
                  const budgetPct = f?.budgetUsedPct;
                  const overBudget = budgetPct !== null && budgetPct !== undefined && budgetPct > 100;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-line last:border-0 cursor-pointer hover:bg-panel2/50"
                      onClick={() => setDetailId(p.id)}
                    >
                      <td className="py-2.5 pr-3 font-medium">
                        {p.name}
                        {p.client && <div className="text-xs text-muted font-normal mt-0.5">{p.client}</div>}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Badge>
                      </td>
                      <td className="py-2.5 px-3 num text-right">{formatMoney(p.quotedPrice, currency)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {formatMoney(f?.totalCost ?? 0, currency)}
                      </td>
                      <td className="py-2.5 px-3 num text-right">
                        <span className={(f?.profit ?? 0) >= 0 ? "text-good" : "text-bad"}>
                          {formatMoney(f?.profit ?? 0, currency)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {budgetPct === null || budgetPct === undefined ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <div className="flex items-center gap-2 w-32">
                            <div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden">
                              <div
                                className={overBudget ? "h-full bg-bad" : "h-full bg-amber-dim"}
                                style={{ width: `${Math.min(100, Math.max(0, budgetPct))}%` }}
                              />
                            </div>
                            <span className={`text-[11px] num shrink-0 ${overBudget ? "text-bad" : "text-muted"}`}>
                              {budgetPct.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEdit(p)} className="text-xs text-muted hover:text-fg mr-3">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p)} className="text-xs text-muted hover:text-bad">
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit project" : "New project"}>
        <ProjectForm
          initial={editing}
          onCancel={() => setFormOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) {
                await updateProject(editing.id, values);
                toast.success("Updated", values.name);
              } else {
                await addProject(values);
                toast.success("Project created", values.name);
              }
              setFormOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
          }}
        />
      </Modal>

      <Modal open={!!detailProject} onClose={() => setDetailId(null)} title={detailProject?.name ?? "Project"}>
        {detailProject && (
          <ProjectDetail
            project={detailProject}
            financials={projectFinancials.get(detailProject.id)}
            segments={projectCostSegments.filter((s) => s.projectId === detailProject.id)}
            milestones={projectMilestones.filter((m) => m.projectId === detailProject.id)}
            purchases={purchases.filter((p) => p.projectId === detailProject.id)}
            expenses={expenses.filter((e) => e.projectId === detailProject.id)}
            sales={sales.filter((s) => s.projectId === detailProject.id)}
            timeEntries={timeEntries.filter((t) => t.projectId === detailProject.id)}
            products={products}
            currency={currency}
            onAddSegment={addProjectCostSegment}
            onUpdateSegment={updateProjectCostSegment}
            onDeleteSegment={deleteProjectCostSegment}
            onAddMilestone={addProjectMilestone}
            onUpdateMilestone={updateProjectMilestone}
            onDeleteMilestone={deleteProjectMilestone}
            onEditProject={() => {
              setDetailId(null);
              openEdit(detailProject);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function ProjectForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Project | null;
  onSave: (values: Omit<Project, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [client, setClient] = useState(initial?.client ?? "");
  const [quotedPrice, setQuotedPrice] = useState(initial?.quotedPrice?.toString() ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "planning");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [targetEndDate, setTargetEndDate] = useState(initial?.targetEndDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name,
          client: client || undefined,
          quotedPrice: Number(quotedPrice) || 0,
          status,
          startDate,
          targetEndDate: targetEndDate || undefined,
          completedDate: status === "completed" ? initial?.completedDate ?? todayIso() : undefined,
          notes: notes || undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Project name</Label>
        <Input
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Perera residence — kitchen fit-out"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Client (optional)</Label>
          <Input value={client} onChange={(e) => setClient(e.target.value)} />
        </Field>
        <Field>
          <Label>Quoted price</Label>
          <Input required type="number" min="0" step="0.01" value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Start date</Label>
          <Input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Target finish (optional)</Label>
        <Input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
      </Field>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

function ProjectDetail({
  project,
  financials,
  segments,
  milestones,
  purchases,
  expenses,
  sales,
  timeEntries,
  products,
  currency,
  onAddSegment,
  onUpdateSegment,
  onDeleteSegment,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onEditProject,
}: {
  project: Project;
  financials: ProjectFinancials | undefined;
  segments: ProjectCostSegment[];
  milestones: ProjectMilestone[];
  purchases: Purchase[];
  expenses: Expense[];
  sales: Sale[];
  timeEntries: TimeEntry[];
  products: Product[];
  currency: string;
  onAddSegment: (s: Omit<ProjectCostSegment, "id" | "createdAt">) => Promise<void>;
  onUpdateSegment: (id: string, s: Partial<ProjectCostSegment>) => Promise<void>;
  onDeleteSegment: (id: string) => Promise<void>;
  onAddMilestone: (m: Omit<ProjectMilestone, "id" | "createdAt">) => Promise<void>;
  onUpdateMilestone: (id: string, m: Partial<ProjectMilestone>) => Promise<void>;
  onDeleteMilestone: (id: string) => Promise<void>;
  onEditProject: () => void;
}) {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<ProjectCostSegment | null>(null);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);

  const f = financials;
  const maxCat = f && f.costByCategory.length > 0 ? f.costByCategory[0].amount : 0;
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const linkedRecords = useMemo(() => buildLinkedRecords(purchases, expenses, sales, timeEntries, productById, currency), [
    purchases,
    expenses,
    sales,
    timeEntries,
    productById,
    currency,
  ]);

  const milestoneSummary = summarizeMilestones(milestones, project.quotedPrice);
  const sortedMilestones = [...milestones].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          {project.client && <div className="text-sm text-muted">{project.client}</div>}
          <div className="mt-1">
            <Badge tone={statusTone(project.status)}>{STATUS_LABEL[project.status]}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => openPrintWindow(buildQuoteHtml(project, f, milestones, currency))}
            className="text-xs text-amber-soft hover:underline"
          >
            Print quote
          </button>
          <button onClick={onEditProject} className="text-xs text-amber-soft hover:underline">
            Edit project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Quoted" value={formatMoney(project.quotedPrice, currency)} />
        <Stat label="Actual cost" value={formatMoney(f?.totalCost ?? 0, currency)} />
        <Stat label="Profit" value={formatMoney(f?.profit ?? 0, currency)} tone={(f?.profit ?? 0) >= 0 ? "good" : "bad"} />
        <Stat
          label="Margin"
          value={f?.marginPct === null || f?.marginPct === undefined ? "—" : `${f.marginPct.toFixed(0)}%`}
          tone={f && f.marginPct !== null && f.marginPct < 0 ? "bad" : "default"}
        />
      </div>

      {f && f.invoicedToDate > 0 && (
        <div className="text-xs text-muted">
          Invoiced to date (sales tagged to this project):{" "}
          <span className="num text-fg">{formatMoney(f.invoicedToDate, currency)}</span>
        </div>
      )}

      {f && f.laborHours > 0 && (
        <div className="text-xs text-muted">
          Labor logged via Time tracking: <span className="num text-fg">{f.laborHours.toFixed(1)}h</span>
          {f.laborCost > 0 && (
            <>
              {" "}
              worth <span className="num text-fg">{formatMoney(f.laborCost, currency)}</span> in billable, rated
              hours — flows straight into actual cost, no manual entry needed.
            </>
          )}
        </div>
      )}

      {f && f.costByCategory.length > 0 && (
        <Card>
          <div className="text-sm font-medium mb-3">Cost breakdown</div>
          <div className="space-y-2">
            {f.costByCategory.map(({ category, amount }) => (
              <div key={category} className="flex items-center gap-3 text-xs">
                <div className="w-32 shrink-0 text-muted truncate">{category}</div>
                <div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-dim" style={{ width: `${maxCat > 0 ? (amount / maxCat) * 100 : 0}%` }} />
                </div>
                <div className="num w-24 text-right shrink-0">{formatMoney(amount, currency)}</div>
              </div>
            ))}
          </div>
          {(f.purchaseCost > 0 || f.expenseCost > 0 || f.laborCost > 0) && (
            <div className="text-[11px] text-muted mt-3">
              &ldquo;Materials (purchases)&rdquo;, category-tagged bills, and &ldquo;Labor (time entries)&rdquo; come
              from Purchases/Expenses/Time entries tagged to this project on their own forms — see exactly which
              ones below, or tag one there rather than re-entering it here, so nothing is counted twice.
            </div>
          )}
        </Card>
      )}

      {linkedRecords.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">Linked records</div>
          <Card>
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Description</th>
                  <th className="py-2 pl-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {linkedRecords.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-muted num">{r.date}</td>
                    <td className="py-2 px-3">
                      <Badge tone={r.kind === "income" ? "good" : "default"}>{r.typeLabel}</Badge>
                    </td>
                    <td className="py-2 px-3">{r.description}</td>
                    <td className={`py-2 pl-3 num text-right ${r.kind === "income" ? "text-good" : ""}`}>
                      {r.amount === null ? "—" : `${r.kind === "income" ? "+" : ""}${formatMoney(r.amount, currency)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          <div className="text-[11px] text-muted mt-2">
            Every Purchase, Expense, Sale, and Time entry currently tagged to this project — tag or un-tag one from
            its own page (Buying, Bills, Selling, or Time) rather than here.
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Cost segments</div>
          <Button
            variant="ghost"
            className="!min-h-0 !py-1.5 !px-2.5 text-xs"
            onClick={() => {
              setEditingSegment(null);
              setAddOpen(true);
            }}
          >
            + Add cost
          </Button>
        </div>
        {segments.length === 0 ? (
          <div className="text-xs text-muted border border-dashed border-line rounded-md py-4 text-center">
            No manual cost entries yet. Add one for anything that isn&apos;t already a Purchase or Expense — a
            subcontractor invoice, a permit fee, an estimated labor allocation.
          </div>
        ) : (
          <Card>
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Label</th>
                  <th className="py-2 px-3 font-medium">Category</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                  <th className="py-2 pl-3 font-medium text-right">·</th>
                </tr>
              </thead>
              <tbody>
                {[...segments]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3 text-muted num">{s.date}</td>
                      <td className="py-2 px-3 font-medium">
                        {s.label}
                        {s.notes && <div className="text-[11px] text-muted font-normal">{s.notes}</div>}
                      </td>
                      <td className="py-2 px-3 text-muted">{s.category}</td>
                      <td className="py-2 px-3 num text-right">{formatMoney(s.amount, currency)}</td>
                      <td className="py-2 pl-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditingSegment(s);
                            setAddOpen(true);
                          }}
                          className="text-xs text-muted hover:text-fg mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm(`Delete "${s.label}"?`)) return;
                            onDeleteSegment(s.id)
                              .then(() => toast.success("Deleted", s.label))
                              .catch((err) => toast.error("Couldn't delete", toastableErrorMessage(err)));
                          }}
                          className="text-xs text-muted hover:text-bad"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-medium">Progress-billing schedule</div>
            <div className="text-[11px] text-muted mt-0.5">
              Scheduled {formatMoney(milestoneSummary.scheduledTotal, currency)} of{" "}
              {formatMoney(project.quotedPrice, currency)} quoted
              {milestoneSummary.unscheduled !== 0 && (
                <>
                  {" "}
                  ({milestoneSummary.unscheduled > 0 ? "—" : "+"}{" "}
                  {formatMoney(Math.abs(milestoneSummary.unscheduled), currency)}{" "}
                  {milestoneSummary.unscheduled > 0 ? "left to schedule" : "over the quote"})
                </>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            className="!min-h-0 !py-1.5 !px-2.5 text-xs"
            onClick={() => {
              setEditingMilestone(null);
              setMilestoneOpen(true);
            }}
          >
            + Add milestone
          </Button>
        </div>
        {sortedMilestones.length === 0 ? (
          <div className="text-xs text-muted border border-dashed border-line rounded-md py-4 text-center">
            No billing schedule yet. Add a deposit, progress payments, or a final payment so you can track what&apos;s
            been invoiced and collected against the quote — and print an invoice for each once it&apos;s due.
          </div>
        ) : (
          <Card>
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">Due</th>
                  <th className="py-2 px-3 font-medium">Milestone</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 pl-3 font-medium text-right">·</th>
                </tr>
              </thead>
              <tbody>
                {sortedMilestones.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-muted num">{m.dueDate || "—"}</td>
                    <td className="py-2 px-3 font-medium">
                      {m.label}
                      {m.notes && <div className="text-[11px] text-muted font-normal">{m.notes}</div>}
                    </td>
                    <td className="py-2 px-3 num text-right">{formatMoney(m.amount, currency)}</td>
                    <td className="py-2 px-3">
                      <Badge tone={m.status === "paid" ? "good" : m.status === "invoiced" ? "amber" : "default"}>
                        {MILESTONE_STATUS_LABEL[m.status]}
                      </Badge>
                    </td>
                    <td className="py-2 pl-3 text-right whitespace-nowrap">
                      {m.status === "pending" && (
                        <button
                          onClick={() =>
                            onUpdateMilestone(m.id, { status: "invoiced", invoicedDate: todayIso() })
                              .then(() => toast.success("Marked invoiced", m.label))
                              .catch((err) => toast.error("Couldn't update", toastableErrorMessage(err)))
                          }
                          className="text-xs text-amber-soft hover:underline mr-3"
                        >
                          Mark invoiced
                        </button>
                      )}
                      {m.status === "invoiced" && (
                        <button
                          onClick={() =>
                            onUpdateMilestone(m.id, { status: "paid", paidDate: todayIso() })
                              .then(() => toast.success("Marked paid", m.label))
                              .catch((err) => toast.error("Couldn't update", toastableErrorMessage(err)))
                          }
                          className="text-xs text-good hover:underline mr-3"
                        >
                          Mark paid
                        </button>
                      )}
                      <button
                        onClick={() => openPrintWindow(buildInvoiceHtml(project, m, currency))}
                        className="text-xs text-muted hover:text-fg mr-3"
                      >
                        Print invoice
                      </button>
                      <button
                        onClick={() => {
                          setEditingMilestone(m);
                          setMilestoneOpen(true);
                        }}
                        className="text-xs text-muted hover:text-fg mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (!confirm(`Delete "${m.label}"?`)) return;
                          onDeleteMilestone(m.id)
                            .then(() => toast.success("Deleted", m.label))
                            .catch((err) => toast.error("Couldn't delete", toastableErrorMessage(err)));
                        }}
                        className="text-xs text-muted hover:text-bad"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={editingSegment ? "Edit cost" : "Add a cost"}>
        <SegmentForm
          initial={editingSegment}
          onCancel={() => setAddOpen(false)}
          onSave={async (values) => {
            try {
              if (editingSegment) {
                await onUpdateSegment(editingSegment.id, values);
                toast.success("Updated", values.label);
              } else {
                await onAddSegment({ ...values, projectId: project.id });
                toast.success("Cost added", `${values.label}: ${formatMoney(values.amount, currency)}`);
              }
              setAddOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
          }}
        />
      </Modal>

      <Modal
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        title={editingMilestone ? "Edit milestone" : "Add milestone"}
      >
        <MilestoneForm
          initial={editingMilestone}
          onCancel={() => setMilestoneOpen(false)}
          onSave={async (values) => {
            try {
              if (editingMilestone) {
                await onUpdateMilestone(editingMilestone.id, values);
                toast.success("Updated", values.label);
              } else {
                await onAddMilestone({ ...values, projectId: project.id });
                toast.success("Milestone added", `${values.label}: ${formatMoney(values.amount, currency)}`);
              }
              setMilestoneOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
          }}
        />
      </Modal>
    </div>
  );
}

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending: "Pending",
  invoiced: "Invoiced",
  paid: "Paid",
};

function MilestoneForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ProjectMilestone | null;
  onSave: (values: Omit<ProjectMilestone, "id" | "createdAt" | "projectId">) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          label,
          amount: Number(amount) || 0,
          dueDate: dueDate || undefined,
          status: initial?.status ?? "pending",
          invoicedDate: initial?.invoicedDate,
          paidDate: initial?.paidDate,
          notes: notes || undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>What&apos;s this payment for?</Label>
        <Input required autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Deposit, 50% on delivery" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Amount</Label>
          <Input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field>
          <Label>Due date (optional)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Itemized linked records — the actual Purchase/Expense/Sale/TimeEntry rows
// tagged to a project, not just a category total. Built once per detail
// render rather than stored anywhere; the tag lives on the source record
// itself (see lib/types.ts), this is purely a read-side join for display.
// ---------------------------------------------------------------------------
interface LinkedRecordRow {
  key: string;
  date: string;
  typeLabel: string;
  description: string;
  amount: number | null;
  kind: "cost" | "income";
}

function buildLinkedRecords(
  purchases: Purchase[],
  expenses: Expense[],
  sales: Sale[],
  timeEntries: TimeEntry[],
  productById: Map<string, Product>,
  currency: string
): LinkedRecordRow[] {
  const rows: LinkedRecordRow[] = [];

  for (const p of purchases) {
    const productName = productById.get(p.productId)?.name ?? "Item";
    rows.push({
      key: `purchase-${p.id}`,
      date: p.date,
      typeLabel: "Purchase",
      description: `${productName} — ${p.qty} × ${formatMoney(p.unitCost, currency)}${p.supplier ? ` (${p.supplier})` : ""}`,
      amount: p.qty * p.unitCost,
      kind: "cost",
    });
  }

  for (const e of expenses) {
    if (e.kind !== "expense") continue;
    rows.push({
      key: `expense-${e.id}`,
      date: e.startDate,
      typeLabel: "Expense",
      description: `${e.name} (${e.category})`,
      amount: e.amount,
      kind: "cost",
    });
  }

  for (const s of sales) {
    const productName = productById.get(s.productId)?.name ?? "Item";
    rows.push({
      key: `sale-${s.id}`,
      date: s.date,
      typeLabel: "Sale",
      description: `${productName} — ${s.qty} × ${formatMoney(s.unitPrice, currency)}${s.customer ? ` (${s.customer})` : ""}`,
      amount: s.qty * s.unitPrice,
      kind: "income",
    });
  }

  for (const t of timeEntries) {
    if (!t.clockOut) continue;
    const hours = (t.clockOut - t.clockIn) / 3600000;
    const cost = t.billable && t.hourlyRate ? hours * t.hourlyRate : null;
    rows.push({
      key: `time-${t.id}`,
      date: new Date(t.clockIn).toISOString().slice(0, 10),
      typeLabel: "Labor",
      description: `${t.memberName} — ${t.jobLabel} (${hours.toFixed(1)}h${t.hourlyRate ? ` × ${formatMoney(t.hourlyRate, currency)}/hr` : ""})${!t.billable ? " — non-billable" : ""}`,
      amount: cost,
      kind: "cost",
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------------------------------------------------------------------------
// Printable quote / invoice generation. Deliberately implemented as a
// browser print dialog (window.open + document.write + print()) rather than
// a PDF-generation library: every OS's print dialog already offers "Save as
// PDF", so this gets a downloadable, professional-looking document without
// adding a client-side PDF dependency to the bundle. Kept intentionally
// generic (no business letterhead) since Settings doesn't currently capture
// a business name/address/logo.
// ---------------------------------------------------------------------------
function openPrintWindow(html: string) {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Give the new document a beat to lay out before invoking print.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

function printBaseStyles(): string {
  return `
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 40px; max-width: 720px; margin: 0 auto; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .muted { color: #666; font-size: 13px; }
      .meta { display: flex; justify-content: space-between; margin: 24px 0; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #ddd; font-size: 13px; }
      th { text-transform: uppercase; letter-spacing: 0.03em; font-size: 10px; color: #666; }
      td.num, th.num { text-align: right; }
      .total-row td { border-top: 2px solid #1a1a1a; border-bottom: none; font-weight: 600; }
      .footer { margin-top: 32px; font-size: 11px; color: #888; }
      @media print { body { padding: 0; } }
    </style>
  `;
}

function buildQuoteHtml(
  project: Project,
  financials: ProjectFinancials | undefined,
  milestones: ProjectMilestone[],
  currency: string
): string {
  const sortedMilestones = [...milestones].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const scheduleRows = sortedMilestones
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.label)}</td><td>${m.dueDate ?? "—"}</td><td class="num">${formatMoney(m.amount, currency)}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Quote — ${escapeHtml(project.name)}</title>${printBaseStyles()}</head>
    <body>
      <h1>Quote</h1>
      <div class="muted">${escapeHtml(project.name)}</div>
      <div class="meta">
        <div>${project.client ? `<strong>Client:</strong> ${escapeHtml(project.client)}` : ""}</div>
        <div><strong>Date:</strong> ${todayIso()}</div>
      </div>
      <table>
        <thead><tr><th>Description</th><th></th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>${escapeHtml(project.name)}</td><td></td><td class="num">${formatMoney(project.quotedPrice, currency)}</td></tr>
        </tbody>
        <tfoot><tr class="total-row"><td>Total</td><td></td><td class="num">${formatMoney(project.quotedPrice, currency)}</td></tr></tfoot>
      </table>
      ${
        scheduleRows
          ? `<h1 style="font-size:16px;margin-top:32px;">Payment schedule</h1>
             <table><thead><tr><th>Milestone</th><th>Due</th><th class="num">Amount</th></tr></thead><tbody>${scheduleRows}</tbody></table>`
          : ""
      }
      <div class="footer">Prepared ${todayIso()}${financials ? ` — margin details withheld from this document` : ""}.</div>
    </body></html>`;
}

function buildInvoiceHtml(project: Project, milestone: ProjectMilestone, currency: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice — ${escapeHtml(project.name)}</title>${printBaseStyles()}</head>
    <body>
      <h1>Invoice</h1>
      <div class="muted">${escapeHtml(project.name)}</div>
      <div class="meta">
        <div>${project.client ? `<strong>Bill to:</strong> ${escapeHtml(project.client)}` : ""}</div>
        <div><strong>Date:</strong> ${milestone.invoicedDate ?? todayIso()}</div>
      </div>
      <table>
        <thead><tr><th>Description</th><th>Due</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>${escapeHtml(milestone.label)}</td><td>${milestone.dueDate ?? "—"}</td><td class="num">${formatMoney(milestone.amount, currency)}</td></tr>
        </tbody>
        <tfoot><tr class="total-row"><td>Total due</td><td></td><td class="num">${formatMoney(milestone.amount, currency)}</td></tr></tfoot>
      </table>
      <div class="footer">${escapeHtml(project.name)}${project.client ? ` · ${escapeHtml(project.client)}` : ""} — generated ${todayIso()}.</div>
    </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}


function SegmentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ProjectCostSegment | null;
  onSave: (values: Omit<ProjectCostSegment, "id" | "createdAt" | "projectId">) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? PROJECT_COST_CATEGORIES[0]);
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          label,
          category,
          amount: Number(amount) || 0,
          date,
          notes: notes || undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>What was it for?</Label>
        <Input required autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Electrician subcontract" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {PROJECT_COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Amount</Label>
          <Input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Date</Label>
        <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Add"}
        </Button>
      </div>
    </form>
  );
}
