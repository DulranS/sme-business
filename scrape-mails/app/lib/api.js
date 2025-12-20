// app/lib/api.js
export async function submitCSV(csvText) {
  const res = await fetch('/api/proxy-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv_content: csvText }),
  });
  if (!res.ok) throw new Error('Failed to start scraping');
  return res.json();
}

export async function getJobStatus(jobId) {
  const res = await fetch(`/api/proxy-status/${jobId}`);
  if (!res.ok) throw new Error('Job not found');
  return res.json();
}