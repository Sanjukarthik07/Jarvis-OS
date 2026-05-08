fetch('https://text.pollinations.ai/openai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      {role:'system', content:"You are JARVIS, an advanced AI assistant created by Major-Domo. You speak in a dry, sophisticated, British tone. You are highly intelligent, extremely helpful, and concise. Do not repeat the user's prompt. Just provide the answer directly."},
      {role:'user', content:'hello'}
    ]
  })
})
.then(r => r.json())
.then(d => console.log('CONTENT:', JSON.stringify(d.choices[0].message.content)))
.catch(console.error);
