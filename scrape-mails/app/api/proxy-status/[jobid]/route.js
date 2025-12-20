// app/api/proxy-status/[jobId]/route.js

export async function GET(request, { params }) {
  const { jobId } = params;
  const backendUrl = 'https://sme-business.onrender.com';

  try {
    const proxyRes = await fetch(`${backendUrl}/api/status/${jobId}`);
    if (!proxyRes.ok) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    const data = await proxyRes.json();
    return Response.json(data);
  } catch (err) {
    console.error('Proxy status error:', err);
    return Response.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}