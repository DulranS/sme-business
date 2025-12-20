// app/api/proxy-scrape/route.js

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Backend timed out')), ms)
    )
  ]);
}

export async function POST(request) {
  const backendUrl = 'https://sme-business.onrender.com';
  const body = await request.json();

  try {
    const proxyRes = await withTimeout(
      fetch(`${backendUrl}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      540000 // 9 minutes (Render max execution = 5 min, but we give buffer)
    );

    const data = await proxyRes.json();
    return Response.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return Response.json({ error: 'Backend unreachable or timed out' }, { status: 504 });
  }
}