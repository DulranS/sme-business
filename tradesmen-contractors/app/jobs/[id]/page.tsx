"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Job, Bid } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Label } from "@/app/components/ui/label"
import { CheckCircle, Plus, Filter, Trash2, Clock, Star, Shield } from "lucide-react"

// Predefined trade types
const PREDEFINED_TRADES = [
  "Plumbing", "Electrical", "Carpentry", "Roofing", 
  "Tiling", "Painting", "HVAC", "General"
] as const

export default function JobPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<Job | null>(null)
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [contact, setContact] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [price, setPrice] = useState("")
  const [timeline, setTimeline] = useState("")
  const [insurance, setInsurance] = useState(false)
  const [abn, setAbn] = useState("")
  const [notes, setNotes] = useState("")
  const [portfolio, setPortfolio] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bidderTrade, setBidderTrade] = useState("")
  const [customTradeInput, setCustomTradeInput] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  
  const router = useRouter()

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${params.id}`)
        if (!res.ok) throw new Error("Failed to fetch job")
        const data = await res.json()
        setJob(data as Job)
      } catch (error) {
        console.error("Fetch job error:", error)
      }
    }
    fetchJob()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const portfolioUrls = portfolio
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean)

    try {
      const res = await fetch(`/api/jobs/${params.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          contact,
          phone,
          email,
          price: parseFloat(price) || 0,
          timeline_days: timeline ? parseInt(timeline, 10) : null,
          insurance,
          abn,
          job_type: bidderTrade || null,
          notes,
          portfolioUrls,
        }),
      })

      if (res.ok) {
        router.refresh()
        setName("")
        setCompany("")
        setContact("")
        setPhone("")
        setEmail("")
        setPrice("")
        setTimeline("")
        setInsurance(false)
        setAbn("")
        setNotes("")
        setPortfolio("")
        setBidderTrade("")
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(`Submission failed: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Bid submission error:", error)
      alert("Network error. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString()
  }

  const formatPrice = (price: number | string | null | undefined): string => {
    if (price == null) return "0.00"
    const num = typeof price === "string" ? parseFloat(price) : price
    return isNaN(num) ? "0.00" : num.toFixed(2)
  }

  const isImageUrl = (url: string): boolean => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
  }

  const getUniqueBidTrades = () => {
    if (!job) return []
    const trades = new Set<string>()
    job.bids.forEach(bid => {
      if (bid.job_type) trades.add(bid.job_type)
    })
    return Array.from(trades).sort()
  }

  const filteredBids = job?.bids.filter(bid => 
    !selectedFilter || bid.job_type === selectedFilter
  ) || []

  const deleteJob = async () => {
    if (!confirm("Are you sure you want to delete this job? All bids will be permanently lost.")) return
    
    try {
      const res = await fetch(`/api/jobs/${params.id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": localStorage.getItem("admin_secret") || "" }
      })
      
      if (res.ok) {
        alert("Job deleted successfully")
        router.push("/dashboard")
      } else {
        alert("Failed to delete job. You may not have admin access.")
      }
    } catch (error) {
      console.error("Delete job error:", error)
      alert("Network error")
    }
  }

  if (!job) {
    return (
      <div className="max-w-2xl mx-auto py-10 flex justify-center">
        <div className="animate-pulse">Loading job details...</div>
      </div>
    )
  }

  // Check if user is admin (for delete button)
  const isAdmin = typeof window !== "undefined" && 
    localStorage.getItem("admin_secret") === process.env.NEXT_PUBLIC_ADMIN_SECRET

  return (
    <div className="max-w-4xl mx-auto">
      {/* Job Header */}
      <div className="mb-8 p-6 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-primary">{job.title}</h1>
              
              {job.job_type ? (
                <span className="text-sm px-3 py-1 bg-primary text-primary-foreground rounded-full font-medium flex items-center gap-1">
                  <Star size={14} />
                  Requires: {job.job_type}
                </span>
              ) : (
                <span className="text-sm px-3 py-1 bg-muted text-muted-foreground rounded-full font-medium">
                  Trade not specified
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground mt-2">
              <div className="flex items-center gap-1">
                <span>📍</span>
                <span>{job.location}</span>
              </div>
              {job.deadline && (
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>Bids close: {formatDate(job.deadline)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>🆔</span>
                <span className="font-mono text-xs">{job.id.substring(0, 8)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {isAdmin && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={deleteJob}
                className="flex items-center gap-1"
              >
                <Trash2 size={14} />
                Delete Job
              </Button>
            )}
            
            <span className={`px-4 py-2 rounded-full font-semibold ${
              job.awarded_bid_id 
                ? "bg-green-100 text-green-800" 
                : "bg-yellow-100 text-yellow-800"
            }`}>
              {job.awarded_bid_id ? "AWARDED" : "ACCEPTING BIDS"}
            </span>
          </div>
        </div>
        
        <p className="text-muted-foreground my-4">{job.description}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {job.budget_range && (
            <div className="flex items-center gap-2">
              <span className="font-medium">💰 Budget:</span>
              <span>{job.budget_range}</span>
            </div>
          )}
          {job.contact_phone && (
            <div className="flex items-center gap-2">
              <span className="font-medium">📞 Contact:</span>
              <span>{job.contact_phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="font-medium">📋 Bids:</span>
            <span>{job.bids.length} submitted</span>
          </div>
        </div>

        {job.attachments && job.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Label className="text-sm font-medium">Attachments:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {job.attachments.map((url: string, i: number) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  File {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bid Submission */}
      {!job.awarded_bid_id && (
        <div className="mb-12 bg-card rounded-xl border p-6">
          <h2 className="text-xl font-bold mb-4 text-primary">Submit Your Bid</h2>
          <p className="text-muted-foreground mb-6">
            Provide your best quote and details. Winning bidders are typically licensed, insured, and provide clear timelines.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="company">Company Name</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompany(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="price">Total Price ($AUD) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="timeline">Completion Timeline (days) *</Label>
                <Input
                  id="timeline"
                  type="number"
                  min="1"
                  value={timeline}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeline(e.target.value)}
                  required
                  placeholder="e.g., 7"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="abn">License/ABN</Label>
                <Input
                  id="abn"
                  value={abn}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAbn(e.target.value)}
                  placeholder="e.g., ABN 12 345 678 901"
                />
              </div>
              <div className="flex items-start space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="insurance"
                  checked={insurance}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInsurance(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="insurance" className="text-sm flex items-center gap-1">
                  <Shield size={14} />
                  I confirm I am licensed and insured for this work
                </Label>
              </div>
            </div>

            {/* Bidder's Trade Specialty */}
            <div>
              <Label htmlFor="bidderTrade">Your Trade Specialty *</Label>
              <div className="mt-1">
                <select
                  id="bidderTrade"
                  value={bidderTrade}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setShowCustomInput(true)
                      setBidderTrade("")
                    } else {
                      setBidderTrade(e.target.value)
                      setShowCustomInput(false)
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select your specialty</option>
                  {PREDEFINED_TRADES.map(trade => (
                    <option key={trade} value={trade}>{trade}</option>
                  ))}
                  <option value="custom">+ Add custom trade</option>
                </select>
                
                {showCustomInput && (
                  <Input
                    className="mt-2"
                    value={customTradeInput}
                    onChange={(e) => setCustomTradeInput(e.target.value)}
                    placeholder="e.g., Landscaping, Asbestos Removal, Solar Installation"
                    required
                    onBlur={() => {
                      if (customTradeInput.trim()) {
                        setBidderTrade(customTradeInput.trim())
                        setShowCustomInput(false)
                      }
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="contact">Preferred Contact Method</Label>
              <Input
                id="contact"
                value={contact}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(e.target.value)}
                placeholder="e.g., WhatsApp, SMS, Email"
              />
            </div>

            <div>
              <Label htmlFor="portfolio">Portfolio Images (URLs, comma-separated)</Label>
              <Input
                id="portfolio"
                value={portfolio}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPortfolio(e.target.value)}
                placeholder="https://i.imgur.com/abc.jpg, https://example.com/photo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste direct image links (right-click image → "Copy image address")
              </p>
              
              {/* Preview */}
              {portfolio && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground">Preview:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {portfolio
                      .split(',')
                      .map(url => url.trim())
                      .filter(Boolean)
                      .map((url, i) => (
                        isImageUrl(url) ? (
                          <img
                            key={i}
                            src={url}
                            alt="Preview"
                            className="w-12 h-12 object-cover rounded border"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <span key={i} className="text-xs px-2 py-1 bg-muted rounded">
                            Not image
                          </span>
                        )
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Proposal Details *</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                required
                placeholder="Describe your approach, experience with similar jobs, materials you'll use, and why you're the best choice..."
                className="min-h-[120px]"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full md:w-auto px-8 py-3"
            >
              {isSubmitting ? "Submitting..." : "Submit Bid"}
            </Button>
          </form>
        </div>
      )}

      {/* Awarded Notice */}
      {job.awarded_bid_id && (
        <div className="mb-12 p-6 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={24} />
            <div>
              <h2 className="font-bold text-green-800 text-lg">Job Awarded!</h2>
              <p className="text-green-700 mt-1">
                This job has been awarded to a subcontractor. Thank you to all bidders!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bids List */}
      <div>
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <h2 className="text-xl font-bold">Submitted Bids ({job.bids.length})</h2>
          
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm bg-secondary px-3 py-1 rounded-full">
              <Filter size={14} />
              <span>Filter by Trade:</span>
            </div>
            
            <button
              onClick={() => setSelectedFilter(null)}
              className={`px-3 py-1 text-sm rounded-full ${
                selectedFilter === null 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-accent"
              }`}
            >
              All
            </button>
            
            {getUniqueBidTrades().map(trade => (
              <button
                key={trade}
                onClick={() => setSelectedFilter(trade)}
                className={`px-3 py-1 text-sm rounded-full ${
                  selectedFilter === trade 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-accent"
                }`}
              >
                {trade}
              </button>
            ))}
          </div>
        </div>
        
        {job.bids.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            No bids submitted yet. Be the first to bid!
          </p>
        ) : (
          <div className="space-y-4">
            {filteredBids.map((bid: Bid) => (
              <div 
                key={bid.id} 
                className={`border rounded-xl p-5 ${
                  bid.awarded 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:bg-accent/30 transition-colors"
                }`}
              >
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-bold text-lg">
                      {bid.company ? `${bid.name} (${bid.company})` : bid.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-muted-foreground">
                      <span className="font-medium">${formatPrice(bid.price)}</span>
                      {bid.timeline_days != null && (
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {bid.timeline_days} days
                        </span>
                      )}
                      {bid.insurance && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Shield size={14} />
                          Licensed & Insured
                        </span>
                      )}
                      
                      {bid.job_type && (
                        <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded flex items-center gap-1">
                          <Star size={12} />
                          {bid.job_type}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {bid.awarded && (
                    <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <CheckCircle size={16} />
                      AWARDED
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    {(bid.email || bid.phone) && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          {bid.email && <span>✉️ {bid.email}</span>}
                          {bid.phone && <span>📞 {bid.phone}</span>}
                        </div>
                        {bid.contact && <div className="mt-1">💬 {bid.contact}</div>}
                        {bid.abn && <div className="mt-1">🔖 {bid.abn}</div>}
                      </div>
                    )}
                    
                    {bid.notes && (
                      <div className="mt-3">
                        <p className="text-sm italic bg-muted p-3 rounded-lg">
                          "{bid.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Portfolio Preview */}
                  {bid.portfolio_urls && bid.portfolio_urls.length > 0 && (
                    <div className="md:border-l md:pl-4">
                      <p className="text-sm font-medium mb-2">Portfolio:</p>
                      <div className="flex flex-wrap gap-2">
                        {bid.portfolio_urls.map((url: string, i: number) => {
                          const isImage = isImageUrl(url)
                          return (
                            <div key={i} className="relative group">
                              {isImage ? (
                                <img
                                  src={url}
                                  alt={`Portfolio ${i + 1}`}
                                  className="w-16 h-16 object-cover rounded border hover:opacity-90 transition cursor-pointer"
                                  onClick={() => window.open(url, '_blank')}
                                />
                              ) : (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary text-xs hover:underline px-2 py-1 bg-muted rounded inline-block"
                                >
                                  Link {i + 1}
                                </a>
                              )}
                            </div>
                          )
                        })}
                      </div>
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