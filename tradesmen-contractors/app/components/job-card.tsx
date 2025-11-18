"use client"; // 👈 REQUIRED for interactivity
import Link from "next/link"
import { Job } from "../types"
import { format } from "date-fns"
import { Badge } from "./ui/badge"

export function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <div className="border rounded-lg p-4 hover:bg-accent transition-colors">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold">{job.title}</h3>
          {job.awarded_bid_id ? (
            <Badge variant="secondary">Awarded</Badge>
          ) : (
            <Badge variant="outline">Open</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {job.description}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {job.bids.length} bids • Created {format(new Date(job.created_at), "MMM d")}
        </p>
      </div>
    </Link>
  )
}