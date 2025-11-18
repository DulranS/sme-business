import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase-server";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { 
    name, 
    company, 
    contact, 
    phone, 
    email, 
    price, 
    timeline_days, 
    insurance, 
    abn, 
    job_type, // 👈 NEW
    notes, 
    portfolioUrls 
  } = await request.json();

  if (!name || price === undefined || !job_type) { // 👈 job_type is now required
    return NextResponse.json({ error: "Name, price, and trade specialty required" }, { status: 400 });
  }

  // Verify job exists
  const {  data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", params.id)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { error } = await supabase.from("bids").insert({
    job_id: params.id,
    job_type: job_type, // 👈 Store bidder's specialty
    name,
    company: company || null,
    contact: contact || "",
    phone: phone || "",
    email: email || "",
    price: parseFloat(price),
    timeline_days: timeline_days ? parseInt(timeline_days) : null,
    insurance: insurance || false,
    abn: abn || null,
    notes: notes || "",
    portfolio_urls: portfolioUrls || [],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}