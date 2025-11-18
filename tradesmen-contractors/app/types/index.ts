// types/index.ts
export type Bid = {
  id: string;
  job_id: string;
  job_type: string | null;        // Bidder's declared specialty
  name: string;
  company: string | null;
  contact: string;
  phone: string;
  email: string;
  price: number;
  timeline_days: number | null;
  insurance: boolean;
  abn: string | null;
  notes: string;
  portfolio_urls: string[];
  awarded: boolean;
  created_at: string;
};

export type Job = {
  id: string;
  title: string;
  description: string;
  location: string;
  job_type: string | null;        // Required trade for this job
  deadline: string | null;
  budget_range: string | null;
  attachments: string[];
  contact_phone: string;
  awarded_bid_id: string | null;
  custom_trades: string[];        // 👈 ADD THIS (from your Postgres query)
  created_at: string;
  bids: Bid[];
};