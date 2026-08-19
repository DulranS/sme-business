"use client";

import { PageHeader, EmptyState } from "@/components/ui";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader title="Projects" />
      <EmptyState
        title="Feature not implemented"
        body="Project tracking is not yet implemented in this version."
      />
    </>
  );
}
