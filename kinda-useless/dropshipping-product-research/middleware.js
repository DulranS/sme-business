// middleware.js

import { NextResponse } from "next/server";
import { rateLimiter } from "./lib/rateLimiter";

export async function middleware(request) {
    const rateLimitResult = await rateLimiter(request);
    if (!rateLimitResult.success) {
        return NextResponse.json({ error: 'Too many requests, please subscribe to remove rate limiting.' }, { status: 429 });
    }
    
    // If rate limit check passes, continue to the next middleware or route handler
    return NextResponse.next();
}

// Specify which routes this middleware should run on:
export const config = {
    matcher: '/api/:path*',
};