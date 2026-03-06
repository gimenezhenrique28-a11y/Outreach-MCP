import axios, { AxiosError } from 'axios';
import 'dotenv/config';

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

export interface ApolloSearchParams {
  query?: string;
  location?: string;
  funding_stage?: string;
  hiring?: boolean;
  limit?: number;
}

export interface ApolloContact {
  id: string;
  name: string;
  email?: string;
  title?: string;
  organization_name?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
}

export async function searchApolloContacts(params: ApolloSearchParams): Promise<ApolloContact[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error('APOLLO_API_KEY is not set');

  const payload: Record<string, unknown> = {
    per_page: Math.min(params.limit ?? 10, 100),
    page: 1,
  };

  if (params.query) {
    payload.q_keywords = params.query;
  }

  if (params.location) {
    payload.person_locations = [params.location];
  }

  // Accepted values: seed, series_a, series_b, series_c, series_d, series_e,
  // venture, private_equity, debt_financing, undisclosed
  if (params.funding_stage) {
    payload.organization_latest_funding_stage_cd = [params.funding_stage];
  }

  if (params.hiring === true) {
    payload.currently_using_any_of_job_posting_categories = ['engineering'];
  }

  try {
    const response = await axios.post(
      `${APOLLO_BASE_URL}/mixed_people/search`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': apiKey,
        },
      }
    );

    return (response.data?.people ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: p.name as string,
      email: p.email as string | undefined,
      title: p.title as string | undefined,
      organization_name: (p.organization as Record<string, unknown> | undefined)?.name as string | undefined,
      linkedin_url: p.linkedin_url as string | undefined,
      city: p.city as string | undefined,
      state: p.state as string | undefined,
      country: p.country as string | undefined,
    }));
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response) {
      const status = axiosErr.response.status;
      const data = JSON.stringify(axiosErr.response.data);
      throw new Error(`Apollo API error ${status}: ${data}`);
    }
    throw err;
  }
}
