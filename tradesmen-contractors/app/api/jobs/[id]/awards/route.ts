import { supabase } from "@/app/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = request.headers.get("x-admin-secret");
  if (authHeader !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bidId } = await request.json();

  // 1. Un-award all other bids for this job
  await supabase
    .from("bids")
    .update({ awarded: false })
    .eq("job_id", params.id);

  // 2. Award the selected bid
  const { error: awardError } = await supabase
    .from("bids")
    .update({ awarded: true })
    .eq("id", bidId)
    .eq("job_id", params.id);

  if (awardError) {
    return NextResponse.json({ error: awardError.message }, { status: 500 });
  }

  // 3. Update job's awarded_bid_id
  const { error: jobError } = await supabase
    .from("bids")
    .update({ awarded_bid_id: bidId })
    .eq("id", params.id);

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}