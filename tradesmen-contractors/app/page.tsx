"use client"; // 👈 REQUIRED for interactivity
import { JobCard } from "./components/job-card"
import { getApiUrl } from "./lib/api";
import { Job } from "./types"

export default async function Home() {
  const url = getApiUrl('/api/jobs');
  const res = await fetch(url, { next: { revalidate: 10 } });

  if (!res.ok) {
    console.error("Failed to fetch jobs:", res.status, res.statusText);
    // Optionally return empty array or error UI
    return <div>Error loading jobs</div>;
  }

  const jobs: Job[] = await res.json();
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Available Jobs</h1>
        <button 
          onClick={() => window.location.assign('/dashboard')}
          className="text-sm text-primary hover:underline"
        >
          Admin Dashboard
        </button>
      </div>
      
      {jobs.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">No jobs available</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}