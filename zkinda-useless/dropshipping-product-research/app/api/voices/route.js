"use server";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const options = {
    method: "GET",
  };

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/shared-voices?featured=true",
      options
    );
    const data = await response.json();
    console.log(JSON.stringify(data));
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching voices:", error);
    return NextResponse.json(
      { error: "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
