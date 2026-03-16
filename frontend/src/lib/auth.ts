import { supabase } from './supabaseClient';

/**
 * Returns headers with current session token for API calls.
 * Use this instead of repeating getSession() + Authorization in every component.
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    (headers as Record<string, string>)['Authorization'] =
      `Bearer ${session.access_token}`;
  }
  return headers;
}

/**
 * Fetch with auth headers applied. Merges with any init.headers you pass.
 */
export async function fetchWithAuth(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const mergedHeaders: HeadersInit = {
    ...(authHeaders as Record<string, string>),
    ...(init?.headers as Record<string, string>),
  };
  return fetch(url, { ...init, headers: mergedHeaders });
}
