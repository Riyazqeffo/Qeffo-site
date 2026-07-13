// Netlify serverless function: reads a screenshot of one or more forwarded
// LinkedIn job preview cards (e.g. shared via WhatsApp) and returns structured
// job data using Claude's vision capability.
//
// Requires an ANTHROPIC_API_KEY environment variable to be set in your
// Netlify site settings (Site configuration → Environment variables).
// Get a key at https://console.anthropic.com

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let image, mediaType;
  try {
    const parsed = JSON.parse(event.body || '{}');
    image = parsed.image;
    mediaType = parsed.mediaType || 'image/png';
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No image provided' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server not configured: set ANTHROPIC_API_KEY in your Netlify environment variables' })
    };
  }

  const prompt = `You are reading a screenshot of one or more forwarded LinkedIn job posting previews (e.g. shared via WhatsApp). Each preview typically follows this pattern:

"{Company} hiring {Job Title} in {Location} | LinkedIn"
"Posted {time}. {short description}...See this and similar jobs on LinkedIn."
"www.linkedin.com"
followed by a link like "https://www.linkedin.com/jobs/view/{id}"

Extract EVERY distinct job preview visible in the image. For each one, return an object with:
- "company": the hiring company or recruiter name
- "title": the job title
- "location": the location as shown
- "url": the linkedin.com/jobs/view/... link if visible in the image, otherwise an empty string

Respond with ONLY a raw JSON array, no markdown code fences, no preamble, no explanation. Example:
[{"company":"Acme Corp","title":"Data Analyst","location":"Dubai, UAE","url":"https://www.linkedin.com/jobs/view/123456"}]

If no job previews are visible, respond with exactly: []`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
              { type: 'text', text: prompt }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data?.error?.message || 'Claude API request failed' })
      };
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    let jobs = [];
    try {
      const cleaned = (textBlock?.text || '[]').replace(/```json|```/g, '').trim();
      jobs = JSON.parse(cleaned);
      if (!Array.isArray(jobs)) jobs = [];
    } catch (e) {
      jobs = [];
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
