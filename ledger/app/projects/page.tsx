"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { Card, PageHeader, Button, Input, Select, Badge, Modal } from "@/components/ui";
import type { Project, ProjectStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

export default function ProjectsPage() {
  const { projects, addProject, updateProject, deleteProject, settings } = useData();
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active" as ProjectStatus,
    startDate: "",
    endDate: "",
    budget: "",
  });

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description ?? "",
        status: project.status,
        startDate: project.startDate ?? "",
        endDate: project.endDate ?? "",
        budget: project.budget?.toString() ?? "",
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: "",
        description: "",
        status: "active",
        startDate: "",
        endDate: "",
        budget: "",
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const projectData = {
      name: formData.name,
      description: formData.description || undefined,
      status: formData.status,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      budget: formData.budget ? Number(formData.budget) : undefined,
    };

    if (editingProject) {
      await updateProject(editingProject.id, projectData);
    } else {
      await addProject(projectData);
    }
    setShowModal(false);
    setEditingProject(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      await deleteProject(id);
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    const tone = status === "active" ? "good" : status === "completed" ? "default" : "amber";
    return <Badge tone={tone}>{status.replace("_", " ")}</Badge>;
  };

  const activeProjects = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");
  const onHoldProjects = projects.filter((p) => p.status === "on_hold");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Projects"
        action={
          <Button onClick={() => handleOpenModal()}>+ New Project</Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Card className="p-4">
          <div className="text-2xl font-bold">{activeProjects.length}</div>
          <div className="text-xs text-muted">Active projects</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{completedProjects.length}</div>
          <div className="text-xs text-muted">Completed</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{onHoldProjects.length}</div>
          <div className="text-xs text-muted">On hold</div>
        </Card>
      </div>

      <Card>
        <div className="table-container">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Description</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Budget</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Start Date</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    No projects yet. Create your first project to start tracking by project.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-b border-line hover:bg-bg-secondary">
                    <td className="p-3 font-medium">{project.name}</td>
                    <td className="p-3 text-muted hidden sm:table-cell">
                      {project.description || "—"}
                    </td>
                    <td className="p-3">{getStatusBadge(project.status)}</td>
                    <td className="p-3 hidden md:table-cell">
                      {project.budget
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: settings.currency,
                          }).format(project.budget)
                        : "—"}
                    </td>
                    <td className="p-3 text-muted hidden lg:table-cell">
                      {project.startDate || "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenModal(project)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDelete(project.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <Modal
          open={showModal}
          title={editingProject ? "Edit Project" : "New Project"}
          onClose={() => {
            setShowModal(false);
            setEditingProject(null);
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project Name *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Website Redesign"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the project"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Budget</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                placeholder="Optional budget amount"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowModal(false);
                  setEditingProject(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingProject ? "Save Changes" : "Create Project"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
