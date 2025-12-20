// app/api/proxy-scrape/route.js

export async function POST(request) {
  const backendUrl = 'https://sme-business.onrender.com';
  const body = await request.json();

  try {
    const proxyRes = await fetch(`${backendUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!proxyRes.ok) {
      throw new Error(`Backend error: ${proxyRes.status}`);
    }

    const data = await proxyRes.json();
    return Response.json(data);
  } catch (err) {
    console.error('Proxy scrape error:', err);
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}