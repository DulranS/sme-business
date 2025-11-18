import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase-server";

// GET: Fetch all jobs
// Replace your current GET method with this:
export async function GET() {
  // First get all jobs
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, description, location, job_type, deadline, budget_range, attachments, contact_phone, awarded_bid_id, created_at")
    .order("created_at", { ascending: false });

  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  // Then get all bids for these jobs in a single query
  const jobIds = jobs.map(job => job.id);
  let bidsMap: Record<string, any[]> = {};
  
  if (jobIds.length > 0) {
    const { data: allBids, error: bidsError } = await supabase
      .from("bids")
      .select("*")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    if (bidsError) {
      return NextResponse.json({ error: bidsError.message }, { status: 500 });
    }

    // Group bids by job_id
    bidsMap = allBids.reduce((acc, bid) => {
      if (!acc[bid.job_id]) acc[bid.job_id] = [];
      acc[bid.job_id].push(bid);
      return acc;
    }, {} as Record<string, any[]>);
  }

  // Combine jobs with their bids
  const jobsWithBids = jobs.map(job => ({
    ...job,
    bids: bidsMap[job.id] || []
  }));

  return NextResponse.json(jobsWithBids);
}

// POST: Create new job
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { 
    title, 
    description, 
    location, 
    job_type, 
    deadline, 
    budget_range, 
    attachments,
    contact_phone
  } = await request.json();

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      title,
      description,
      location: location || "",
      job_type: job_type || null,
      deadline: deadline || null,
      budget_range: budget_range || null,
      attachments: attachments || [],
      contact_phone: contact_phone || null
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// 👇 NEW: DELETE job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delete job (bids will be auto-deleted due to foreign key constraint)
  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}