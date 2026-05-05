export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Is "${name}" still alive? Search the web for the most current information. Then respond with ONLY a raw JSON object (no markdown, no backticks, no explanation) in this exact shape:
{"name":"canonical full name","status":"alive","summary":"1-2 sentence answer with age or death date and cause if known","meta":"source and date, e.g. Wikipedia, May 2026"}`
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Anthropic API error: ${errText}` });
    }

    const data = await response.json();
    const textBlock = (data.content || []).filter(b => b.type === 'text').pop();
    if (!textBlock) return res.status(502).json({ error: 'No text response from AI' });

    let raw = textBlock.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(502).json({ error: 'Could not parse AI response' });
    }
    raw = raw.slice(jsonStart, jsonEnd + 1);

    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
