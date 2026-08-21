"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney, todayIso } from "@/lib/format";
import type { ProjectFinancials } from "@/lib/calculations";
import type { Project, ProjectCostSegment, ProjectStatus } from "@/lib/types";
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
    projectFinancials,
    projectPortfolio,
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
            currency={currency}
            onAddSegment={addProjectCostSegment}
            onUpdateSegment={updateProjectCostSegment}
            onDeleteSegment={deleteProjectCostSegment}
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
  currency,
  onAddSegment,
  onUpdateSegment,
  onDeleteSegment,
  onEditProject,
}: {
  project: Project;
  financials: ProjectFinancials | undefined;
  segments: ProjectCostSegment[];
  currency: string;
  onAddSegment: (s: Omit<ProjectCostSegment, "id" | "createdAt">) => Promise<void>;
  onUpdateSegment: (id: string, s: Partial<ProjectCostSegment>) => Promise<void>;
  onDeleteSegment: (id: string) => Promise<void>;
  onEditProject: () => void;
}) {
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<ProjectCostSegment | null>(null);

  const f = financials;
  const maxCat = f && f.costByCategory.length > 0 ? f.costByCategory[0].amount : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          {project.client && <div className="text-sm text-muted">{project.client}</div>}
          <div className="mt-1">
            <Badge tone={statusTone(project.status)}>{STATUS_LABEL[project.status]}</Badge>
          </div>
        </div>
        <button onClick={onEditProject} className="text-xs text-amber-soft hover:underline shrink-0">
          Edit project
        </button>
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
          {(f.purchaseCost > 0 || f.expenseCost > 0) && (
            <div className="text-[11px] text-muted mt-3">
              &ldquo;Materials (purchases)&rdquo; and category-tagged bills come from Purchases/Expenses tagged to
              this project on their own forms — tag one there rather than re-entering it here, so nothing is
              counted twice.
            </div>
          )}
        </Card>
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
    </div>
  );
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
