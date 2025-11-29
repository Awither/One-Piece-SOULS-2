// /api/generate-soul-abilities.js
// Vercel Serverless Function – Calls OpenAI Chat Completions
// Uses process.env.OPENAI_API_KEY

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured." });
  }

  try {
    const { souls, homies, domains, notes } = req.body || {};

    const soulCount = Array.isArray(souls) ? souls.length : 0;
    const homieCount = Array.isArray(homies) ? homies.length : 0;
    const domainCount = Array.isArray(domains) ? domains.length : 0;

    const systemPrompt = `
You are an expert tabletop RPG designer and One Piece lore master, channeling Big Mom's Soru Soru no Mi (Soul-Soul Fruit).
The user is running a D&D-style game with a custom soul & homie system. They want mechanically tight, flavorful abilities.

Your output MUST be STRICT JSON, with no commentary, no markdown, and no extra keys. Do NOT use trailing commas.
Return an object:

{
  "abilities": [
    {
      "name": string,
      "assignTo": string,              // "general" or a name like "Prometheus", "Domain: Candy Coast", etc.
      "actionType": string,            // "Action", "Bonus Action", "Reaction", "Lair Action", etc.
      "range": string,
      "target": string,
      "saveOrDC": string,              // e.g. "Wis save vs. DC 18" or "no save"
      "damageDice": string,            // e.g. "6d10 necrotic + 4d8 thunder"
      "effect": string,                // concise but detailed mechanical effect text
      "combo": string                  // synergies with homies / domains / souls
    }
  ]
}

Guidelines:
- Make abilities powerful, versatile, and fun to play, but still readable at the table.
- Use the souls' traits and SoL/SPU scale to flavor impact.
- Include a mix of:
  - Homie abilities
  - Healing/support abilities
  - Territory / lair actions
  - Signature homie powers (sun, storm, weapons, custom elements)
  - Soul-Fruit themed abilities (fear, HP drain, soul fragments, etc.)
- Some abilities should clearly reference homie names or domain names provided by the user.
- Some should be "general" abilities usable by the main Soul-Fruit user.
- Make at least 8 abilities, up to ~20, depending on how much material the user has.
`;

    const userSummary = `
SOUL BANK (count: ${soulCount})
${JSON.stringify(souls || [], null, 2)}

HOMIES (count: ${homieCount})
${JSON.stringify(homies || [], null, 2)}

DOMAINS (count: ${domainCount})
${JSON.stringify(domains || [], null, 2)}

USER NOTES:
${notes || "(none)"}
`;

    const body = {
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Using the following data, design soul- and homie-themed abilities. Remember: respond ONLY with valid JSON.\n\n${userSummary}`
        }
      ],
      temperature: 0.9
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenAI API error:", text);
      return res.status(500).json({ error: "OpenAI API error", details: text });
    }

    const json = await response.json();
    const rawContent = json?.choices?.[0]?.message?.content || "";

    let abilities = [];
    try {
      const parsed = JSON.parse(rawContent);
      if (parsed && Array.isArray(parsed.abilities)) {
        abilities = parsed.abilities.map((a) => ({
          name: a.name || "Soul Ability",
          assignTo: a.assignTo || "",
          actionType: a.actionType || "",
          range: a.range || "",
          target: a.target || "",
          saveOrDC: a.saveOrDC || a.save || "",
          damageDice: a.damageDice || "",
          effect: a.effect || a.mechanicalEffect || "",
          combo: a.combo || a.interactions || ""
        }));
      }
    } catch (err) {
      console.error("Failed to parse JSON from OpenAI:", err, rawContent);
      // Fallback: return raw text for debugging
      return res.status(200).json({
        abilities: [],
        raw: rawContent
      });
    }

    return res.status(200).json({
      abilities
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
