import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase-server";

// GET: Fetch all jobs
export async function GET() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, description, location, job_type, deadline, budget_range, attachments, contact_phone, awarded_bid_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add empty bids array for compatibility
  const jobs = data.map(job => ({ ...job, bids: [] }));
  return NextResponse.json(jobs);
}

// POST: Create new job
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.ADMIN_SECRET) {
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
  if (authHeader !== process.env.ADMIN_SECRET) {
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