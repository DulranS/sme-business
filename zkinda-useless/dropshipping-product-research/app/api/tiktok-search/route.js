const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

if (!RAPIDAPI_KEY) {
  throw new Error('RAPIDAPI_KEY is missing');
}

export async function POST(request) {
  try {
    const { keyword } = await request.json();
    if (!keyword || keyword.length === 0) {
      return new Response(JSON.stringify({ error: 'Keyword is required' }), { status: 400 });
    }

    const encodedKeyword = encodeURIComponent(keyword);
    const apiUrl = `https://tiktok-apis.p.rapidapi.com/v1/tiktok/search/user?keyword=${encodedKeyword}`;

    const apiRequest = new Request(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'tiktok-apis.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    const apiResponse = await fetch(apiRequest);

    // Check for HTTP errors
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to fetch data from the API' }), { status: apiResponse.status });
    }

    const data = await apiResponse.json();

    if (data.error) {
      console.log('Error in TikTok API:', data.error);
      return new Response(JSON.stringify({ error: 'An error occurred in the TikTok API' }), { status: 500 });
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error('Error in /api/search:', error);
    return new Response(JSON.stringify({ error: 'An error occurred', details: error.message }), { status: 500 });
  }
}