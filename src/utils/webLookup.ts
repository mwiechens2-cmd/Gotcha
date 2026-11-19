export interface WebSource {
  title: string;
  uri: string;
}

export interface WebLookupResponse {
  summary: string;
  sources: WebSource[];
  searchQueries: string[];
  searchMode?: 'gemini_grounding' | 'public_web_fallback';
  notice?: string;
}

export interface AccessStatusResponse {
  customSecretConfigured: boolean;
  demoPasscode: string | null;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out while querying live web sources. Please retry.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function postWebLookup<TBody extends Record<string, unknown>>(
  endpoint: string,
  body: TBody
): Promise<WebLookupResponse> {
  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<WebLookupResponse> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `Web lookup failed with status ${res.status}`);
  }

  return {
    summary: data.summary || '',
    sources: Array.isArray(data.sources) ? data.sources : [],
    searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
    searchMode: data.searchMode,
    notice: data.notice,
  };
}

export function fetchPhoneWebOsint(params: {
  phoneNumber: string;
  formattedNational?: string;
  carrierName?: string;
  locationHint?: string;
}): Promise<WebLookupResponse> {
  return postWebLookup('/api/web-lookup/phone', params);
}

export function fetchAlprWebIntel(params: {
  state: string;
  cityOrCounty?: string;
}): Promise<WebLookupResponse> {
  return postWebLookup('/api/web-lookup/alpr', params);
}

export function fetchFoiaPortalWeb(params: {
  agencyOrCity: string;
  state: string;
}): Promise<WebLookupResponse> {
  return postWebLookup('/api/web-lookup/foia-portal', params);
}

export async function fetchAccessStatus(): Promise<AccessStatusResponse> {
  const res = await fetchWithTimeout('/api/access/status', { method: 'GET' }, 8000);
  if (!res.ok) {
    throw new Error('Unable to verify OSINT access configuration.');
  }
  return (await res.json()) as AccessStatusResponse;
}

export async function verifyAccessPasscode(passcode: string): Promise<{ unlocked: boolean; mode: string }> {
  const res = await fetchWithTimeout(
    '/api/access/verify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    },
    8000
  );

  const data = (await res.json().catch(() => ({}))) as {
    unlocked?: boolean;
    mode?: string;
    error?: string;
  };

  if (!res.ok || !data.unlocked) {
    throw new Error(data.error || 'Invalid access passcode.');
  }

  return { unlocked: true, mode: data.mode || 'secret' };
}
