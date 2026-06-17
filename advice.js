// Vercel Serverless Function — jembatan aman ke Claude API.
// API key disimpan di Environment Variable Vercel (ANTHROPIC_API_KEY),
// tidak pernah ikut ke browser. Frontend memanggil /api/advice.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Gunakan POST" });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY belum diset di Vercel" });
  }
  try {
    const { prompt } = req.body || {};
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return res.status(200).json({ text: text || "Tidak ada saran." });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
