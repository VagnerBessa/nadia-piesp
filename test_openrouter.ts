async function test() {
  const OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;
  const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
  
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://seade.gov.br',
      'X-Title': 'Nadia PIESP'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'Oi' }]
    })
  });
  
  if (!response.ok) {
    console.error("OpenRouter Error:", await response.text());
  } else {
    console.log("OpenRouter Success:", await response.json());
  }
}
test().catch(console.error);
