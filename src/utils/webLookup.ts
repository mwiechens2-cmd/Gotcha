export interface WebSource {
  title: string;
  uri: string;
}

export interface WebLookupResponse {
  summary: string;
  sources: WebSource[];
  searchQueries: string[];
}

async function postWebLookup<TBody extends Record<string, unknown>>(
  endpoint: string,
  body: TBody
): Promise<WebLookupResponse> {
  const res = await fetch(endpoint, {
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
