"use client";

import { PageHeader, EmptyState } from "@/components/ui";

export default function FinancialHealthPage() {
  return (
    <>
      <PageHeader title="Financial health" />
      <EmptyState
        title="Feature not implemented"
        body="Financial ratios and customer metrics are not yet implemented in this version."
      />
    </>
  );
}
