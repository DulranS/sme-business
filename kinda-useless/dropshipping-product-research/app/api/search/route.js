// app/api/search/route.js
"use server"
import { scrapeAliExpress } from '@/lib/scraper';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try { 
    const { searchTerm } = await request.json();
    if (!searchTerm) {
      return NextResponse.json({ error: 'Search term is required' }, { status: 400 });
    }

    const scrapedProducts = await scrapeAliExpress(searchTerm);
    // const analyzedProducts = await analyzeProducts(scrapedProducts);
    // const topProducts = analyzedProducts.slice(0, 15); // Get top 15 products

    const response = NextResponse.json(scrapedProducts, { status: 200 });

    // Set CORS headers
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Origin', '*'); // Replace '*' with your frontend domain
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    return response;
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json({ error: 'Failed to search products' }, { status: 500 });
  }
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });

  // Set CORS headers
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Origin', '*'); // Replace '*' with your frontend domain
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  return response;
}