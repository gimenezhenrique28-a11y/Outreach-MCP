import axios, { AxiosError } from 'axios';
import 'dotenv/config';

const BASE = 'https://api.github.com';

function headers() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface GitHubSearchParams {
  query?: string;
  location?: string;
  language?: string;
  followers?: number;
  limit?: number;
}

export interface GitHubRepo {
  name: string;
  description?: string;
  stars: number;
  language?: string;
  topics: string[];
  url: string;
}

export interface GitHubContact {
  login: string;
  name?: string;
  email?: string;
  company?: string;
  location?: string;
  bio?: string;
  blog?: string;
  twitter?: string;
  github_url: string;
  followers: number;
  public_repos: number;
}

export interface GitHubFullProfile extends GitHubContact {
  top_repos: GitHubRepo[];
  organizations: string[];
  profile_readme?: string;
}

function gh<T>(path: string) {
  return axios.get<T>(`${BASE}${path}`, { headers: headers() }).then(r => r.data);
}

async function safeGet<T>(path: string): Promise<T | null> {
  try { return await gh<T>(path); } catch { return null; }
}

export async function searchGitHubUsers(params: GitHubSearchParams): Promise<GitHubContact[]> {
  const parts: string[] = [];
  if (params.query) parts.push(params.query);
  if (params.location) parts.push(`location:"${params.location}"`);
  if (params.language) parts.push(`language:${params.language}`);
  if (params.followers) parts.push(`followers:>=${params.followers}`);
  if (parts.length === 0) parts.push('type:user');

  const limit = Math.min(params.limit ?? 10, 30);

  try {
    const searchRes = await gh<{ items: { login: string }[] }>(`/search/users?q=${encodeURIComponent(parts.join(' '))}&per_page=${limit}&sort=followers&order=desc`);
    const logins = searchRes.items.map(u => u.login);

    const profiles = await Promise.all(logins.map(async (login) => {
      const u = await safeGet<Record<string, unknown>>(`/users/${login}`);
      if (!u) return { login, github_url: `https://github.com/${login}`, followers: 0, public_repos: 0 };
      return {
        login,
        name: u.name as string | undefined,
        email: u.email as string | undefined,
        company: u.company ? (u.company as string).replace(/^@/, '') : undefined,
        location: u.location as string | undefined,
        bio: u.bio as string | undefined,
        blog: u.blog as string | undefined,
        twitter: u.twitter_username as string | undefined,
        github_url: u.html_url as string,
        followers: u.followers as number ?? 0,
        public_repos: u.public_repos as number ?? 0,
      } as GitHubContact;
    }));

    return profiles;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response) {
      throw new Error(`GitHub API error ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`);
    }
    throw err;
  }
}

export async function getFullProfile(login: string): Promise<GitHubFullProfile> {
  const [user, repos, orgs, readme] = await Promise.all([
    gh<Record<string, unknown>>(`/users/${login}`),
    safeGet<{ name: string; description: string; stargazers_count: number; language: string; topics: string[]; html_url: string }[]>(`/users/${login}/repos?sort=stars&per_page=6&type=owner`),
    safeGet<{ login: string }[]>(`/users/${login}/orgs`),
    safeGet<{ content: string }>(`/repos/${login}/${login}/readme`),
  ]);

  const u = user;
  const top_repos: GitHubRepo[] = (repos ?? []).map(r => ({
    name: r.name,
    description: r.description ?? undefined,
    stars: r.stargazers_count,
    language: r.language ?? undefined,
    topics: r.topics ?? [],
    url: r.html_url,
  }));

  const organizations = (orgs ?? []).map(o => o.login);

  let profile_readme: string | undefined;
  if (readme?.content) {
    try {
      const decoded = Buffer.from(readme.content, 'base64').toString('utf-8');
      // Keep first 600 chars — enough for Claude to understand the person
      profile_readme = decoded.slice(0, 600).replace(/\n+/g, ' ').trim();
    } catch { /* ignore */ }
  }

  return {
    login,
    name: u.name as string | undefined,
    email: u.email as string | undefined,
    company: u.company ? (u.company as string).replace(/^@/, '') : undefined,
    location: u.location as string | undefined,
    bio: u.bio as string | undefined,
    blog: u.blog as string | undefined,
    twitter: u.twitter_username as string | undefined,
    github_url: u.html_url as string,
    followers: u.followers as number ?? 0,
    public_repos: u.public_repos as number ?? 0,
    top_repos,
    organizations,
    profile_readme,
  };
}
