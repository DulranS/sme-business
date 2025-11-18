import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Fetch job
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", params.id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Fetch bids with job_type (bidder's specialty)
  const {  data: bids, error: bidsError } = await supabase
    .from("bids")
    .select("*")
    .eq("job_id", params.id)
    .order("created_at", { ascending: false });

  if (bidsError) {
    return NextResponse.json({ error: bidsError.message }, { status: 500 });
  }

  return NextResponse.json({ ...job, bids });
}