import axios, { AxiosError } from 'axios';
import 'dotenv/config';

const BASE = 'https://api.search.brave.com/res/v1/web/search';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export async function braveSearch(query: string, count = 8): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error('BRAVE_API_KEY is not set');

  try {
    const res = await axios.get(BASE, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
      params: { q: query, count: Math.min(count, 20), search_lang: 'en' },
    });

    return (res.data?.web?.results ?? []).map((r: Record<string, unknown>) => ({
      title: r.title as string,
      url: r.url as string,
      description: r.description as string ?? '',
    }));
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response) {
      throw new Error(`Brave Search error ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`);
    }
    throw err;
  }
}
