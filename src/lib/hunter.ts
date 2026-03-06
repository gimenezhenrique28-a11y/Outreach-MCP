import axios, { AxiosError } from 'axios';
import 'dotenv/config';

const BASE = 'https://api.hunter.io/v2';

export interface HunterSearchParams {
  // Domain search — find everyone at a company
  domain?: string;
  company?: string;
  // Person finder — find a specific person's email
  first_name?: string;
  last_name?: string;
  // Filters
  role?: string;        // e.g. "ceo", "cto", "founder"
  seniority?: string;   // e.g. "executive", "senior", "junior"
  limit?: number;
}

export interface HunterContact {
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  linkedin_url?: string;
  company?: string;
  domain?: string;
  confidence?: number;
}

function apiKey() {
  const key = process.env.HUNTER_API_KEY;
  if (!key) throw new Error('HUNTER_API_KEY is not set');
  return key;
}

// Find all emails at a domain/company
export async function domainSearch(params: HunterSearchParams): Promise<HunterContact[]> {
  try {
    const response = await axios.get(`${BASE}/domain-search`, {
      params: {
        api_key: apiKey(),
        domain: params.domain,
        company: params.company,
        type: 'personal',
        limit: Math.min(params.limit ?? 10, 100),
        ...(params.role && { department: params.role }),
        ...(params.seniority && { seniority: params.seniority }),
      },
    });

    const emails: HunterContact[] = (response.data?.data?.emails ?? []).map(
      (e: Record<string, unknown>) => ({
        email: e.value as string,
        first_name: e.first_name as string | undefined,
        last_name: e.last_name as string | undefined,
        full_name: [e.first_name, e.last_name].filter(Boolean).join(' ') || undefined,
        position: e.position as string | undefined,
        linkedin_url: e.linkedin as string | undefined,
        company: (response.data?.data?.organization as string | undefined) ?? params.company,
        domain: params.domain,
        confidence: e.confidence as number | undefined,
      })
    );

    return emails;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const data = JSON.stringify(axiosErr.response.data);
      throw new Error(`Hunter API error ${status}: ${data}`);
    }
    throw err;
  }
}

// Find one person's email by name + domain
export async function emailFinder(
  firstName: string,
  lastName: string,
  domain: string
): Promise<HunterContact | null> {
  try {
    const response = await axios.get(`${BASE}/email-finder`, {
      params: {
        api_key: apiKey(),
        domain,
        first_name: firstName,
        last_name: lastName,
      },
    });

    const d = response.data?.data;
    if (!d?.email) return null;

    return {
      email: d.email,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      position: d.position,
      linkedin_url: d.linkedin_url,
      domain,
      confidence: d.score,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 404) return null;
    if (axiosErr.response) {
      throw new Error(`Hunter API error ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`);
    }
    throw err;
  }
}
