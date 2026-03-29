const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RESUME = `Evan Sanford — Finance and Proposal Structure Associate at Redaptive (energy efficiency project finance, mid-2024–present). Background: transaction advisory at Alvarez & Marsal, MBA in Sustainable Innovation from UVM. CFA Level II passed, pursuing Level III. Skills: tax equity structuring (ITC/PTC, T-flip, partnership flip, IRA transferability), commercial solar and energy efficiency project finance, deal structuring, financial modeling, credit analysis, proposal structuring. Previous: Long-Term Stock Exchange. Targeting: senior structured finance roles in renewable energy, Denver CO or Chicago IL.`;

async function analyzeJD(jdText) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: 'Return only valid JSON, no markdown, no backticks. Be specific and honest about gaps.',
    messages: [{
      role: 'user',
      content: `Analyze this job description against the candidate profile. Return ONLY JSON:

{
  "title": "...",
  "company": "...",
  "location": "...",
  "salary": "...",
  "score": 82,
  "fit_summary": "2-3 sentence overall fit assessment",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "gaps": ["gap or missing requirement 1", "gap 2"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}

Candidate: ${RESUME}

Job description:
${jdText.slice(0, 3000)}`
    }]
  });

  const raw = message.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function draftCoverLetter(job, analysis) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: 'You are a professional cover letter writer. Write in a direct, confident, human-sounding tone. No AI-sounding filler phrases.',
    messages: [{
      role: 'user',
      content: `Write a cover letter for this candidate applying to this role.

Candidate: ${RESUME}
Role: ${job.title} at ${job.company} (${job.location || 'location TBD'})
Key strengths to highlight: ${(analysis.strengths || []).join(', ')}
Gaps to acknowledge or work around: ${(analysis.gaps || []).join(', ')}
Keywords to incorporate: ${(analysis.keywords || []).join(', ')}

Requirements:
- 3 short paragraphs, no headers
- Confident, direct, human-sounding
- No em dashes
- No phrases like "I am excited to", "leverage my expertise", "passionate about"
- Open with a strong specific hook referencing this role or company
- Middle: connect 2-3 specific experiences to role requirements, use the keywords naturally
- Close: brief, confident, action-oriented
- Just body paragraphs, no date/address/salutation`
    }]
  });

  return message.content[0].text;
}

async function searchJobs(query, location, level) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: 'Return only valid JSON arrays, no markdown, no backticks.',
    messages: [{
      role: 'user',
      content: `Generate 5 realistic job listings for: "${query}"${location ? ' in ' + location : ''}${level ? ' (' + level + ' level)' : ''}.

Candidate: ${RESUME}

Return ONLY a JSON array:
[{"title":"...","company":"...","location":"...","salary":"$X–$Y","url":"https://www.linkedin.com/jobs/","score":85,"fit_reason":"2-3 sentences on fit","tags":["tag1","tag2","tag3"]}]

Score 0–100 based on fit. Make companies realistic for clean energy finance. Vary scores authentically.`
    }]
  });

  const raw = message.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

module.exports = { analyzeJD, draftCoverLetter, searchJobs };
