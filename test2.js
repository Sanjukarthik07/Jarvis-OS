async function test() {
  const messages = [
    { role: 'system', content: "You are J.A.R.V.I.S..." },
    { role: 'user', content: "hello" }
  ];
  try {
    let res = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: 'openai' })
    });
    console.log("Status:", res.status, res.ok);
    let data = await res.json();
    console.log("Data:", JSON.stringify(data).substring(0, 200));
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
