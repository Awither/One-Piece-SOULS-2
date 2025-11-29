// api/generate-soul-abilities.js
//
// Vercel serverless function.
//
// Expects POST with JSON body:
//   { mode: "homieAttack" | "domainLair" | "genericAbility", ... }
//
// Responds with:
//   { success: true, text: string, structured?: object }
// or
//   { success: false, error: string }

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      success: false,
      error: "OPENAI_API_KEY is not set in the environment.",
    });
    return;
  }

  let body;
  try {
    body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object") {
      throw new Error("Empty or invalid body.");
    }
  } catch (err) {
    res.status(400).json({
      success: false,
      error: "Invalid JSON body: " + err.message,
    });
    return;
  }

  const { mode } = body;
  if (!mode) {
    res.status(400).json({
      success: false,
      error: "Missing 'mode' in request body.",
    });
    return;
  }

  try {
    const { systemPrompt, userPrompt } = buildPrompts(body);

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
        }),
      }
    );

    const text = await openaiRes.text();
    if (!openaiRes.ok) {
      console.error("OpenAI API error:", text);
      res.status(openaiRes.status).json({
        success: false,
        error: `OpenAI API error: ${text}`,
      });
      return;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse OpenAI response JSON:", err, text);
      res.status(500).json({
        success: false,
        error: "Failed to parse OpenAI response JSON.",
      });
      return;
    }

    const content = json.choices?.[0]?.message?.content || "";
    const { structured, rawText } = parseStructuredJSON(content);

    res.status(200).json({
      success: true,
      text: rawText,
      structured,
    });
  } catch (err) {
    console.error("generate-soul-abilities handler error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Unknown server error",
    });
  }
};

// ---------- Prompt builder ----------

function buildPrompts(body) {
  const { mode } = body;
  const souls = body.souls || [];
  const homies = body.homies || [];
  const domains = body.domains || [];

  const soulSummary = souls
    .map(
      (s) =>
        `${s.name} — SoL ${s.soulLevel}, SPU ${s.spu}, traits: ${
          s.traits || "none"
        }`
    )
    .join("\n");

  const homieSummary = homies
    .map(
      (h) =>
        `${h.name} [${h.type}] — role ${h.role || "?"}, HP ${
          h.hp || "?"
        }, AC ${h.ac || "?"}, move ${
          h.move || "?"
        }, SPU ${h.totalSPUInvested || 0}, traits: ${
          h.traits || "none"
        }`
    )
    .join("\n");

  const domainSummary = domains
    .map(
      (d) =>
        `${d.name} — Tier ${d.tier}, SPU ${
          d.spuInvested
        }, Fear DC ${d.fearDC}, size ${
          d.size || "?"
        }, personality: ${d.personality || "none"}`
    )
    .join("\n");

  const baseSystemPrompt = `
You are a rules-savvy D&D 5e / One Piece hybrid designer.
You design powerful but usable homebrew abilities, Homie attacks, and domain lair actions
for a character who wields Big Mom's Soul-Soul Fruit.

VERY IMPORTANT:
- Always respond with a SINGLE JSON object, no markdown, no code fences.
- The outer JSON must match the format requested in the user prompt for the given mode.
- Do not include trailing commas.
- Values should be short but evocative, suitable for use on a reference card.
`;

  if (mode === "homieAttack") {
    const { homie, concept, effectTypes, powerLevel } = body;

    const userPrompt = `
MODE: homieAttack

The user wants a signature multi-step attack for a specific Homie.

Homie:
${JSON.stringify(homie, null, 2)}

Overall Homie roster:
${homieSummary || "None"}

Domains:
${domainSummary || "None"}

Concept from user:
${concept || "None given."}

Effect types requested:
${(effectTypes || []).join(", ") || "None specified"}

Desired power level (1-10):
${powerLevel}

Return a JSON object with:
{
  "abilityName": string,
  "actionType": string,
  "range": string,
  "target": string,
  "saveDC": string,
  "damageDice": string,
  "mechanicalEffect": string,
  "comboNotes": string
}
`;

    return { systemPrompt: baseSystemPrompt, userPrompt };
  }

  if (mode === "domainLair") {
    const { domain } = body;

    const userPrompt = `
MODE: domainLair

The user wants 3-5 lair actions for this Domain in the style of D&D 5e lair actions
mixed with One Piece soul logic.

Domain:
${JSON.stringify(domain, null, 2)}

All Domains:
${domainSummary || "None"}

Homies:
${homieSummary || "None"}

Return a JSON object with:
{
  "lairActions": string  // A short block of text describing 3-5 numbered lair actions.
}
`;

    return { systemPrompt: baseSystemPrompt, userPrompt };
  }

  // genericAbility
  const {
    assignTo,
    powerLevel,
    soulCost,
    effectTypes,
    outcomeTypes,
    effectNotes,
    outcomeNotes,
    extraNotes,
  } = body;

  const userPrompt = `
MODE: genericAbility

The user wants a powerful, cinematic ability that fits their Soul-Soul Fruit toolkit.

Assign this ability to:
${assignTo || "General / Party"}

Soul bank:
${soulSummary || "None"}

Homies:
${homieSummary || "None"}

Domains:
${domainSummary || "None"}

Requested effect types:
${(effectTypes || []).join(", ") || "None specified"}

Requested outcome / shape:
${(outcomeTypes || []).join(", ") || "None specified"}

Effect notes:
${effectNotes || "None"}

Outcome notes:
${outcomeNotes || "None"}

Extra notes / combo intent:
${extraNotes || "None"}

Power level (1-10):
${powerLevel}

Optional soul cost (SPU):
${soulCost}

Return a JSON object with:
{
  "abilityName": string,
  "actionType": string,
  "range": string,
  "target": string,
  "saveDC": string,
  "damageDice": string,
  "mechanicalEffect": string,
  "comboNotes": string
}
`;

  return { systemPrompt: baseSystemPrompt, userPrompt };
}

// ---------- Parse structured JSON from model ----------

function parseStructuredJSON(content) {
  const rawText = typeof content === "string" ? content : "";
  let structured = null;

  try {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSlice = rawText.slice(firstBrace, lastBrace + 1);
      structured = JSON.parse(jsonSlice);
    } else {
      structured = JSON.parse(rawText);
    }
  } catch (err) {
    console.error(
      "Failed to parse structured JSON from model:",
      err,
      rawText
    );
    structured = null;
  }

  return { structured, rawText };
}
