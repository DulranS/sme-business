"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Job } from "../types"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { 
  Plus, 
  Trash2, 
  Star, 
  Clock, 
  Shield, 
  Award, 
  Eye, 
  Download,
  TrendingUp
} from "lucide-react"

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newJobDesc, setNewJobDesc] = useState("")
  const [newJobLocation, setNewJobLocation] = useState("")
  const [newJobType, setNewJobType] = useState("")
  const [newCustomTrade, setNewCustomTrade] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [newJobDeadline, setNewJobDeadline] = useState("")
  const [newJobBudget, setNewJobBudget] = useState("")
  const [newJobAttachments, setNewJobAttachments] = useState("")
  const [newJobContactPhone, setNewJobContactPhone] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [secret, setSecret] = useState("")
  const router = useRouter()

  useEffect(() => {
    const storedSecret = localStorage.getItem("admin_secret")
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET
    if (storedSecret && adminSecret && storedSecret === adminSecret) {
      setSecret(storedSecret)
      loadJobs()
    }
  }, [])

// In Dashboard component
const loadJobs = async () => {
  try {
    const res = await fetch("/api/jobs");
    if (!res.ok) throw new Error("Failed to load jobs");
    const jobsData: Job[] = await res.json();
    
    // Fetch full job details with bids for each job
    const jobsWithBids = await Promise.all(
      jobsData.map(async (job) => {
        const jobRes = await fetch(`/api/jobs/${job.id}`);
        if (jobRes.ok) {
          return jobRes.json();
        }
        return job; // fallback
      })
    );
    
    setJobs(jobsWithBids);
  } catch (error) {
    console.error("Failed to load jobs:", error);
    alert("Failed to load jobs. Check console for details.");
  }
};

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault()
    const adminSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET
    if (adminSecret && secret === adminSecret) {
      localStorage.setItem("admin_secret", secret)
      loadJobs()
    } else {
      alert("Invalid secret key")
    }
  }

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const attachments = newJobAttachments
      ? newJobAttachments
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean)
      : []

    const jobType = newJobType === "custom" ? newCustomTrade : newJobType

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          title: newJobTitle,
          description: newJobDesc,
          location: newJobLocation,
          job_type: jobType || null,
          deadline: newJobDeadline || null,
          budget_range: newJobBudget || null,
          attachments,
          contact_phone: newJobContactPhone || null,
        }),
      })

      if (res.ok) {
        setNewJobTitle("")
        setNewJobDesc("")
        setNewJobLocation("")
        setNewJobType("")
        setNewCustomTrade("")
        setNewJobDeadline("")
        setNewJobBudget("")
        setNewJobAttachments("")
        setNewJobContactPhone("")
        loadJobs()
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(`Failed to create job: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Create job error:", error)
      alert("Network error. Check console.")
    } finally {
      setIsLoading(false)
    }
  }

  const awardBid = async (jobId: string, bidId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/awards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ bidId }),
      })

      if (res.ok) {
        loadJobs()
      } else {
        alert("Failed to award bid")
      }
    } catch (error) {
      console.error("Award bid error:", error)
      alert("Network error")
    }
  }

  const deleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job? All bids will be permanently lost.")) return
    
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret }
      })
      
      if (res.ok) {
        loadJobs()
        alert("Job deleted successfully")
      } else {
        alert("Failed to delete job")
      }
    } catch (error) {
      console.error("Delete job error:", error)
      alert("Network error")
    }
  }

  const exportBids = (job: Job) => {
    const csvContent = [
      ["Bidder Name", "Company", "Trade", "Price", "Timeline", "Email", "Phone", "Insured", "ABN", "Notes"],
      ...job.bids.map(bid => [
        bid.name,
        bid.company || "",
        bid.job_type || "",
        `$${bid.price.toFixed(2)}`,
        bid.timeline_days ? `${bid.timeline_days} days` : "",
        bid.email,
        bid.phone,
        bid.insurance ? "Yes" : "No",
        bid.abn || "",
        `"${bid.notes.replace(/"/g, '""')}"` // Escape quotes
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${job.title.replace(/\s+/g, "_")}_bids.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (!secret) {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Admin Access</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <Label htmlFor="secret">Secret Key</Label>
            <Input
              id="secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter admin secret key"
              required
            />
          </div>
          <Button type="submit">Access Dashboard</Button>
        </form>
      </div>
    )
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString()
  }

  // Strategic business metrics
  const totalJobs = jobs.length
  const awardedJobs = jobs.filter(job => job.awarded_bid_id).length
  const totalBids = jobs.reduce((sum, job) => sum + job.bids.length, 0)
  const avgBidsPerJob = totalJobs > 0 ? (totalBids / totalJobs).toFixed(1) : "0"

  return (
    <div className="max-w-6xl mx-auto">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} />
              <span>{totalJobs} jobs • {awardedJobs} awarded</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye size={16} />
              <span>{totalBids} bids • {avgBidsPerJob} avg/job</span>
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            localStorage.removeItem("admin_secret")
            router.push("/")
          }}
        >
          Logout
        </Button>
      </div>

      {/* Business Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-2xl font-bold">{totalJobs}</div>
          <div className="text-sm text-muted-foreground">Total Jobs</div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-2xl font-bold text-green-600">{awardedJobs}</div>
          <div className="text-sm text-muted-foreground">Awarded Jobs</div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-2xl font-bold">{totalBids}</div>
          <div className="text-sm text-muted-foreground">Total Bids</div>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <div className="text-2xl font-bold">{avgBidsPerJob}</div>
          <div className="text-sm text-muted-foreground">Avg Bids/Job</div>
        </div>
      </div>

      {/* Create Job Form */}
      <div className="mb-12 bg-card rounded-xl border p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Job</h2>
        <form onSubmit={createJob} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <div className="md:col-span-2">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={newJobDesc}
              onChange={(e) => setNewJobDesc(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={newJobLocation}
              onChange={(e) => setNewJobLocation(e.target.value)}
              placeholder="e.g., 123 Main St, Sydney"
              required
            />
          </div>

          <div>
            <Label htmlFor="jobType">Required Trade Type *</Label>
            <select
              id="jobType"
              value={newJobType}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setShowCustomInput(true)
                  setNewJobType("custom")
                } else {
                  setNewJobType(e.target.value)
                  setShowCustomInput(false)
                }
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select required trade</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="Carpentry">Carpentry</option>
              <option value="Roofing">Roofing</option>
              <option value="Tiling">Tiling</option>
              <option value="Painting">Painting</option>
              <option value="HVAC">HVAC</option>
              <option value="General">General Labour</option>
              <option value="custom">+ Add custom trade</option>
            </select>
            
            {showCustomInput && (
              <Input
                className="mt-2"
                value={newCustomTrade}
                onChange={(e) => setNewCustomTrade(e.target.value)}
                placeholder="e.g., Landscaping, Asbestos Removal"
                required
              />
            )}
          </div>

          <div>
            <Label htmlFor="deadline">Bid Deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={newJobDeadline}
              onChange={(e) => setNewJobDeadline(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="budget">Budget Range</Label>
            <Input
              id="budget"
              value={newJobBudget}
              onChange={(e) => setNewJobBudget(e.target.value)}
              placeholder="e.g., $5k–$10k"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="attachments">Attachments (URLs, comma-separated)</Label>
            <Input
              id="attachments"
              value={newJobAttachments}
              onChange={(e) => setNewJobAttachments(e.target.value)}
              placeholder="https://example.com/plan.pdf, https://imgur.com/photo.jpg"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="contactPhone">Your Contact Phone</Label>
            <Input
              id="contactPhone"
              value={newJobContactPhone}
              onChange={(e) => setNewJobContactPhone(e.target.value)}
              placeholder="+61 4XX XXX XXX"
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </form>
      </div>

      {/* Active Jobs List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Active Jobs ({jobs.length})</h2>
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadJobs}
          >
            Refresh
          </Button>
        </div>
        
        {jobs.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            No jobs created yet. Create your first job to start receiving bids!
          </p>
        ) : (
          <div className="space-y-6">
            {jobs.map(job => (
              <div key={job.id} className="border rounded-xl p-5 hover:bg-accent/20 transition-colors">
                <div className="flex justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{job.title}</h3>
                      {job.job_type && (
                        <span className="text-sm px-2 py-0.5 bg-primary text-primary-foreground rounded flex items-center gap-1">
                          <Star size={12} />
                          {job.job_type}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span>📍 {job.location}</span>
                      {job.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          Bids close: {formatDate(job.deadline)}
                        </span>
                      )}
                      <span>🆔 {job.id.substring(0, 8)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/jobs/${job.id}`)}
                    >
                      <Eye size={14} />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportBids(job)}
                    >
                      <Download size={14} />
                      Export
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteJob(job.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                
                <p className="mt-3 text-muted-foreground">{job.description}</p>
                
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {job.budget_range && <span>💰 {job.budget_range}</span>}
                  {job.contact_phone && <span>📞 {job.contact_phone}</span>}
                  <span>📋 {job.bids.length} bids</span>
                </div>

                {job.attachments && job.attachments.length > 0 && (
                  <div className="mt-3">
                    <span className="text-sm font-medium">Attachments:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {job.attachments.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs hover:underline"
                        >
                          File {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">
                      Bids ({job.bids.length}) 
                      {job.awarded_bid_id && (
                        <span className="ml-2 text-green-600 flex items-center gap-1">
                          <Award size={14} />
                          Awarded
                        </span>
                      )}
                    </h4>
                    {job.bids.length > 0 && !job.awarded_bid_id && (
                      <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                        Ready to award
                      </span>
                    )}
                  </div>
                  
                  {job.bids.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">No bids yet</p>
                  ) : (
                    <div className="space-y-3 mt-3 max-h-60 overflow-y-auto pr-2">
                      {job.bids.map(bid => (
                        <div 
                          key={bid.id} 
                          className={`p-3 rounded-lg border ${
                            bid.awarded ? "border-primary bg-primary/5" : "border-border"
                          }`}
                        >
                          <div className="flex justify-between">
                            <div>
                              <div className="font-medium">
                                {bid.company ? `${bid.name} (${bid.company})` : bid.name}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                                <span>${bid.price.toFixed(2)}</span>
                                {bid.timeline_days && (
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {bid.timeline_days}d
                                  </span>
                                )}
                                {bid.job_type && (
                                  <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded">
                                    {bid.job_type}
                                  </span>
                                )}
                                {bid.insurance && (
                                  <Shield size={12} className="text-green-600" />
                                )}
                              </div>
                            </div>
                            {!job.awarded_bid_id && !bid.awarded && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => awardBid(job.id, bid.id)}
                              >
                                Award
                              </Button>
                            )}
                            {bid.awarded && (
                              <span className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded-full flex items-center gap-1">
                                <Award size={12} />
                                Awarded
                              </span>
                            )}
                          </div>
                          {(bid.email || bid.phone) && (
                            <div className="text-xs mt-2">
                              {bid.email && <span>✉️ {bid.email}</span>}
                              {bid.phone && <span className="ml-2">📞 {bid.phone}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}