const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEFAULT_RESUME = 'No resume uploaded yet. Please upload your resume for personalized results.';

async function analyzeJD(jdText, resumeText) {
  const resume = resumeText || DEFAULT_RESUME;
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

Candidate: ${resume}

Job description:
${jdText.slice(0, 3000)}`
    }]
  });

  const raw = message.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

async function draftCoverLetter(job, analysis, resumeText) {
  const resume = resumeText || DEFAULT_RESUME;
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: 'You are a professional cover letter writer. Write in a direct, confident, human tone. No AI-sounding filler phrases.',
    messages: [{
      role: 'user',
      content: `Write a cover letter for this candidate applying to this role.

Candidate: ${resume}
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

// Score a list of real job listings against the candidate's resume in a single Claude call
async function scoreJobsAgainstResume(jobs, resumeText) {
  const resume = resumeText || DEFAULT_RESUME;
  const cap = Math.min(jobs.length, 20);
  const jobList = jobs.slice(0, cap).map((j, i) =>
    `${i + 1}. ${j.title} at ${j.company} (${j.location})\n${(j.description || '').slice(0, 400)}`
  ).join('\n\n---\n\n');

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: 'Return only valid JSON arrays, no markdown, no backticks.',
    messages: [{
      role: 'user',
      content: `Score each job listing's fit for this candidate (0-100) and give a 1-2 sentence fit reason. Return ONLY a JSON array with exactly ${cap} objects:
[{"score": 85, "fit_reason": "short reason"}, ...]

Candidate:
${resume.slice(0, 2000)}

Jobs:
${jobList}`
    }]
  });

  const raw = message.content[0].text.replace(/```json|```/g, '').trim();
  const scores = JSON.parse(raw);
  return jobs.map((j, i) => ({
    ...j,
    score: scores[i]?.score ?? null,
    fit_reason: scores[i]?.fit_reason || '',
  }));
}

// Derive job search queries from a resume — used by smart-search
async function extractSearchQueries(resumeText) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: 'Return only valid JSON, no markdown, no backticks.',
    messages: [{
      role: 'user',
      content: `Based on this resume, generate 4 specific job search queries that would surface the best-fit open roles for this candidate. Vary the seniority and framing slightly across queries. Return ONLY a JSON array of strings:

["query 1", "query 2", "query 3", "query 4"]

Resume:
${resumeText.slice(0, 2000)}`
    }]
  });

  const raw = message.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(raw);
}

module.exports = { analyzeJD, draftCoverLetter, scoreJobsAgainstResume, extractSearchQueries };
