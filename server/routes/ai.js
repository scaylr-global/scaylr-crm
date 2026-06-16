import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey: key });
}

// POST /api/ai/lead-insights
// Body: { lead_id }
// Returns: { score, summary, nextAction, bestTimeToCall }
router.post('/lead-insights', async (req, res, next) => {
  try {
    const { lead_id } = req.body || {};
    if (!lead_id) return res.status(400).json({ error: 'lead_id is required' });

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const calls = db
      .prepare(
        `SELECT cl.outcome, cl.duration_seconds, cl.notes, cl.created_at, u.name AS logger
         FROM call_logs cl LEFT JOIN users u ON u.id = cl.logged_by
         WHERE cl.lead_id = ? ORDER BY cl.created_at DESC`
      )
      .all(lead_id);

    const followUps = db
      .prepare(
        `SELECT scheduled_at, note, status FROM follow_ups
         WHERE lead_id = ? AND status != 'deleted' ORDER BY scheduled_at DESC`
      )
      .all(lead_id);

    const callSummary =
      calls.length === 0
        ? 'No calls logged yet.'
        : calls
            .map(
              (c) =>
                `- ${c.created_at.slice(0, 10)}: ${c.outcome} (${Math.round(c.duration_seconds / 60)}m) — ${c.notes || 'no notes'}`
            )
            .join('\n');

    const fuSummary =
      followUps.length === 0
        ? 'No follow-ups scheduled.'
        : followUps
            .map((f) => `- ${f.scheduled_at.slice(0, 16)}: [${f.status}] ${f.note || 'no note'}`)
            .join('\n');

    const prompt = `You are a CRM assistant. Analyse this sales lead and give a concise assessment.

Lead: ${lead.name} — ${lead.role_title || 'Unknown role'} at ${lead.company || 'Unknown company'}
Industry: ${lead.industry || 'N/A'} | Status: ${lead.status}
Notes: ${lead.notes || 'None'}

Call history (newest first):
${callSummary}

Follow-ups:
${fuSummary}

Respond ONLY with a valid JSON object (no markdown, no commentary) with these exact keys:
{
  "score": "Hot" | "Warm" | "Cold",
  "summary": "2-3 sentence summary of engagement so far",
  "nextAction": "specific recommended next step",
  "bestTimeToCall": "suggested best time/day pattern based on call history, or a general recommendation if no data"
}`;

    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0]?.text || '{}';
    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return res.status(502).json({ error: 'AI returned unparseable response', raw });
    }

    res.json(parsed);
  } catch (e) {
    next(e);
  }
});

// POST /api/ai/improve-note
// Body: { note }
// Returns: { improved }
router.post('/improve-note', async (req, res, next) => {
  try {
    const { note } = req.body || {};
    if (!note || !note.trim()) return res.status(400).json({ error: 'note is required' });

    const prompt = `You are a professional CRM assistant. Rewrite the following rough call note into a concise, professional sales note (2-4 sentences). Preserve all factual details. Return ONLY the improved note text — no preamble, no quotes, no explanation.

Rough note: ${note.trim()}`;

    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const improved = message.content[0]?.text?.trim() || note;
    res.json({ improved });
  } catch (e) {
    next(e);
  }
});

export default router;
