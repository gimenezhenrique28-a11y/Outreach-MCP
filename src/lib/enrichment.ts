import Anthropic from '@anthropic-ai/sdk';
import { GitHubFullProfile } from './github.js';

const client = new Anthropic();

export interface EnrichmentResult {
  login: string;
  name?: string;
  email?: string;
  github_url: string;
  estimated_role: string;
  seniority: 'executive' | 'senior' | 'mid' | 'junior' | 'unknown';
  tech_stack: string[];
  work_type: 'product' | 'infra' | 'ml_ai' | 'devtools' | 'fullstack' | 'frontend' | 'backend' | 'open_source' | 'unknown';
  company_type: 'startup' | 'scaleup' | 'enterprise' | 'agency' | 'freelance' | 'open_source_maintainer' | 'unknown';
  company_size: '1-10' | '10-20' | '20-100' | '100-500' | '500+' | 'unknown';
  funding_stage: 'seed' | 'series_a' | 'series_b_plus' | 'bootstrapped' | 'enterprise' | 'unknown';
  passes_icp: boolean; // 20-100 employees OR seed/series_a
  icp_reason: string;  // why they pass or fail
  candidate_score: number;
  beta_user_score: number;
  relevance_reason: string;
  talking_points: string[];
  suggested_subject: string;
  suggested_opener: string;
}

export async function enrichProfile(
  profile: GitHubFullProfile,
  outreachGoal: 'candidate' | 'beta_user' | 'both' = 'both'
): Promise<EnrichmentResult> {
  const profileSummary = [
    `GitHub: ${profile.github_url}`,
    `Name: ${profile.name ?? profile.login}`,
    `Bio: ${profile.bio ?? 'none'}`,
    `Company: ${profile.company ?? 'none'}`,
    `Location: ${profile.location ?? 'none'}`,
    `Followers: ${profile.followers} | Public repos: ${profile.public_repos}`,
    profile.blog ? `Website: ${profile.blog}` : '',
    profile.twitter ? `Twitter: @${profile.twitter}` : '',
    profile.organizations.length > 0 ? `Organizations: ${profile.organizations.join(', ')}` : '',
    profile.profile_readme ? `Profile README: "${profile.profile_readme}"` : '',
    profile.top_repos.length > 0
      ? `Top repos:\n${profile.top_repos.map(r =>
          `  - ${r.name} (★${r.stars}${r.language ? `, ${r.language}` : ''}): ${r.description ?? 'no description'}${r.topics.length ? ` [${r.topics.slice(0, 5).join(', ')}]` : ''}`
        ).join('\n')}`
      : '',
  ].filter(Boolean).join('\n');

  const contextBlock = outreachGoal === 'candidate'
    ? `CONTEXT: Evaluating as a potential hire for an early-stage startup (Wharf — a TRM).
Ideal candidate: strong engineer or technical founder, builds real products, works at a startup.`
    : outreachGoal === 'beta_user'
    ? `CONTEXT: Evaluating as a potential Wharf beta user.
Wharf captures inbound candidate interest (LinkedIn DMs, emails) into a structured pipeline with AI matching.
Ideal beta user: founder, head of talent, or early recruiter at a seed-to-Series A company with 20–100 employees.`
    : `CONTEXT: Evaluate on two dimensions:
1. As a potential HIRE for an early-stage startup
2. As a potential WHARF BETA USER — ideal = founder/recruiter/talent lead at a 20–100 person seed or Series A company.`;

  const prompt = `You are a talent intelligence analyst. Analyze this GitHub profile and return a JSON object.

${contextBlock}

ICP (Ideal Customer Profile) for Wharf beta users:
- Company size: 20–100 employees (big enough to have a real hiring problem, small enough to not have a full ATS team)
- OR: actively hiring seed or Series A startup (even if under 20 people, if they're actively growing)
- NOT a fit: solo freelancers, enterprises 500+, companies not hiring

Profile data:
${profileSummary}

Return ONLY valid JSON with exactly these fields:
{
  "estimated_role": "specific job title (e.g. 'Founder & CTO at payments startup', 'Head of Talent', 'Senior Engineer')",
  "seniority": "executive | senior | mid | junior | unknown",
  "tech_stack": ["up to 5 main technologies they use"],
  "work_type": "product | infra | ml_ai | devtools | fullstack | frontend | backend | open_source | unknown",
  "company_type": "startup | scaleup | enterprise | agency | freelance | open_source_maintainer | unknown",
  "company_size": "1-10 | 10-20 | 20-100 | 100-500 | 500+ | unknown",
  "funding_stage": "seed | series_a | series_b_plus | bootstrapped | enterprise | unknown",
  "passes_icp": true or false — true if company is 20–100 employees OR is a seed/series_a startup actively hiring,
  "icp_reason": "1 sentence explaining why they pass or fail the ICP filter",
  "candidate_score": number 1-10 (fit as a startup hire),
  "beta_user_score": number 1-10 (fit as Wharf beta user — penalise heavily if company is too small <20 or too large >100, unless seed/series_a hiring),
  "relevance_reason": "2 sentences: who this person is and why they score the way they do",
  "talking_points": ["2-3 SPECIFIC hooks from their actual work to reference in outreach"],
  "suggested_subject": "outreach subject line, under 8 words, reference something specific",
  "suggested_opener": "first sentence of outreach email, 1 sentence, sounds like you read their profile"
}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Enrichment returned no JSON');

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    login: profile.login,
    name: profile.name,
    email: profile.email,
    github_url: profile.github_url,
    estimated_role: parsed.estimated_role ?? 'Unknown',
    seniority: parsed.seniority ?? 'unknown',
    tech_stack: parsed.tech_stack ?? [],
    work_type: parsed.work_type ?? 'unknown',
    company_type: parsed.company_type ?? 'unknown',
    company_size: parsed.company_size ?? 'unknown',
    funding_stage: parsed.funding_stage ?? 'unknown',
    passes_icp: Boolean(parsed.passes_icp),
    icp_reason: parsed.icp_reason ?? '',
    candidate_score: Number(parsed.candidate_score ?? 5),
    beta_user_score: Number(parsed.beta_user_score ?? 5),
    relevance_reason: parsed.relevance_reason ?? '',
    talking_points: parsed.talking_points ?? [],
    suggested_subject: parsed.suggested_subject ?? '',
    suggested_opener: parsed.suggested_opener ?? '',
  };
}
