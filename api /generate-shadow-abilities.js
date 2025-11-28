// /api/generate-shadow-abilities.js
// Vercel serverless function for calling OpenAI to generate abilities.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res
      .status(500)
      .json({ error: "Missing OPENAI_API_KEY in environment variables." });
    return;
  }

  try {
    const { shadows, totalAsp, spentAsp, availableAsp, selectedBuffIds, notes } =
      req.body || {};

    const shadowSummary =
      !Array.isArray(shadows) || !shadows.length
        ? "No shadows currently stored."
        : shadows
            .map(
              (s) =>
                `Name: ${s.name || "(Unnamed)"} | SL ${s.shadowLevel} | Raw Might ${
                  s.rawMight
                } | Template: ${s.ttLabel} | Active: ${
                  s.active ? "Yes" : "No"
                }`
            )
            .join("\n");

    const activeBuffsText =
      !Array.isArray(selectedBuffIds) || !selectedBuffIds.length
        ? "No active buffs."
        : selectedBuffIds.join(", ");

    const userPrompt = `
You are helping design powerful but playable One Piece-style shadow abilities for a D&D-like campaign.

Current Shadow Fruit state:

Total ASP: ${totalAsp}
Spent ASP: ${spentAsp}
Available ASP: ${availableAsp}

Shadows:
${shadowSummary}

Selected buffs (IDs or names): ${activeBuffsText}

Extra notes / theme from user:
${notes || "(none)"}

TASK:
1. Propose 3–5 unique, named shadow techniques (attacks or utility), using cool One Piece-style names. 
   - For each, give: Name, Short description, Suggested damage dice or mechanical effect, and any save/DC if relevant.
2. Propose 1–3 transformation forms that fit the current level of power (based on ASP and shadows).
   - Briefly describe the form, what changes visually, and what it mechanically boosts.
3. Propose 1–2 special abilities for reanimated corpses powered by these shadows.
   - Make them flavorful and tied to the idea that the corpse has physical durability plus shadow-based powers.

Output in a clean, game-usable text format, with clear headings and bullet points. Avoid referencing D&D rules directly by name (no "CR"), but it's okay to use generic terms like "attack roll", "saving throw", "DC", and "action".
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert One Piece + D&D homebrew designer. You create powerful but playable shadow abilities with cool names and clear mechanics."
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 900
      })
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("OpenAI error:", text);
      res.status(500).json({ error: "OpenAI API error", details: text });
      return;
    }

    const data = await openaiRes.json();
    const text =
      data.choices?.[0]?.message?.content ||
      "No content returned from the AI model.";

    res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
