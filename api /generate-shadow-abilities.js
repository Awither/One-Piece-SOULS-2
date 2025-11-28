// api/generate-soul-abilities.js
// Vercel serverless function for calling OpenAI to generate Soul Fruit abilities.

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
    const {
      souls = [],
      totalSpu = 0,
      spentSpu = 0,
      availableSpu = 0,
      selectedBuffIds = [],
      notes = ""
    } = req.body || {};

    const soulSummary =
      !Array.isArray(souls) || !souls.length
        ? "No souls currently stored."
        : souls
            .map(
              (s) =>
                `Name: ${s.name || "(Unnamed)"} | SL ${s.soulLevel} | SPU ${
                  s.spu
                } | Power ${s.power} | Fear ${s.fear} | Attachment ${
                  s.attachment
                } | Active: ${s.active ? "Yes" : "No"}`
            )
            .join("\n");

    const activeBuffsText =
      !Array.isArray(selectedBuffIds) || !selectedBuffIds.length
        ? "No active boons."
        : selectedBuffIds.join(", ");

    const userPrompt = `
You are helping design powerful but playable One Piece–style Soul Fruit abilities
for a D&D-like campaign. The Soul Fruit works like Big Mom’s: it steals lifespan / souls,
stores them as a resource (SPU = Soul Power Units), and can create “homies” (sentient
objects or elementals) or empower allies.

Current Soul Fruit state:

Total SPU: ${totalSpu}
Spent SPU: ${spentSpu}
Available SPU: ${availableSpu}

Souls:
${soulSummary}

Selected boons / buffs (IDs or names): ${activeBuffsText}

Extra notes / theme from user:
${notes || "(none)"}

TASK:
1. Propose 3–5 unique, named Soul Fruit techniques (attacks or utility).
   - For each: Name, short description, clear mechanical effect (damage dice, save type / DC, conditions, action type, range, duration).
   - These should feel like high-level D&D abilities flavored with Big Mom–style soul control.
2. Propose 1–3 homie or soul-construct abilities.
   - Focus on what special things homies can do in combat or utility (movement tricks, resistances, auras, etc.).
3. Propose 1–2 soul-contract or “lifespan bargain” style abilities.
   - These should trade lifespan or SPU for big effects, with clear costs and risks.

Output in a clean, game-usable plain text format with clear headings and bullet-like lines,
but DO NOT use markdown syntax. It's okay to use terms like "attack roll", "saving throw",
"DC", and "action". Avoid referencing D&D by name or talking about rules out of character.
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert One Piece + D&D homebrew designer. You create powerful but playable Soul Fruit and homie abilities with clear mechanics."
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 1100
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
    res
      .status(500)
      .json({ error: "Internal server error", details: String(err) });
  }
}
