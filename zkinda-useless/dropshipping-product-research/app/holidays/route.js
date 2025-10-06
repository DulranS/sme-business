"use server";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const country = searchParams.get('country') || 'US';
  const year = searchParams.get('year') || '2024';

  try {
    const response = await fetch(
      `https://api.api-ninjas.com/v1/holidays?country=${country}&year=${year}&type=observance`
    );
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching holidays:", error);
    return NextResponse.json(
      { error: "Failed to fetch holidays" },
      { status: 500 }
    );
  }
}
