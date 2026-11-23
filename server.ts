import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';
const DEFAULT_DEMO_PASSCODE = 'VIGIL-2026';

interface WebSource {
  title: string;
  uri: string;
  snippet?: string;
}

interface WebLookupPayload {
  summary: string;
  sources: WebSource[];
  searchQueries: string[];
  searchMode: 'gemini_grounding' | 'public_web_fallback';
  notice?: string;
}

function getConfiguredAccessSecret(): { secret: string; customSecretConfigured: boolean } {
  const raw = (process.env.OSINT_ACCESS_SECRET || '').trim();
  if (raw && raw !== 'MY_OSINT_ACCESS_SECRET' && raw !== 'change-me-access-passcode') {
    return { secret: raw, customSecretConfigured: true };
  }
  return { secret: DEFAULT_DEMO_PASSCODE, customSecretConfigured: false };
}

function verifyPasscodeTimingSafe(candidate: string, expected: string): boolean {
  const hashA = crypto.createHash('sha256').update(candidate).digest();
  const hashB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function isGeminiConfigured(): boolean {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

function getMapsApiKey(): string {
  const viteKey = (process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const serverKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  const candidate = viteKey || serverKey;
  if (!candidate || candidate === 'MY_GOOGLE_MAPS_API_KEY') {
    return '';
  }
  return candidate;
}

interface GeocodeLookupResult {
  coordinates?: [number, number];
  formattedAddress?: string;
  accuracy?: 'rooftop_address' | 'approximate_address';
  quotaExceeded?: boolean;
}

const GEOCODE_MEMORY_CACHE = new Map<
  string,
  { expiresAt: number; value: GeocodeLookupResult }
>();
const GEOCODE_CACHE_TTL_MS = 15 * 60 * 1000;

async function geocodeAddressServer(addressQuery: string): Promise<GeocodeLookupResult> {
  const trimmed = addressQuery.trim();
  if (!trimmed) return {};

  const mapsKey = getMapsApiKey();
  if (!mapsKey) return {};

  const cacheKey = trimmed.toLowerCase();
  const cached = GEOCODE_MEMORY_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const remember = (value: GeocodeLookupResult): GeocodeLookupResult => {
    if (!value.quotaExceeded) {
      if (GEOCODE_MEMORY_CACHE.size >= 100) {
        const oldestKey = GEOCODE_MEMORY_CACHE.keys().next().value;
        if (oldestKey) GEOCODE_MEMORY_CACHE.delete(oldestKey);
      }
      GEOCODE_MEMORY_CACHE.set(cacheKey, {
        expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS,
        value,
      });
    }
    return value;
  };

  try {
    // Standard Google Maps Geocoding REST API (server-side to satisfy CORS & key security)
    const legacyUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      trimmed
    )}&key=${encodeURIComponent(mapsKey)}`;
    const res = await fetch(legacyUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5500),
    });

    if (res.status === 429) {
      return { quotaExceeded: true };
    }

    const payload = (await res.json().catch(() => null)) as {
      status?: string;
      error_message?: string;
      error?: { status?: string };
      results?: Array<{
        formatted_address?: string;
        geometry?: {
          location?: { lat?: number; lng?: number };
          location_type?: string;
        };
      }>;
    } | null;

    if (
      payload?.status === 'OVER_QUERY_LIMIT' ||
      payload?.error?.status === 'RESOURCE_EXHAUSTED'
    ) {
      return { quotaExceeded: true };
    }

    if (res.ok && payload?.status === 'OK' && payload.results?.[0]?.geometry?.location) {
      const top = payload.results[0];
      const lat = top.geometry?.location?.lat;
      const lng = top.geometry?.location?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        const locType = (top.geometry?.location_type || '').toUpperCase();
        return remember({
          coordinates: [Number(lat.toFixed(6)), Number(lng.toFixed(6))],
          formattedAddress: top.formatted_address,
          accuracy:
            locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED'
              ? 'rooftop_address'
              : 'approximate_address',
        });
      }
    }

    if (payload?.status === 'ZERO_RESULTS') {
      return remember({});
    }

    // Fallback to Geocoding API v4 if standard REST reports REQUEST_DENIED
    if (res.status === 403 || payload?.status === 'REQUEST_DENIED') {
      const v4Url = `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(
        trimmed
      )}?regionCode=us&languageCode=en`;
      const v4Res = await fetch(v4Url, {
        headers: {
          Accept: 'application/json',
          'X-Goog-Api-Key': mapsKey,
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
          'X-Goog-FieldMask':
            'results.location,results.formattedAddress,results.granularity',
        },
        signal: AbortSignal.timeout(5500),
      });

      if (v4Res.status === 429) {
        return { quotaExceeded: true };
      }

      const v4Data = (await v4Res.json().catch(() => null)) as {
        error?: { status?: string };
        results?: Array<{
          formattedAddress?: string;
          granularity?: string;
          location?: { latitude?: number; longitude?: number };
        }>;
      } | null;

      if (v4Data?.error?.status === 'RESOURCE_EXHAUSTED') {
        return { quotaExceeded: true };
      }

      const topV4 = v4Data?.results?.[0];
      const lat = topV4?.location?.latitude;
      const lng = topV4?.location?.longitude;
      if (v4Res.ok && typeof lat === 'number' && typeof lng === 'number') {
        const gran = (topV4?.granularity || '').toUpperCase();
        return remember({
          coordinates: [Number(lat.toFixed(6)), Number(lng.toFixed(6))],
          formattedAddress: topV4?.formattedAddress,
          accuracy:
            gran === 'ROOFTOP' || gran === 'RANGE_INTERPOLATED'
              ? 'rooftop_address'
              : 'approximate_address',
        });
      }
    }
  } catch {
    // Non-fatal fallback: caller preserves rate-center coordinates
  }

  return {};
}

function getAiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured. Set it in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGrounding(response: unknown): { sources: WebSource[]; searchQueries: string[] } {
  const candidate = (response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
        webSearchQueries?: string[];
      };
    }>;
  })?.candidates?.[0];

  const rawChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: WebSource[] = [];

  for (const chunk of rawChunks) {
    const uri = chunk.web?.uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        title: chunk.web?.title || uri,
        uri,
      });
    }
  }

  const searchQueries = candidate?.groundingMetadata?.webSearchQueries ?? [];
  return { sources, searchQueries };
}

function formatApiError(err: unknown): { status: number; message: string; retryable: boolean } {
  const errStatus = (err as { status?: number })?.status;
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (errStatus === 400 || lower.includes('gemini_api_key') || lower.includes('api_key_invalid') || lower.includes('api key')) {
    return {
      status: 400,
      message: 'Gemini API key is missing or invalid in Settings > Secrets.',
      retryable: false,
    };
  }
  if (errStatus === 403 || lower.includes('permission_denied')) {
    return {
      status: 403,
      message: 'Gemini API access denied (403). Verify key permissions in Settings > Secrets.',
      retryable: false,
    };
  }
  if (errStatus === 429 || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Gemini Search quota or rate limit reached (429).',
      retryable: true,
    };
  }
  if (errStatus === 503 || errStatus === 502 || lower.includes('unavailable') || lower.includes('timeout')) {
    return {
      status: errStatus || 503,
      message: 'Upstream Gemini Search service temporarily unavailable.',
      retryable: true,
    };
  }
  if (errStatus === 404 || lower.includes('not_found')) {
    return {
      status: 404,
      message: `Requested model (${MODEL_NAME}) was not found.`,
      retryable: false,
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Failed to complete live web search request.',
    retryable: true,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let geminiCooldownUntil = 0;
let lastGeminiCooldownReason = '';

async function runGeminiGroundedSearch(prompt: string): Promise<{
  summary: string;
  sources: WebSource[];
  searchQueries: string[];
}> {
  const ai = getAiClient();
  let lastErr: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const { sources, searchQueries } = extractGrounding(response);
      const summary = (response.text || '').trim();
      if (summary) {
        geminiCooldownUntil = 0;
        lastGeminiCooldownReason = '';
        return { summary, sources, searchQueries };
      }
      throw new Error('Gemini returned an empty search response.');
    } catch (err) {
      lastErr = err;
      const parsed = formatApiError(err);
      if (parsed.status === 429) {
        geminiCooldownUntil = Date.now() + 60_000;
        lastGeminiCooldownReason = parsed.message;
        throw err;
      }
      if (!parsed.retryable || attempt === 1) {
        throw err;
      }
      await sleep(500);
    }
  }

  throw lastErr;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapDuckDuckGoHref(rawHref: string): string {
  const decoded = rawHref.replace(/&amp;/g, '&');
  if (decoded.startsWith('//')) {
    return `https:${decoded}`;
  }
  try {
    const parsed = new URL(decoded, 'https://duckduckgo.com');
    const target = parsed.searchParams.get('uddg');
    if (target) {
      return decodeURIComponent(target);
    }
    return parsed.toString();
  } catch {
    return decoded;
  }
}

async function queryDuckDuckGoHtml(searchQuery: string): Promise<WebSource[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo HTML returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const sources: WebSource[] = [];
  const seen = new Set<string>();

  const anchorRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const anchors: Array<{ uri: string; title: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null && anchors.length < 8) {
    const uri = unwrapDuckDuckGoHref(match[1]);
    const title = decodeHtmlEntities(match[2]);
    if (uri.startsWith('http') && title && !seen.has(uri)) {
      seen.add(uri);
      anchors.push({ uri, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < 8) {
    snippets.push(decodeHtmlEntities(match[1]));
  }

  for (let i = 0; i < anchors.length; i++) {
    sources.push({
      title: anchors[i].title,
      uri: anchors[i].uri,
      snippet: snippets[i] || undefined,
    });
  }

  return sources;
}

async function queryDuckDuckGoInstantAnswer(searchQuery: string): Promise<WebSource[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VigilALPR-OSINT/1.0' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];

  const data = (await res.json().catch(() => null)) as {
    Heading?: string;
    AbstractText?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
  } | null;

  if (!data) return [];
  const items: WebSource[] = [];
  if (data.AbstractURL && data.AbstractText) {
    items.push({
      title: data.Heading || data.AbstractURL,
      uri: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }
  for (const topic of data.RelatedTopics || []) {
    if (topic.FirstURL && topic.Text && items.length < 4) {
      items.push({
        title: topic.Text.split(' - ')[0] || topic.FirstURL,
        uri: topic.FirstURL,
        snippet: topic.Text,
      });
    }
  }
  return items;
}

const IRRELEVANT_FALLBACK_HOSTS = new Set([
  'www.microsoft.com',
  'microsoft.com',
  'account.microsoft.com',
  'support.microsoft.com',
  'm365.cloud.microsoft',
  'news.google.com',
  'www.cnn.com',
  'www.foxnews.com',
  'apnews.com',
  'www.flock.com',
  'flock.com',
  'web.flock.com',
  'liquipedia.net',
  'www.tripadvisor.com',
  'www.merriam-webster.com',
  'www.dictionary.com',
  'dictionary.cambridge.org',
  'www.transparency.org',
  'www.visitcalifornia.com',
  'ontheworldmap.com',
  'www.britannica.com',
]);

const US_STATE_NAMES: Record<string, { name: string; foiaLaw: string }> = {
  AL: { name: 'Alabama', foiaLaw: 'Alabama Open Records Act' },
  AK: { name: 'Alaska', foiaLaw: 'Alaska Public Records Act' },
  AZ: { name: 'Arizona', foiaLaw: 'Arizona Public Records Law' },
  AR: { name: 'Arkansas', foiaLaw: 'Arkansas Freedom of Information Act' },
  CA: { name: 'California', foiaLaw: 'California Public Records Act' },
  CO: { name: 'Colorado', foiaLaw: 'Colorado Open Records Act' },
  CT: { name: 'Connecticut', foiaLaw: 'Connecticut Freedom of Information Act' },
  DE: { name: 'Delaware', foiaLaw: 'Delaware Freedom of Information Act' },
  DC: { name: 'District of Columbia', foiaLaw: 'D.C. Freedom of Information Act' },
  FL: { name: 'Florida', foiaLaw: 'Florida Sunshine Law' },
  GA: { name: 'Georgia', foiaLaw: 'Georgia Open Records Act' },
  HI: { name: 'Hawaii', foiaLaw: 'Hawaii Uniform Information Practices Act' },
  ID: { name: 'Idaho', foiaLaw: 'Idaho Public Records Act' },
  IL: { name: 'Illinois', foiaLaw: 'Illinois Freedom of Information Act' },
  IN: { name: 'Indiana', foiaLaw: 'Indiana Access to Public Records Act' },
  IA: { name: 'Iowa', foiaLaw: 'Iowa Open Records Law' },
  KS: { name: 'Kansas', foiaLaw: 'Kansas Open Records Act' },
  KY: { name: 'Kentucky', foiaLaw: 'Kentucky Open Records Act' },
  LA: { name: 'Louisiana', foiaLaw: 'Louisiana Public Records Law' },
  ME: { name: 'Maine', foiaLaw: 'Maine Freedom of Access Act' },
  MD: { name: 'Maryland', foiaLaw: 'Maryland Public Information Act' },
  MA: { name: 'Massachusetts', foiaLaw: 'Massachusetts Public Records Law' },
  MI: { name: 'Michigan', foiaLaw: 'Michigan Freedom of Information Act' },
  MN: { name: 'Minnesota', foiaLaw: 'Minnesota Government Data Practices Act' },
  MS: { name: 'Mississippi', foiaLaw: 'Mississippi Public Records Act' },
  MO: { name: 'Missouri', foiaLaw: 'Missouri Sunshine Law' },
  MT: { name: 'Montana', foiaLaw: 'Montana Public Records Act' },
  NE: { name: 'Nebraska', foiaLaw: 'Nebraska Public Records Statutes' },
  NV: { name: 'Nevada', foiaLaw: 'Nevada Public Records Act' },
  NH: { name: 'New Hampshire', foiaLaw: 'New Hampshire Right-to-Know Law' },
  NJ: { name: 'New Jersey', foiaLaw: 'New Jersey Open Public Records Act' },
  NM: { name: 'New Mexico', foiaLaw: 'New Mexico Inspection of Public Records Act' },
  NY: { name: 'New York', foiaLaw: 'New York Freedom of Information Law' },
  NC: { name: 'North Carolina', foiaLaw: 'North Carolina Public Records Law' },
  ND: { name: 'North Dakota', foiaLaw: 'North Dakota Open Records Statute' },
  OH: { name: 'Ohio', foiaLaw: 'Ohio Public Records Act' },
  OK: { name: 'Oklahoma', foiaLaw: 'Oklahoma Open Records Act' },
  OR: { name: 'Oregon', foiaLaw: 'Oregon Public Records Law' },
  PA: { name: 'Pennsylvania', foiaLaw: 'Pennsylvania Right-to-Know Law' },
  RI: { name: 'Rhode Island', foiaLaw: 'Rhode Island Access to Public Records Act' },
  SC: { name: 'South Carolina', foiaLaw: 'South Carolina Freedom of Information Act' },
  SD: { name: 'South Dakota', foiaLaw: 'South Dakota Open Records Law' },
  TN: { name: 'Tennessee', foiaLaw: 'Tennessee Public Records Act' },
  TX: { name: 'Texas', foiaLaw: 'Texas Public Information Act' },
  UT: { name: 'Utah', foiaLaw: 'Utah Government Records Access and Management Act' },
  VT: { name: 'Vermont', foiaLaw: 'Vermont Public Records Act' },
  VA: { name: 'Virginia', foiaLaw: 'Virginia Freedom of Information Act' },
  WA: { name: 'Washington', foiaLaw: 'Washington Public Records Act' },
  WV: { name: 'West Virginia', foiaLaw: 'West Virginia Freedom of Information Act' },
  WI: { name: 'Wisconsin', foiaLaw: 'Wisconsin Open Records Law' },
  WY: { name: 'Wyoming', foiaLaw: 'Wyoming Public Records Act' },
};

function isRelevantFallbackUrl(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return !IRRELEVANT_FALLBACK_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function queryBingRssSearch(searchQuery: string): Promise<WebSource[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}&format=rss`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) {
    throw new Error(`Bing RSS returned HTTP ${res.status}`);
  }

  const xml = await res.text();
  const sources: WebSource[] = [];
  const seen = new Set<string>();
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRegex.exec(xml)) !== null && sources.length < 8) {
    const block = itemMatch[1];
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const descMatch = block.match(/<description>([\s\S]*?)<\/description>/i);

    const uri = (linkMatch?.[1] || '').trim();
    const title = decodeHtmlEntities(titleMatch?.[1] || '');
    const snippet = decodeHtmlEntities(descMatch?.[1] || '');

    if (uri.startsWith('http') && isRelevantFallbackUrl(uri) && title && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        title,
        uri,
        snippet: snippet || undefined,
      });
    }
  }

  return sources;
}

interface FccComplaintRow {
  id?: string;
  date_created?: string;
  issue_type?: string;
  method?: string;
  issue?: string;
  caller_id_number?: string;
  type_of_call_or_messge?: string;
  city?: string;
  state?: string;
  type_of_property_goods_or_services?: string;
}

async function queryFccPhoneComplaints(rawDigits: string): Promise<WebSource[]> {
  const clean10 = rawDigits.length >= 10 ? rawDigits.slice(-10) : '';
  if (clean10.length !== 10) return [];

  const area = clean10.slice(0, 3);
  const prefix = clean10.slice(3, 6);
  const line = clean10.slice(6, 10);
  const hyphenated = `${area}-${prefix}-${line}`;

  const results: WebSource[] = [];

  // 1. Check exact number match in FCC Open Data
  const exactWhere = `caller_id_number='${hyphenated}' OR caller_id_number='${clean10}'`;
  const exactUrl = `https://opendata.fcc.gov/resource/sr6c-syda.json?$where=${encodeURIComponent(
    exactWhere
  )}&$order=date_created DESC&$limit=3`;

  const exactRes = await fetch(exactUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });

  if (exactRes.ok) {
    const rows = (await exactRes.json().catch(() => [])) as FccComplaintRow[];
    if (Array.isArray(rows) && rows.length > 0) {
      const sample = rows[0];
      results.push({
        title: `FCC Consumer Complaint Match (${hyphenated}) — ${rows.length} recent record(s)`,
        uri: `https://opendata.fcc.gov/Consumer-and-Governmental-Affairs/Consumer-Complaints-Data-Unwanted-Calls/sr6c-syda?caller_id_number=${encodeURIComponent(
          hyphenated
        )}`,
        snippet: `${sample.issue || 'Unwanted Calls'} (${sample.type_of_call_or_messge || sample.method || 'Phone'}) · Latest report ${
          sample.date_created ? sample.date_created.slice(0, 10) : 'recent'
        }${sample.city && sample.state ? ` in ${sample.city}, ${sample.state}` : ''}.`,
      });
    } else {
      results.push({
        title: `FCC Unwanted Calls Registry: No exact consumer complaints logged for ${hyphenated}`,
        uri: 'https://opendata.fcc.gov/Consumer-and-Governmental-Affairs/Consumer-Complaints-Data-Unwanted-Calls/sr6c-syda',
        snippet: `Direct lookup of FCC Socrata dataset (sr6c-syda) returned 0 exact matches for ${hyphenated}.`,
      });
    }
  }

  // 2. Check recent area-code / prefix robocall trend in FCC Open Data
  const areaWhere = `caller_id_number like '${area}-${prefix}-%' OR caller_id_number like '${area}-%'`;
  const areaUrl = `https://opendata.fcc.gov/resource/sr6c-syda.json?$where=${encodeURIComponent(
    areaWhere
  )}&$order=date_created DESC&$limit=3`;

  const areaRes = await fetch(areaUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });

  if (areaRes.ok) {
    const areaRows = (await areaRes.json().catch(() => [])) as FccComplaintRow[];
    if (Array.isArray(areaRows) && areaRows.length > 0) {
      const latest = areaRows[0];
      results.push({
        title: `FCC Area Code ${area} Activity: Recent Consumer Unwanted-Call Reports`,
        uri: 'https://opendata.fcc.gov/Consumer-and-Governmental-Affairs/Consumer-Complaints-Data-Unwanted-Calls/sr6c-syda/explore',
        snippet: `Recent reports in NPA-${area} include ${latest.caller_id_number || area} (${
          latest.type_of_call_or_messge || 'Phone'
        } · ${latest.issue || 'Unwanted Calls'}, reported ${
          latest.date_created ? latest.date_created.slice(0, 10) : 'recently'
        }).`,
      });
    }
  }

  return results;
}

interface ParsedPhoneServer {
  digits: string;
  isNanp: boolean;
  countryDialCode: string;
  countryIso: string;
  countryName: string;
  e164: string;
  formattedNational: string;
  formattedInternational: string;
  npa: string;
  nxx: string;
  line: string;
  thousandBlock: string;
}

const INTL_COUNTRY_PREFIXES: Array<{ dial: string; iso: string; name: string; tz: string; coords: [number, number] }> = [
  { dial: '44', iso: 'GB', name: 'United Kingdom', tz: 'Europe/London (GMT/BST)', coords: [51.5072, -0.1276] },
  { dial: '61', iso: 'AU', name: 'Australia', tz: 'Australia/Sydney (AEST)', coords: [-33.8688, 151.2093] },
  { dial: '49', iso: 'DE', name: 'Germany', tz: 'Europe/Berlin (CET)', coords: [52.52, 13.405] },
  { dial: '33', iso: 'FR', name: 'France', tz: 'Europe/Paris (CET)', coords: [48.8566, 2.3522] },
  { dial: '34', iso: 'ES', name: 'Spain', tz: 'Europe/Madrid (CET)', coords: [40.4168, -3.7038] },
  { dial: '39', iso: 'IT', name: 'Italy', tz: 'Europe/Rome (CET)', coords: [41.9028, 12.4964] },
  { dial: '31', iso: 'NL', name: 'Netherlands', tz: 'Europe/Amsterdam (CET)', coords: [52.3676, 4.9041] },
  { dial: '41', iso: 'CH', name: 'Switzerland', tz: 'Europe/Zurich (CET)', coords: [47.3769, 8.5417] },
  { dial: '46', iso: 'SE', name: 'Sweden', tz: 'Europe/Stockholm (CET)', coords: [59.3293, 18.0686] },
  { dial: '353', iso: 'IE', name: 'Ireland', tz: 'Europe/Dublin (GMT)', coords: [53.3498, -6.2603] },
  { dial: '52', iso: 'MX', name: 'Mexico', tz: 'America/Mexico_City (CST)', coords: [19.4326, -99.1332] },
  { dial: '55', iso: 'BR', name: 'Brazil', tz: 'America/Sao_Paulo (BRT)', coords: [-23.5505, -46.6333] },
  { dial: '81', iso: 'JP', name: 'Japan', tz: 'Asia/Tokyo (JST)', coords: [35.6762, 139.6503] },
  { dial: '82', iso: 'KR', name: 'South Korea', tz: 'Asia/Seoul (KST)', coords: [37.5665, 126.978] },
  { dial: '86', iso: 'CN', name: 'China', tz: 'Asia/Shanghai (CST)', coords: [39.9042, 116.4074] },
  { dial: '91', iso: 'IN', name: 'India', tz: 'Asia/Kolkata (IST)', coords: [28.6139, 77.209] },
  { dial: '64', iso: 'NZ', name: 'New Zealand', tz: 'Pacific/Auckland (NZST)', coords: [-36.8485, 174.7633] },
];

function parsePhoneInputServer(rawInput: string): ParsedPhoneServer | { error: string } {
  const trimmed = rawInput.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return { error: 'Enter a valid phone number (include area code, e.g. +1 415-890-4421).' };
  }

  if (!hasPlus && digits.length === 7) {
    return {
      error:
        'Include the 3-digit area code (e.g. +1 415-890-4421) so serving carrier and rate center can be resolved.',
    };
  }

  // NANP (+1 or 10-digit domestic US/Canada)
  const isExplicitIntlNonNanp = hasPlus && !digits.startsWith('1');
  if (!isExplicitIntlNonNanp && (digits.length === 10 || (digits.length === 11 && digits.startsWith('1')))) {
    const clean10 = digits.length === 11 ? digits.slice(1) : digits;
    const npa = clean10.slice(0, 3);
    const nxx = clean10.slice(3, 6);
    const line = clean10.slice(6, 10);
    return {
      digits: `1${clean10}`,
      isNanp: true,
      countryDialCode: '1',
      countryIso: 'US',
      countryName: 'United States / NANP',
      e164: `+1${clean10}`,
      formattedNational: `(${npa}) ${nxx}-${line}`,
      formattedInternational: `+1 ${npa}-${nxx}-${line}`,
      npa,
      nxx,
      line,
      thousandBlock: nxx.length === 3 && line.length === 4 ? line[0] : 'A',
    };
  }

  // International E.164
  const sortedPrefixes = [...INTL_COUNTRY_PREFIXES].sort((a, b) => b.dial.length - a.dial.length);
  const matched = sortedPrefixes.find((p) => digits.startsWith(p.dial));
  const dialCode = matched ? matched.dial : digits.slice(0, digits.length > 11 ? 2 : 1);
  const subscriberDigits = digits.slice(dialCode.length);

  return {
    digits,
    isNanp: false,
    countryDialCode: dialCode,
    countryIso: matched?.iso || 'INTL',
    countryName: matched?.name || `International (+${dialCode})`,
    e164: `+${digits}`,
    formattedNational: subscriberDigits,
    formattedInternational: `+${dialCode} ${subscriberDigits}`,
    npa: '',
    nxx: '',
    line: '',
    thousandBlock: '',
  };
}

interface LergPrefixInfo {
  npa: string;
  nxx: string;
  rateCenter: string;
  region: string;
  switchClli: string;
  switchName: string;
  ocn: string;
  companyName: string;
  companyTypeCode: string;
  ilecName: string;
  lata: string;
  lat: number | null;
  lon: number | null;
  updatedAt: string;
}

function extractXmlTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? decodeHtmlEntities(m[1]) : '';
}

async function queryLocalCallingGuide(
  npa: string,
  nxx: string,
  thousandBlock: string
): Promise<LergPrefixInfo | null> {
  if (!npa || !nxx || npa.length !== 3 || nxx.length !== 3) return null;
  const url = `https://localcallingguide.com/xmlprefix.php?npa=${encodeURIComponent(npa)}&nxx=${encodeURIComponent(nxx)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VigilALPROSINT/1.0' },
    signal: AbortSignal.timeout(5500),
  });
  if (!res.ok) return null;

  const xml = await res.text();
  const blocks = [...xml.matchAll(/<prefixdata>([\s\S]*?)<\/prefixdata>/gi)].map((m) => m[1]);
  if (blocks.length === 0) return null;

  // Prefer the exact 1,000-block digit (<x>0..9</x>), otherwise <x>A</x>, otherwise first block
  const exactBlock =
    blocks.find((b) => extractXmlTag(b, 'x').toUpperCase() === thousandBlock.toUpperCase()) ||
    blocks.find((b) => extractXmlTag(b, 'x').toUpperCase() === 'A') ||
    blocks[0];

  const latStr = extractXmlTag(exactBlock, 'rc-lat');
  const lonStr = extractXmlTag(exactBlock, 'rc-lon');
  const lat = latStr && !Number.isNaN(Number(latStr)) ? Number(latStr) : null;
  const lon = lonStr && !Number.isNaN(Number(lonStr)) ? Number(lonStr) : null;

  return {
    npa,
    nxx,
    rateCenter: extractXmlTag(exactBlock, 'rc'),
    region: extractXmlTag(exactBlock, 'region'),
    switchClli: extractXmlTag(exactBlock, 'switch'),
    switchName: extractXmlTag(exactBlock, 'switchname'),
    ocn: extractXmlTag(exactBlock, 'ocn'),
    companyName: extractXmlTag(exactBlock, 'company-name'),
    companyTypeCode: extractXmlTag(exactBlock, 'company-type').toUpperCase(),
    ilecName: extractXmlTag(exactBlock, 'ilec-name'),
    lata: extractXmlTag(exactBlock, 'lata'),
    lat,
    lon,
    updatedAt: extractXmlTag(exactBlock, 'udate'),
  };
}

function classifyLergCarrier(companyName: string, typeCode: string): {
  carrierType: 'Tier-1 Wireless' | 'Regional Mobile' | 'VoIP / Cloud PBX' | 'Landline ILEC' | 'Toll-Free CLEC';
  lineType: 'Mobile' | 'Landline' | 'VoIP' | 'Toll-Free' | 'Virtual / Burner';
} {
  const upperName = companyName.toUpperCase();
  const isVoipHeavy =
    upperName.includes('TWILIO') ||
    upperName.includes('BANDWIDTH') ||
    upperName.includes('ONVOY') ||
    upperName.includes('SINCH') ||
    upperName.includes('INTELIQUENT') ||
    upperName.includes('PEERLESS') ||
    upperName.includes('LEVEL 3') ||
    upperName.includes('VONAGE') ||
    upperName.includes('METROPCS') === false && upperName.includes('VOIP');

  if (isVoipHeavy) {
    return { carrierType: 'VoIP / Cloud PBX', lineType: 'VoIP' };
  }
  if (typeCode === 'W' || typeCode === 'P') {
    const tier1 =
      upperName.includes('VERIZON') ||
      upperName.includes('CELLCO') ||
      upperName.includes('AT&T') ||
      upperName.includes('NEW CINGULAR') ||
      upperName.includes('T-MOBILE') ||
      upperName.includes('SPRINT') ||
      upperName.includes('OMNIPOINT');
    return {
      carrierType: tier1 ? 'Tier-1 Wireless' : 'Regional Mobile',
      lineType: 'Mobile',
    };
  }
  if (typeCode === 'C') {
    return { carrierType: 'VoIP / Cloud PBX', lineType: 'VoIP' };
  }
  return { carrierType: 'Landline ILEC', lineType: 'Landline' };
}

async function queryFccExactRows(npa: string, nxx: string, line: string): Promise<FccComplaintRow[]> {
  if (!npa || !nxx || !line) return [];
  const hyphenated = `${npa}-${nxx}-${line}`;
  const clean10 = `${npa}${nxx}${line}`;
  const exactWhere = `caller_id_number='${hyphenated}' OR caller_id_number='${clean10}'`;
  const url = `https://opendata.fcc.gov/resource/sr6c-syda.json?$where=${encodeURIComponent(
    exactWhere
  )}&$order=date_created DESC&$limit=25`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5500),
  });
  if (!res.ok) return [];
  const rows = (await res.json().catch(() => [])) as FccComplaintRow[];
  return Array.isArray(rows) ? rows : [];
}

interface OwnerLookupMatch {
  status: 'verified_owner' | 'cnam_only';
  ownerName: string;
  ownerType: 'Individual' | 'Corporate' | 'Government / Public';
  streetAddress?: string;
  cityStateZip?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  coordinates?: [number, number];
  addressHistory: Array<{
    street: string;
    cityState: string;
    years: string;
    isCurrent: boolean;
  }>;
  emails: string[];
  altPhones: string[];
  digitalFootprint: Array<{
    platform: string;
    profileHandle: string;
    verified: boolean;
  }>;
  carrierOverride?: {
    name?: string;
    lineType?: 'Mobile' | 'Landline' | 'VoIP' | 'Toll-Free' | 'Virtual / Burner';
    carrierType?: 'Tier-1 Wireless' | 'Regional Mobile' | 'VoIP / Cloud PBX' | 'Landline ILEC' | 'Toll-Free CLEC';
  };
  sourceLabel: string;
  sourceUrl?: string;
}

async function queryTrestlePhone(e164: string): Promise<OwnerLookupMatch | null> {
  const apiKey = (process.env.TRESTLE_API_KEY || '').trim();
  if (!apiKey) return null;

  const url = `https://api.trestleiq.com/3.2/phone?phone=${encodeURIComponent(e164)}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as {
    belongs_to?: { name?: string; type?: string };
    carrier?: string;
    line_type?: string;
    current_addresses?: Array<{
      street_line_1?: string;
      street_line_2?: string;
      city?: string;
      state_code?: string;
      postal_code?: string;
      lat_long?: { latitude?: number; longitude?: number };
    }>;
    historical_addresses?: Array<{
      street_line_1?: string;
      street_line_2?: string;
      city?: string;
      state_code?: string;
      postal_code?: string;
    }>;
    emails?: Array<{ email_address?: string } | string>;
    alternate_phones?: Array<{ phone_number?: string } | string>;
  } | null;

  const ownerName = data?.belongs_to?.name?.trim();
  if (!ownerName) return null;

  const isCorp = (data?.belongs_to?.type || '').toLowerCase() === 'business';
  const currAddrs = data?.current_addresses || [];
  const histAddrs = data?.historical_addresses || [];

  const addressHistory: OwnerLookupMatch['addressHistory'] = [];
  for (const a of currAddrs.slice(0, 3)) {
    const street = [a.street_line_1, a.street_line_2].filter(Boolean).join(', ').trim();
    const cityState = [a.city, a.state_code, a.postal_code].filter(Boolean).join(', ').trim();
    if (street || cityState) {
      addressHistory.push({ street: street || cityState, cityState, years: 'Current Listing', isCurrent: true });
    }
  }
  for (const a of histAddrs.slice(0, 3)) {
    const street = [a.street_line_1, a.street_line_2].filter(Boolean).join(', ').trim();
    const cityState = [a.city, a.state_code, a.postal_code].filter(Boolean).join(', ').trim();
    if (street || cityState) {
      addressHistory.push({ street: street || cityState, cityState, years: 'Historical', isCurrent: false });
    }
  }

  const primaryAddr = currAddrs[0];
  const primaryStreet = primaryAddr
    ? [primaryAddr.street_line_1, primaryAddr.street_line_2].filter(Boolean).join(', ').trim()
    : undefined;
  const primaryCityState = primaryAddr
    ? [primaryAddr.city, primaryAddr.state_code, primaryAddr.postal_code].filter(Boolean).join(', ').trim()
    : undefined;

  const emails = (data?.emails || [])
    .map((e) => (typeof e === 'string' ? e : e.email_address || ''))
    .filter(Boolean)
    .slice(0, 4);

  const altPhones = (data?.alternate_phones || [])
    .map((p) => (typeof p === 'string' ? p : p.phone_number || ''))
    .filter(Boolean)
    .slice(0, 4);

  const ltLower = (data?.line_type || '').toLowerCase();
  const mappedLine: OwnerLookupMatch['carrierOverride'] =
    data?.carrier || ltLower
      ? {
          name: data?.carrier || undefined,
          lineType: ltLower.includes('mobile')
            ? 'Mobile'
            : ltLower.includes('voip') || ltLower.includes('fixedvoip')
            ? 'VoIP'
            : ltLower.includes('toll')
            ? 'Toll-Free'
            : 'Landline',
        }
      : undefined;

  return {
    status: primaryStreet ? 'verified_owner' : 'cnam_only',
    ownerName,
    ownerType: isCorp ? 'Corporate' : 'Individual',
    streetAddress: primaryStreet,
    cityStateZip: primaryCityState,
    city: primaryAddr?.city,
    state: primaryAddr?.state_code,
    postalCode: primaryAddr?.postal_code,
    coordinates:
      primaryAddr?.lat_long?.latitude !== undefined && primaryAddr?.lat_long?.longitude !== undefined
        ? [primaryAddr.lat_long.latitude, primaryAddr.lat_long.longitude]
        : undefined,
    addressHistory,
    emails,
    altPhones,
    digitalFootprint: [
      {
        platform: 'Trestle Reverse Phone Registry',
        profileHandle: `${ownerName}${primaryStreet ? ` (${primaryAddr?.city || ''}, ${primaryAddr?.state_code || ''})` : ''}`,
        verified: true,
      },
    ],
    carrierOverride: mappedLine,
    sourceLabel: 'Trestle Reverse Phone Registry',
  };
}

async function queryTwilioLookupV2(e164: string): Promise<OwnerLookupMatch | null> {
  const sid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  if (!sid || !token) return null;

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(
    e164
  )}?Fields=caller_name,line_type_intelligence`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as {
    caller_name?: { caller_name?: string; caller_type?: string };
    line_type_intelligence?: { carrier_name?: string; type?: string };
  } | null;

  const cnam = data?.caller_name?.caller_name?.trim();
  if (!cnam) return null;

  const isBiz = (data?.caller_name?.caller_type || '').toUpperCase() === 'BUSINESS';
  const ltLower = (data?.line_type_intelligence?.type || '').toLowerCase();

  return {
    status: 'cnam_only',
    ownerName: cnam,
    ownerType: isBiz ? 'Corporate' : 'Individual',
    addressHistory: [],
    emails: [],
    altPhones: [],
    digitalFootprint: [
      {
        platform: 'Carrier CNAM Registry (Twilio Lookup v2)',
        profileHandle: `${cnam} (${data?.caller_name?.caller_type || 'CNAM'})`,
        verified: true,
      },
    ],
    carrierOverride: data?.line_type_intelligence?.carrier_name
      ? {
          name: data.line_type_intelligence.carrier_name,
          lineType: ltLower.includes('mobile')
            ? 'Mobile'
            : ltLower.includes('voip')
            ? 'VoIP'
            : ltLower.includes('toll')
            ? 'Toll-Free'
            : 'Landline',
        }
      : undefined,
    sourceLabel: 'Twilio Lookup v2 (CNAM)',
  };
}

async function querySecEdgarByPhone(npa: string, nxx: string, line: string): Promise<OwnerLookupMatch | null> {
  if (!npa || !nxx || !line) return null;
  const target10 = `${npa}${nxx}${line}`;
  const query = `"${npa}-${nxx}-${line}" OR "(${npa}) ${nxx}-${line}"`;
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(query)}`;
  const ua = { 'User-Agent': 'VigilALPROSINT/1.0 contact@vigilalpr.local', Accept: 'application/json' };

  const searchRes = await fetch(searchUrl, { headers: ua, signal: AbortSignal.timeout(4500) });
  if (!searchRes.ok) return null;

  const searchData = (await searchRes.json().catch(() => null)) as {
    hits?: { hits?: Array<{ _source?: { ciks?: string[] } }> };
  } | null;

  const cikSet = new Set<string>();
  for (const hit of searchData?.hits?.hits || []) {
    for (const c of hit._source?.ciks || []) {
      const padded = c.replace(/\D/g, '').padStart(10, '0');
      if (padded.length === 10) cikSet.add(padded);
      if (cikSet.size >= 3) break;
    }
    if (cikSet.size >= 3) break;
  }

  if (cikSet.size === 0) return null;

  const submissions = await Promise.all(
    [...cikSet].map(async (cik) => {
      const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: ua,
        signal: AbortSignal.timeout(4500),
      });
      if (!r.ok) return null;
      return (await r.json().catch(() => null)) as {
        cik?: string;
        name?: string;
        phone?: string;
        sicDescription?: string;
        tickers?: string[];
        addresses?: {
          business?: { street1?: string; street2?: string; city?: string; stateOrCountry?: string; zipCode?: string };
          mailing?: { street1?: string; street2?: string; city?: string; stateOrCountry?: string; zipCode?: string };
        };
      } | null;
    })
  );

  const exactEntity = submissions.find((sub) => {
    if (!sub?.name || !sub.phone) return false;
    const subDigits = sub.phone.replace(/\D/g, '');
    return subDigits.slice(-10) === target10;
  });

  if (!exactEntity?.name) return null;

  const addr = exactEntity.addresses?.business || exactEntity.addresses?.mailing;
  const street = addr ? [addr.street1, addr.street2].filter(Boolean).join(', ').trim() : undefined;
  const cityStateZip = addr
    ? `${addr.city || ''}${addr.city && addr.stateOrCountry ? ', ' : ''}${addr.stateOrCountry || ''} ${addr.zipCode || ''}`.trim()
    : undefined;

  const addressHistory: OwnerLookupMatch['addressHistory'] = [];
  if (exactEntity.addresses?.business?.street1) {
    const b = exactEntity.addresses.business;
    addressHistory.push({
      street: [b.street1, b.street2].filter(Boolean).join(', '),
      cityState: `${b.city || ''}, ${b.stateOrCountry || ''} ${b.zipCode || ''}`.trim(),
      years: 'SEC Registered Business Address',
      isCurrent: true,
    });
  }
  if (
    exactEntity.addresses?.mailing?.street1 &&
    exactEntity.addresses.mailing.street1 !== exactEntity.addresses?.business?.street1
  ) {
    const m = exactEntity.addresses.mailing;
    addressHistory.push({
      street: [m.street1, m.street2].filter(Boolean).join(', '),
      cityState: `${m.city || ''}, ${m.stateOrCountry || ''} ${m.zipCode || ''}`.trim(),
      years: 'SEC Mailing Address',
      isCurrent: false,
    });
  }

  const paddedCik = (exactEntity.cik || '').padStart(10, '0');
  const edgarUrl = `https://www.sec.gov/edgar/browse/?CIK=${paddedCik}`;

  return {
    status: street ? 'verified_owner' : 'cnam_only',
    ownerName: exactEntity.name,
    ownerType: 'Corporate',
    streetAddress: street,
    cityStateZip,
    city: addr?.city,
    state: addr?.stateOrCountry,
    postalCode: addr?.zipCode,
    addressHistory,
    emails: [],
    altPhones: [],
    digitalFootprint: [
      {
        platform: 'SEC EDGAR Corporate Registry',
        profileHandle: `CIK ${paddedCik}${exactEntity.tickers?.length ? ` (${exactEntity.tickers[0]})` : ''}${exactEntity.sicDescription ? ` · ${exactEntity.sicDescription}` : ''}`,
        verified: true,
      },
    ],
    sourceLabel: 'SEC EDGAR Official Filing',
    sourceUrl: edgarUrl,
  };
}

async function queryWikidataByPhone(parsed: ParsedPhoneServer): Promise<OwnerLookupMatch | null> {
  const candidates = parsed.isNanp
    ? [
        `+1-${parsed.npa}-${parsed.nxx}-${parsed.line}`,
        `+1 ${parsed.npa}-${parsed.nxx}-${parsed.line}`,
        `+1 (${parsed.npa}) ${parsed.nxx}-${parsed.line}`,
        `(${parsed.npa}) ${parsed.nxx}-${parsed.line}`,
        `${parsed.npa}-${parsed.nxx}-${parsed.line}`,
        `+1 ${parsed.npa} ${parsed.nxx} ${parsed.line}`,
        parsed.e164,
      ]
    : [parsed.e164, parsed.formattedInternational];

  const valuesClause = candidates.map((c) => `"${c.replace(/"/g, '')}"`).join(' ');
  const sparql = `SELECT ?item ?itemLabel ?street ?postal ?website ?hqLabel WHERE {
    VALUES ?phone { ${valuesClause} }
    ?item wdt:P1329 ?phone .
    OPTIONAL { ?item wdt:P6375 ?street . }
    OPTIONAL { ?item wdt:P281 ?postal . }
    OPTIONAL { ?item wdt:P856 ?website . }
    OPTIONAL { ?item wdt:P159 ?hq . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 3`;

  const res = await fetch(
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
    {
      headers: { 'User-Agent': 'VigilALPROSINT/1.0 (https://vigilalpr.local; contact@vigilalpr.local)' },
      signal: AbortSignal.timeout(4500),
    }
  );
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as {
    results?: {
      bindings?: Array<{
        item?: { value?: string };
        itemLabel?: { value?: string };
        street?: { value?: string };
        postal?: { value?: string };
        website?: { value?: string };
        hqLabel?: { value?: string };
      }>;
    };
  } | null;

  const row = (data?.results?.bindings || []).find(
    (b) => b.itemLabel?.value && !/^Q\d+$/.test(b.itemLabel.value)
  );
  if (!row?.itemLabel?.value) return null;

  const ownerName = row.itemLabel.value;
  const street = row.street?.value?.trim();
  const cityStateZip = [row.hqLabel?.value, row.postal?.value].filter(Boolean).join(' ').trim() || undefined;
  const isGov = /police|government|city of|department|white house|federal|court|county|state/i.test(ownerName);

  const addressHistory: OwnerLookupMatch['addressHistory'] = [];
  if (street || cityStateZip) {
    addressHistory.push({
      street: street || cityStateZip || '',
      cityState: cityStateZip || 'Public Registry Address',
      years: 'Wikidata Public Listing',
      isCurrent: true,
    });
  }

  return {
    status: street ? 'verified_owner' : 'cnam_only',
    ownerName,
    ownerType: isGov ? 'Government / Public' : 'Corporate',
    streetAddress: street,
    cityStateZip,
    postalCode: row.postal?.value,
    addressHistory,
    emails: [],
    altPhones: [],
    digitalFootprint: [
      ...(row.website?.value
        ? [{ platform: 'Official Organization Website', profileHandle: row.website.value, verified: true }]
        : []),
      {
        platform: 'Wikidata Public Entity Registry',
        profileHandle: row.item?.value?.split('/').pop() || ownerName,
        verified: true,
      },
    ],
    sourceLabel: 'Wikidata Public Entity Registry',
    sourceUrl: row.item?.value,
  };
}

async function resolvePhoneOwnerInfo(parsed: ParsedPhoneServer): Promise<OwnerLookupMatch | null> {
  const [trestleRes, twilioRes, secRes, wikidataRes] = await Promise.allSettled([
    queryTrestlePhone(parsed.e164),
    queryTwilioLookupV2(parsed.e164),
    parsed.isNanp ? querySecEdgarByPhone(parsed.npa, parsed.nxx, parsed.line) : Promise.resolve(null),
    queryWikidataByPhone(parsed),
  ]);

  const trestle = trestleRes.status === 'fulfilled' ? trestleRes.value : null;
  const twilio = twilioRes.status === 'fulfilled' ? twilioRes.value : null;
  const sec = secRes.status === 'fulfilled' ? secRes.value : null;
  const wikidata = wikidataRes.status === 'fulfilled' ? wikidataRes.value : null;

  if (trestle) return trestle;
  if (sec) return sec;
  if (wikidata && wikidata.streetAddress) return wikidata;
  if (twilio) {
    return wikidata
      ? {
          ...twilio,
          streetAddress: wikidata.streetAddress,
          cityStateZip: wikidata.cityStateZip,
          addressHistory: wikidata.addressHistory,
          status: wikidata.streetAddress ? 'verified_owner' : 'cnam_only',
        }
      : twilio;
  }
  return wikidata;
}

const NANPA_TOLL_FREE_NPAS = new Set(['800', '833', '844', '855', '866', '877', '888']);

const REGION_TIMEZONES: Record<string, string> = {
  CT: 'America/New_York (EST)', DE: 'America/New_York (EST)', DC: 'America/New_York (EST)',
  FL: 'America/New_York (EST)', GA: 'America/New_York (EST)', IN: 'America/Indiana/Indianapolis (EST)',
  KY: 'America/New_York (EST)', ME: 'America/New_York (EST)', MD: 'America/New_York (EST)',
  MA: 'America/New_York (EST)', MI: 'America/Detroit (EST)', NH: 'America/New_York (EST)',
  NJ: 'America/New_York (EST)', NY: 'America/New_York (EST)', NC: 'America/New_York (EST)',
  OH: 'America/New_York (EST)', PA: 'America/New_York (EST)', RI: 'America/New_York (EST)',
  SC: 'America/New_York (EST)', VT: 'America/New_York (EST)', VA: 'America/New_York (EST)',
  WV: 'America/New_York (EST)',
  AL: 'America/Chicago (CST)', AR: 'America/Chicago (CST)', IL: 'America/Chicago (CST)',
  IA: 'America/Chicago (CST)', KS: 'America/Chicago (CST)', LA: 'America/Chicago (CST)',
  MN: 'America/Chicago (CST)', MS: 'America/Chicago (CST)', MO: 'America/Chicago (CST)',
  NE: 'America/Chicago (CST)', ND: 'America/Chicago (CST)', OK: 'America/Chicago (CST)',
  SD: 'America/Chicago (CST)', TN: 'America/Chicago (CST)', TX: 'America/Chicago (CST)',
  WI: 'America/Chicago (CST)',
  AZ: 'America/Phoenix (MST)', CO: 'America/Denver (MST)', ID: 'America/Boise (MST)',
  MT: 'America/Denver (MST)', NM: 'America/Denver (MST)', UT: 'America/Denver (MST)',
  WY: 'America/Denver (MST)',
  CA: 'America/Los_Angeles (PST)', NV: 'America/Los_Angeles (PST)',
  OR: 'America/Los_Angeles (PST)', WA: 'America/Los_Angeles (PST)',
  AK: 'America/Anchorage (AKST)', HI: 'Pacific/Honolulu (HST)',
};

const CURATED_CASE_STUDY_PHONES: Record<string, unknown> = {
  '14158904421': {
    phoneNumber: '+14158904421',
    formattedNational: '(415) 890-4421',
    formattedInternational: '+1 415-890-4421',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'Twilio / Bandwidth.com Inc.',
      type: 'VoIP / Cloud PBX',
      networkCode: 'US-TWL-01',
      originalNetwork: 'Twilio Inc.',
      isPorted: true,
      lastPortedDate: '2024-03-12',
    },
    lineType: 'VoIP',
    riskAnalysis: {
      spamScore: 94,
      riskLevel: 'Severe',
      primaryFlag: 'Automated Robocall Phishing Cluster',
      totalReports: 1842,
      activityCategory: 'Phishing / Impersonation',
      lastActiveDate: '2026-11-10T14:22:00Z',
    },
    location: {
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94107',
      timeZone: 'America/Los_Angeles (PST)',
      rateCenter: 'SNFCCA01DS0',
      coordinates: [37.7749, -122.4194],
    },
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Apex Cloud Lead Systems LLC (Disputed Identity)',
      ownerType: 'Corporate',
      streetAddress: '548 Market St, Suite #8911',
      cityStateZip: 'San Francisco, CA 94104',
      sourceLabel: 'Case-Study Corporate WHOIS Dossier',
    },
    dossier: {
      subscriberName: 'Apex Cloud Lead Systems LLC (Disputed Identity)',
      subscriberType: 'Corporate',
      addressHistory: [
        { street: '548 Market St, Suite #8911', cityState: 'San Francisco, CA 94104', years: '2023 - Present', isCurrent: true },
        { street: '1209 Orange St, Corp Trust Center', cityState: 'Wilmington, DE 19801', years: '2021 - 2023', isCurrent: false },
      ],
      associatedEmails: ['billing@apexleadnetworks.io', 'tech-ops@virtualroute.net'],
      breachExposures: [
        { breachName: 'LeadPoint B2B Aggregator Leak', year: 2024, compromisedData: ['API Keys', 'VoIP SIP Credentials', 'Call Logs'] },
        { breachName: 'TeleSpam Blacklist Database', year: 2025, compromisedData: ['Originating IP Pool', 'Asterisk Server Configs'] },
      ],
      digitalFootprint: [
        { platform: 'Domain Registrant (WHOIS)', profileHandle: 'apexleadnetworks.io', verified: true },
        { platform: 'SIP Gateway Registry', profileHandle: 'sip.trunk.us-west-1.twl', verified: true },
        { platform: 'FCC RoboCall Mitigation Database', profileHandle: 'RMD-2024-99218', verified: false },
      ],
      altPhoneNumbers: ['+1 (415) 890-4422', '+1 (415) 890-4429', '+1 (628) 201-9011'],
    },
  },
  '12125550199': {
    phoneNumber: '+12125550199',
    formattedNational: '(212) 555-0199',
    formattedInternational: '+1 212-555-0199',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'Verizon Wireless (Cellco Partnership)',
      type: 'Tier-1 Wireless',
      networkCode: 'US-VZW-60',
      originalNetwork: 'Verizon Wireless',
      isPorted: false,
    },
    lineType: 'Mobile',
    riskAnalysis: {
      spamScore: 4,
      riskLevel: 'Low',
      primaryFlag: 'Verified Enterprise Mobility Account',
      totalReports: 0,
      activityCategory: 'Commercial Business',
      lastActiveDate: '2026-11-11T16:04:00Z',
    },
    location: {
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      timeZone: 'America/New_York (EST)',
      rateCenter: 'NYCKNY37',
      coordinates: [40.7128, -74.006],
    },
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Vanguard Media Group Inc. (Corp Line #14)',
      ownerType: 'Corporate',
      streetAddress: '350 5th Avenue, 44th Floor',
      cityStateZip: 'New York, NY 10118',
      sourceLabel: 'Case-Study Corporate Directory',
    },
    dossier: {
      subscriberName: 'Vanguard Media Group Inc. (Corp Line #14)',
      subscriberType: 'Corporate',
      addressHistory: [
        { street: '350 5th Avenue, 44th Floor', cityState: 'New York, NY 10118', years: '2019 - Present', isCurrent: true },
      ],
      associatedEmails: ['it-comms@vanguardmedia.com', 'press@vanguardmedia.com'],
      breachExposures: [],
      digitalFootprint: [
        { platform: 'LinkedIn Corporate Directory', profileHandle: 'vanguard-media-nyc', verified: true },
        { platform: 'Dun & Bradstreet DUNS', profileHandle: 'DUNS-09-182-3819', verified: true },
      ],
      altPhoneNumbers: ['+1 (212) 555-0100', '+1 (212) 555-0200'],
    },
  },
  '15128439012': {
    phoneNumber: '+15128439012',
    formattedNational: '(512) 843-9012',
    formattedInternational: '+1 512-843-9012',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'AT&T Mobility LLC',
      type: 'Tier-1 Wireless',
      networkCode: 'US-ATT-410',
      originalNetwork: 'T-Mobile USA Inc.',
      isPorted: true,
      lastPortedDate: '2023-08-19',
    },
    lineType: 'Mobile',
    riskAnalysis: {
      spamScore: 12,
      riskLevel: 'Low',
      primaryFlag: 'Nominal Personal Subscriber',
      totalReports: 1,
      activityCategory: 'Nominal Consumer',
      lastActiveDate: '2026-11-11T12:45:00Z',
    },
    location: {
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      timeZone: 'America/Chicago (CST)',
      rateCenter: 'AUSTTXGR',
      coordinates: [30.2672, -97.7431],
    },
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Marcus E. Thornton',
      ownerType: 'Individual',
      streetAddress: '1104 S Congress Ave, Apt 3B',
      cityStateZip: 'Austin, TX 78704',
      sourceLabel: 'Case-Study Subscriber Dossier',
    },
    dossier: {
      subscriberName: 'Marcus E. Thornton',
      subscriberType: 'Individual',
      addressHistory: [
        { street: '1104 S Congress Ave, Apt 3B', cityState: 'Austin, TX 78704', years: '2022 - Present', isCurrent: true },
        { street: '4208 Guadalupe St', cityState: 'Austin, TX 78751', years: '2018 - 2022', isCurrent: false },
      ],
      associatedEmails: ['m.thornton.atx@gmail.com', 'marcus@austintechlabs.dev'],
      breachExposures: [
        { breachName: 'Dropbox Credential Leak (Historical)', year: 2016, compromisedData: ['Email', 'Hashed Passwords'] },
        { breachName: 'AT&T Data Customer Incident', year: 2024, compromisedData: ['Call Metadata Records', 'Account PIN Hash'] },
      ],
      digitalFootprint: [
        { platform: 'GitHub', profileHandle: 'marcus-thornton-dev', verified: true },
        { platform: 'Telegram Public Directory', profileHandle: '@m_thornton_atx', verified: false },
      ],
      altPhoneNumbers: ['+1 (512) 843-9013'],
    },
  },
  '18006723190': {
    phoneNumber: '+18006723190',
    formattedNational: '(800) 672-3190',
    formattedInternational: '+1 800-672-3190',
    countryCode: 'US',
    countryName: 'United States',
    carrier: {
      name: 'Lumen Technologies / Level 3 Communications',
      type: 'Toll-Free CLEC',
      networkCode: 'US-LUM-00',
      originalNetwork: 'AT&T Toll-Free Service',
      isPorted: true,
      lastPortedDate: '2022-11-04',
    },
    lineType: 'Toll-Free',
    riskAnalysis: {
      spamScore: 88,
      riskLevel: 'High',
      primaryFlag: 'Aggressive Auto-Dialer Debt Collection',
      totalReports: 730,
      activityCategory: 'Debt Collection',
      lastActiveDate: '2026-11-11T09:15:00Z',
    },
    location: {
      city: 'National Toll-Free Routing',
      state: 'US',
      postalCode: '00000',
      timeZone: 'Multi-Region (US/CAN)',
      rateCenter: 'TOLLFREE-800',
      coordinates: [39.8283, -98.5795],
    },
    ownerSummary: {
      status: 'verified_owner',
      ownerName: 'Midland Credit Management Regional Outbound',
      ownerType: 'Corporate',
      streetAddress: '350 Camino De La Reina, Suite 100',
      cityStateZip: 'San Diego, CA 92108',
      sourceLabel: 'Case-Study Corporate Registry',
    },
    dossier: {
      subscriberName: 'Midland Credit Management Regional Outbound',
      subscriberType: 'Corporate',
      addressHistory: [
        { street: '350 Camino De La Reina, Suite 100', cityState: 'San Diego, CA 92108', years: '2017 - Present', isCurrent: true },
      ],
      associatedEmails: ['inquiries@mcm-collections.org'],
      breachExposures: [
        { breachName: 'CFPB Public Complaint Registry', year: 2025, compromisedData: ['Call Scripts', 'FDCPA Violation Reports'] },
      ],
      digitalFootprint: [
        { platform: 'Better Business Bureau File', profileHandle: 'midland-credit-ca', verified: true },
      ],
      altPhoneNumbers: ['+1 (800) 672-3191', '+1 (800) 672-3192'],
    },
  },
};

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

interface AtlasRecord {
  city: string;
  county: string;
  state: string;
  agency: string;
  technology: string;
  vendor: string;
  summary: string;
  links: string[];
}

async function fetchAtlasOfSurveillanceRecords(locationParam: string): Promise<AtlasRecord[]> {
  const url = `https://kiosk.atlasofsurveillance.org/download.csv?location=${encodeURIComponent(locationParam)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VigilALPROSINT/1.0 (https://vigilalpr.local; contact@vigilalpr.local)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];

  const csvText = await res.text();
  if (!csvText || csvText.trimStart().startsWith('<')) return [];

  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => h.toLowerCase());
  const idxOf = (name: string, fallbackIdx: number) => {
    const found = header.indexOf(name.toLowerCase());
    return found >= 0 ? found : fallbackIdx;
  };

  const cityIdx = idxOf('city', 2);
  const countyIdx = idxOf('county', 3);
  const stateIdx = idxOf('state', 4);
  const agencyIdx = idxOf('agency', 5);
  const summaryIdx = idxOf('summary', 7);
  const techIdx = idxOf('technology', 9);
  const vendorIdx = idxOf('vendor', 11);

  const records: AtlasRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const agency = cols[agencyIdx] || '';
    if (!agency) continue;
    const links = cols.filter((cell) => /^https?:\/\//i.test(cell));
    records.push({
      city: cols[cityIdx] || '',
      county: cols[countyIdx] || '',
      state: cols[stateIdx] || '',
      agency,
      technology: cols[techIdx] || '',
      vendor: cols[vendorIdx] || '',
      summary: cols[summaryIdx] || '',
      links,
    });
  }

  return records;
}

async function queryAtlasOfSurveillanceAlpr(
  stateCode: string,
  cityOrCounty?: string
): Promise<WebSource[]> {
  const cleanState = stateCode.trim().toUpperCase();
  const cleanCity = cityOrCounty?.trim();
  const locationQuery = cleanCity ? `${cleanCity}, ${cleanState}` : cleanState;

  let records = await fetchAtlasOfSurveillanceRecords(locationQuery).catch(() => []);
  if (records.length === 0 && cleanCity) {
    records = await fetchAtlasOfSurveillanceRecords(cleanState).catch(() => []);
  }

  const alprRows = records.filter(
    (r) =>
      r.technology.toLowerCase().includes('license plate') ||
      r.vendor.toLowerCase().includes('flock') ||
      r.summary.toLowerCase().includes('alpr') ||
      r.summary.toLowerCase().includes('flock')
  );

  // Prioritize Flock Safety & city/county matches
  const cityLower = cleanCity?.toLowerCase() || '';
  alprRows.sort((a, b) => {
    const aCity = cityLower && (a.city.toLowerCase().includes(cityLower) || a.county.toLowerCase().includes(cityLower)) ? 2 : 0;
    const bCity = cityLower && (b.city.toLowerCase().includes(cityLower) || b.county.toLowerCase().includes(cityLower)) ? 2 : 0;
    const aFlock = a.vendor.toLowerCase().includes('flock') || a.summary.toLowerCase().includes('flock') ? 1 : 0;
    const bFlock = b.vendor.toLowerCase().includes('flock') || b.summary.toLowerCase().includes('flock') ? 1 : 0;
    return (bCity + bFlock) - (aCity + aFlock);
  });

  const sources: WebSource[] = [];
  const seenUris = new Set<string>();

  for (const row of alprRows) {
    if (sources.length >= 4) break;
    const primaryUri =
      row.links[0] ||
      `https://atlasofsurveillance.org/search?location=${encodeURIComponent(locationQuery)}`;
    if (seenUris.has(primaryUri)) continue;
    seenUris.add(primaryUri);

    const vendorTag = row.vendor ? ` (${row.vendor})` : '';
    const locTag = [row.city, row.state].filter(Boolean).join(', ');
    sources.push({
      title: `EFF Atlas: ${row.agency}${vendorTag}${locTag ? ` — ${locTag}` : ''}`,
      uri: primaryUri,
      snippet: row.summary || `${row.technology} documented in ${locTag || cleanState}.`,
    });
  }

  // Add Atlas search overview & DeFlock crowdsourced map
  const atlasSearchUrl = `https://atlasofsurveillance.org/search?location=${encodeURIComponent(locationQuery)}`;
  if (!seenUris.has(atlasSearchUrl)) {
    sources.push({
      title: `EFF Atlas of Surveillance Directory (${locationQuery}) — ${alprRows.length} ALPR Record(s)`,
      uri: atlasSearchUrl,
      snippet: `Live Electronic Frontier Foundation open-source registry of police ALPR & Flock Safety deployments in ${locationQuery}.`,
    });
  }

  sources.push({
    title: 'DeFlock Crowdsourced ALPR Camera Map & Flock Safety Directory',
    uri: 'https://deflock.org/',
    snippet: 'Community-mapped Flock Safety and automated license plate reader locations and municipal deployment disclosures.',
  });

  return sources;
}

async function queryAtlasOfSurveillanceFoia(
  agencyOrCity: string,
  stateCode?: string
): Promise<WebSource[]> {
  const cleanState = (stateCode || '').trim().toUpperCase();
  const cleanTarget = agencyOrCity.trim();
  const tokens = cleanTarget
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !['police', 'department', 'dept', 'city', 'county', 'records', 'the'].includes(t));

  let records = await fetchAtlasOfSurveillanceRecords(
    cleanState ? `${cleanTarget}, ${cleanState}` : cleanTarget
  ).catch(() => []);

  if (records.length === 0 && cleanState) {
    records = await fetchAtlasOfSurveillanceRecords(cleanState).catch(() => []);
  }

  const matched = records.filter((r) => {
    const hasMuckRockOrFoia = r.links.some((l) => l.toLowerCase().includes('muckrock.com') || l.toLowerCase().includes('auditor') || l.toLowerCase().includes('foi'));
    if (tokens.length === 0) return hasMuckRockOrFoia || r.links.length > 0;
    const hay = `${r.agency} ${r.city} ${r.county}`.toLowerCase();
    return tokens.some((tok) => hay.includes(tok));
  });

  const pool = matched.length > 0 ? matched : records.filter((r) => r.links.some((l) => l.toLowerCase().includes('muckrock')));
  const sources: WebSource[] = [];
  const seenUris = new Set<string>();

  for (const row of pool) {
    if (sources.length >= 3) break;
    const muckRockOrDoc =
      row.links.find((l) => l.toLowerCase().includes('muckrock.com')) || row.links[0];
    if (!muckRockOrDoc || seenUris.has(muckRockOrDoc)) continue;
    seenUris.add(muckRockOrDoc);

    sources.push({
      title: `Public Records / FOIA Filing: ${row.agency} (${[row.city, row.state].filter(Boolean).join(', ')})`,
      uri: muckRockOrDoc,
      snippet: row.summary || `Public records documentation and vendor disclosures for ${row.agency}.`,
    });
  }

  return sources;
}

async function queryWikipediaSearch(searchQuery: string): Promise<WebSource[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    searchQuery
  )}&srlimit=3&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VigilALPROSINT/1.0 (https://vigilalpr.local; contact@vigilalpr.local)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];

  const payload = (await res.json().catch(() => null)) as {
    query?: {
      search?: Array<{ title?: string; snippet?: string }>;
    };
  } | null;

  const hits = payload?.query?.search || [];
  const items: WebSource[] = [];

  for (const hit of hits) {
    if (hit.title) {
      const slug = encodeURIComponent(hit.title.replace(/\s+/g, '_'));
      items.push({
        title: `Wikipedia: ${hit.title}`,
        uri: `https://en.wikipedia.org/wiki/${slug}`,
        snippet: hit.snippet ? decodeHtmlEntities(hit.snippet) : undefined,
      });
    }
  }
  return items;
}

type FallbackDomainKind = 'phone' | 'alpr' | 'foia';

async function runPublicWebFallback(options: {
  kind: FallbackDomainKind;
  queries: string[];
  topicHeading: string;
  fallbackReason: string;
  phoneDigits?: string;
  stateCode?: string;
  cityOrAgency?: string;
}): Promise<WebLookupPayload> {
  const collected: WebSource[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];

  const addSources = (list: WebSource[]) => {
    for (const item of list) {
      if (!seen.has(item.uri)) {
        seen.add(item.uri);
        collected.push(item);
      }
    }
  };

  if (options.kind === 'phone') {
    const parsedPhone = options.phoneDigits ? parsePhoneInputServer(options.phoneDigits) : null;
    const isNanpValid = parsedPhone && !('error' in parsedPhone) && parsedPhone.isNanp;

    if (isNanpValid) {
      const [fccRes, lergRes, ownerRes] = await Promise.allSettled([
        queryFccPhoneComplaints(parsedPhone.digits),
        NANPA_TOLL_FREE_NPAS.has(parsedPhone.npa)
          ? Promise.resolve(null)
          : queryLocalCallingGuide(parsedPhone.npa, parsedPhone.nxx, parsedPhone.thousandBlock),
        resolvePhoneOwnerInfo(parsedPhone),
      ]);

      if (ownerRes.status === 'fulfilled' && ownerRes.value) {
        const owner = ownerRes.value;
        addSources([
          {
            title: `${owner.sourceLabel}: ${owner.ownerName}`,
            uri: owner.sourceUrl || 'https://www.sec.gov/edgar/searchedgar/companysearch',
            snippet: [owner.streetAddress, owner.cityStateZip].filter(Boolean).join(', ') || `Registered entity: ${owner.ownerName}`,
          },
        ]);
      }

      if (fccRes.status === 'fulfilled') addSources(fccRes.value);
      else errors.push(fccRes.reason instanceof Error ? fccRes.reason.message : String(fccRes.reason));

      if (lergRes.status === 'fulfilled' && lergRes.value) {
        const lerg = lergRes.value;
        addSources([
          {
            title: `LERG / NANPA Carrier Prefix (${lerg.npa}-${lerg.nxx}): ${lerg.companyName}`,
            uri: `https://localcallingguide.com/lca_prefix.php?npa=${lerg.npa}&nxx=${lerg.nxx}`,
            snippet: `Rate Center: ${lerg.rateCenter}, ${lerg.region} · Switch: ${lerg.switchClli || 'N/A'} · OCN: ${lerg.ocn || 'N/A'} · ILEC: ${lerg.ilecName || 'N/A'}.`,
          },
        ]);
      }
    }

    const areaQuery = isNanpValid ? `Area code ${parsedPhone.npa}` : options.queries[0] || '';
    const areaDigits3 = isNanpValid ? parsedPhone.npa : '';
    const isPhoneRelated = (item: WebSource) => {
      const lower = `${item.title} ${item.snippet || ''} ${item.uri}`.toLowerCase();
      return (
        lower.includes('area code') ||
        lower.includes('telephone') ||
        lower.includes('toll-free') ||
        lower.includes('robocall') ||
        lower.includes('spam') ||
        lower.includes('caller') ||
        (areaDigits3.length === 3 && lower.includes(areaDigits3))
      );
    };

    const [bingRes, wikiRes] = await Promise.allSettled([
      isNanpValid && areaQuery ? queryBingRssSearch(areaQuery) : Promise.resolve([]),
      areaQuery ? queryWikipediaSearch(areaQuery) : Promise.resolve([]),
    ]);

    if (bingRes.status === 'fulfilled') addSources(bingRes.value.filter(isPhoneRelated));
    else errors.push(bingRes.reason instanceof Error ? bingRes.reason.message : String(bingRes.reason));

    if (wikiRes.status === 'fulfilled') {
      addSources(wikiRes.value.filter(isPhoneRelated));
    }

    if (isNanpValid) {
      addSources([
        {
          title: `NANPA North American Numbering Plan — Area Code ${parsedPhone.npa} Directory`,
          uri: 'https://www.nationalnanpa.com/area_codes/',
          snippet: `Official North American Numbering Plan Administrator registry for NPA-${parsedPhone.npa} geographic and carrier assignments.`,
        },
      ]);
    } else if (parsedPhone && !('error' in parsedPhone)) {
      addSources([
        {
          title: `ITU E.164 International Numbering Plan (${parsedPhone.countryName} +${parsedPhone.countryDialCode})`,
          uri: 'https://www.itu.int/oth/T0202.aspx?parent=T0202',
          snippet: `International country calling code +${parsedPhone.countryDialCode} (${parsedPhone.countryName}).`,
        },
      ]);
    }

    if (collected.length < 3 && areaQuery) {
      const instant = await queryDuckDuckGoInstantAnswer(areaQuery).catch(() => []);
      addSources(instant.filter(isPhoneRelated));
    }
  } else if (options.kind === 'alpr') {
    const cleanState = (options.stateCode || 'CA').toUpperCase();
    const stateInfo = US_STATE_NAMES[cleanState];
    const [atlasRes, wikiRes] = await Promise.allSettled([
      queryAtlasOfSurveillanceAlpr(cleanState, options.cityOrAgency),
      queryWikipediaSearch(
        stateInfo
          ? `${stateInfo.foiaLaw}`
          : 'Automatic number-plate recognition'
      ),
    ]);

    if (atlasRes.status === 'fulfilled') addSources(atlasRes.value);
    else errors.push(atlasRes.reason instanceof Error ? atlasRes.reason.message : String(atlasRes.reason));

    if (wikiRes.status === 'fulfilled') {
      const statuteHit = wikiRes.value.filter((item) => {
        const lower = `${item.title} ${item.snippet || ''}`.toLowerCase();
        return (
          lower.includes('records') ||
          lower.includes('freedom of information') ||
          lower.includes('sunshine') ||
          lower.includes('license plate') ||
          lower.includes('plate recognition')
        );
      });
      addSources(statuteHit.slice(0, 1));
    }
  } else {
    const cleanState = (options.stateCode || '').toUpperCase();
    const stateInfo = cleanState ? US_STATE_NAMES[cleanState] : undefined;
    const agencyTarget = (options.cityOrAgency || '').trim();

    const [atlasFoiaRes, wikiAgencyRes] = await Promise.allSettled([
      queryAtlasOfSurveillanceFoia(agencyTarget || stateInfo?.name || cleanState, cleanState),
      queryWikipediaSearch(
        stateInfo?.foiaLaw || `${agencyTarget} ${cleanState} police`
      ),
    ]);

    if (atlasFoiaRes.status === 'fulfilled') addSources(atlasFoiaRes.value);
    else errors.push(atlasFoiaRes.reason instanceof Error ? atlasFoiaRes.reason.message : String(atlasFoiaRes.reason));

    if (wikiAgencyRes.status === 'fulfilled') {
      const statuteHits = wikiAgencyRes.value.filter((item) => {
        const lower = `${item.title} ${item.snippet || ''}`.toLowerCase();
        return (
          lower.includes('records') ||
          lower.includes('freedom of information') ||
          lower.includes('sunshine') ||
          lower.includes('public information') ||
          lower.includes('right-to-know')
        );
      });
      addSources(statuteHits.slice(0, 1));
    }

    addSources([
      {
        title: `NFOIC State Freedom of Information Directory (${stateInfo?.name || cleanState || 'US'})`,
        uri: 'https://www.nfoic.org/state-freedom-of-information-laws/',
        snippet: `National Freedom of Information Coalition guide to ${stateInfo?.foiaLaw || 'state open records laws'} and statutory response timelines.`,
      },
      {
        title: 'U.S. FOIA.gov Agency Public Records Directory',
        uri: 'https://www.foia.gov/',
        snippet: 'Official federal Freedom of Information Act portal and public records filing guidelines.',
      },
    ]);
  }

  if (collected.length === 0) {
    throw new Error(
      `Unable to reach Gemini Search or public web endpoints (${errors[0] || options.fallbackReason}). Check internet connectivity and retry.`
    );
  }

  const topSnippets = collected
    .slice(0, 5)
    .map((src, idx) => {
      const snippetPart = src.snippet ? ` — ${src.snippet}` : '';
      return `${idx + 1}. ${src.title}${snippetPart}`;
    })
    .join('\n');

  const summary = [
    `${options.topicHeading} (Live Public Web & Open Registry Results)`,
    '',
    topSnippets,
    '',
    'Review the verified external links below to inspect full public complaint records, EFF Atlas ALPR deployments, or open-records resources.',
  ].join('\n');

  return {
    summary,
    sources: collected.slice(0, 6).map(({ title, uri }) => ({ title, uri })),
    searchQueries: options.queries,
    searchMode: 'public_web_fallback',
    notice: `${options.fallbackReason} Returned live results via Public Web & Open Data fallback.`,
  };
}

async function executeGroundedLookupWithFallback(options: {
  geminiPrompt: string;
  fallbackKind: FallbackDomainKind;
  fallbackQueries: string[];
  topicHeading: string;
  phoneDigits?: string;
  stateCode?: string;
  cityOrAgency?: string;
}): Promise<WebLookupPayload> {
  if (isGeminiConfigured()) {
    if (Date.now() < geminiCooldownUntil) {
      return runPublicWebFallback({
        kind: options.fallbackKind,
        queries: options.fallbackQueries,
        topicHeading: options.topicHeading,
        fallbackReason: lastGeminiCooldownReason || 'Gemini Search quota or rate limit reached (429).',
        phoneDigits: options.phoneDigits,
        stateCode: options.stateCode,
        cityOrAgency: options.cityOrAgency,
      });
    }

    try {
      const gemini = await runGeminiGroundedSearch(options.geminiPrompt);
      return {
        ...gemini,
        searchMode: 'gemini_grounding',
      };
    } catch (err) {
      const parsed = formatApiError(err);
      return runPublicWebFallback({
        kind: options.fallbackKind,
        queries: options.fallbackQueries,
        topicHeading: options.topicHeading,
        fallbackReason: parsed.message,
        phoneDigits: options.phoneDigits,
        stateCode: options.stateCode,
        cityOrAgency: options.cityOrAgency,
      });
    }
  }

  return runPublicWebFallback({
    kind: options.fallbackKind,
    queries: options.fallbackQueries,
    topicHeading: options.topicHeading,
    fallbackReason: 'GEMINI_API_KEY is not configured.',
    phoneDigits: options.phoneDigits,
    stateCode: options.stateCode,
    cityOrAgency: options.cityOrAgency,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health & runtime readiness check
  app.get('/api/health', (_req, res) => {
    const access = getConfiguredAccessSecret();
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      geminiConfigured: isGeminiConfigured(),
      mapsConfigured: Boolean(getMapsApiKey()),
      accessSecretConfigured: access.customSecretConfigured,
    });
  });

  // Google Maps JavaScript API browser configuration (reads server runtime env if VITE_ var wasn't bundled)
  app.get('/api/maps/config', (_req, res) => {
    const apiKey = getMapsApiKey();
    res.json({
      configured: Boolean(apiKey),
      apiKey: apiKey || null,
    });
  });

  // Access passcode secret status (never returns the actual secret)
  app.get('/api/access/status', (_req, res) => {
    const { customSecretConfigured } = getConfiguredAccessSecret();
    res.json({
      customSecretConfigured,
      demoPasscode: customSecretConfigured ? null : DEFAULT_DEMO_PASSCODE,
    });
  });

  // Verify access passcode against OSINT_ACCESS_SECRET (or demo passcode if unset)
  app.post('/api/access/verify', (req, res) => {
    const { passcode } = (req.body || {}) as { passcode?: unknown };
    if (typeof passcode !== 'string' || !passcode.trim()) {
      res.status(400).json({ unlocked: false, error: 'Enter an access passcode.' });
      return;
    }

    const { secret, customSecretConfigured } = getConfiguredAccessSecret();
    const matched = verifyPasscodeTimingSafe(passcode.trim(), secret);
    if (!matched) {
      res.status(401).json({
        unlocked: false,
        error: 'Incorrect access passcode. Verify your OSINT access secret and try again.',
      });
      return;
    }

    res.json({
      unlocked: true,
      mode: customSecretConfigured ? 'secret' : 'demo',
    });
  });

  // Authoritative Reverse Phone Trace using live LERG prefix data + FCC Unwanted Calls Registry
  app.post('/api/phone-trace', async (req, res) => {
    try {
      const { phoneNumber } = (req.body || {}) as { phoneNumber?: string };
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        res.status(400).json({ error: 'Enter a valid phone number.' });
        return;
      }

      const parsed = parsePhoneInputServer(phoneNumber);
      if ('error' in parsed) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      // Return curated case-study briefing for the 4 fixed preset numbers (geocoded when street address exists)
      if (parsed.isNanp && CURATED_CASE_STUDY_PHONES[parsed.digits]) {
        const baseCurated = structuredClone(CURATED_CASE_STUDY_PHONES[parsed.digits]) as {
          location: {
            city: string;
            state: string;
            postalCode: string;
            timeZone: string;
            rateCenter: string;
            coordinates: [number, number];
            rateCenterCoordinates?: [number, number];
            geocodeAccuracy?: 'rooftop_address' | 'approximate_address' | 'rate_center';
            formattedAddress?: string;
            geocodeQuotaExceeded?: boolean;
          };
          ownerSummary?: {
            streetAddress?: string;
            cityStateZip?: string;
          };
        };

        const streetQuery = [
          baseCurated.ownerSummary?.streetAddress,
          baseCurated.ownerSummary?.cityStateZip,
        ]
          .filter(Boolean)
          .join(', ');

        if (streetQuery) {
          const geo = await geocodeAddressServer(streetQuery);
          baseCurated.location.rateCenterCoordinates = baseCurated.location.coordinates;
          if (geo.coordinates) {
            baseCurated.location.coordinates = geo.coordinates;
            baseCurated.location.formattedAddress = geo.formattedAddress;
            baseCurated.location.geocodeAccuracy = geo.accuracy || 'rooftop_address';
          } else {
            baseCurated.location.geocodeAccuracy = 'approximate_address';
          }
          if (geo.quotaExceeded) {
            baseCurated.location.geocodeQuotaExceeded = true;
          }
        }

        res.json(baseCurated);
        return;
      }

      if (!parsed.isNanp) {
        const intlMeta = INTL_COUNTRY_PREFIXES.find((p) => p.dial === parsed.countryDialCode);
        const owner = await resolvePhoneOwnerInfo(parsed).catch(() => null);
        const hasBrokerKeys = Boolean(
          (process.env.TRESTLE_API_KEY || '').trim() ||
            ((process.env.TWILIO_ACCOUNT_SID || '').trim() && (process.env.TWILIO_AUTH_TOKEN || '').trim())
        );

        const fallbackIntlCoords: [number, number] = intlMeta?.coords || [20, 0];
        let intlCoords: [number, number] = owner?.coordinates || fallbackIntlCoords;
        let intlFormattedAddress: string | undefined;
        let intlAccuracy: 'rooftop_address' | 'approximate_address' | 'rate_center' =
          owner?.coordinates ? 'rooftop_address' : 'rate_center';
        let intlQuotaExceeded = false;

        if (owner?.streetAddress && !owner?.coordinates) {
          const streetQuery = [owner.streetAddress, owner.cityStateZip].filter(Boolean).join(', ');
          const geo = await geocodeAddressServer(streetQuery);
          if (geo.coordinates) {
            intlCoords = geo.coordinates;
            intlFormattedAddress = geo.formattedAddress;
            intlAccuracy = geo.accuracy || 'rooftop_address';
          }
          if (geo.quotaExceeded) {
            intlQuotaExceeded = true;
          }
        }

        res.json({
          phoneNumber: parsed.e164,
          formattedNational: parsed.formattedNational,
          formattedInternational: parsed.formattedInternational,
          countryCode: parsed.countryIso,
          countryName: parsed.countryName,
          carrier: {
            name: owner?.carrierOverride?.name || `${parsed.countryName} International E.164 Gateway (+${parsed.countryDialCode})`,
            type: 'Landline ILEC',
            networkCode: `INTL-${parsed.countryIso}-${parsed.countryDialCode}`,
            originalNetwork: `${parsed.countryName} National Carrier Block`,
            isPorted: false,
          },
          lineType: owner?.carrierOverride?.lineType || 'Mobile',
          riskAnalysis: {
            spamScore: 10,
            riskLevel: 'Low',
            primaryFlag: 'International E.164 Number (No US FCC Robocall Reports)',
            totalReports: 0,
            activityCategory: owner?.ownerType === 'Corporate' ? 'Commercial Business' : 'Nominal Consumer',
            lastActiveDate: new Date().toISOString(),
          },
          location: {
            city: owner?.city || (intlMeta ? `${intlMeta.name} Gateway` : 'International Gateway'),
            state: owner?.state || parsed.countryIso,
            postalCode: owner?.postalCode || 'INTL',
            timeZone: intlMeta?.tz || 'UTC (International)',
            rateCenter: `E164-CC-${parsed.countryDialCode}`,
            coordinates: intlCoords,
            rateCenterCoordinates: fallbackIntlCoords,
            geocodeAccuracy: intlAccuracy,
            ...(intlFormattedAddress ? { formattedAddress: intlFormattedAddress } : {}),
            ...(intlQuotaExceeded ? { geocodeQuotaExceeded: true } : {}),
          },
          ownerSummary: owner
            ? {
                status: owner.status,
                ownerName: owner.ownerName,
                ownerType: owner.ownerType,
                streetAddress: owner.streetAddress,
                cityStateZip: owner.cityStateZip,
                sourceLabel: owner.sourceLabel,
                sourceUrl: owner.sourceUrl,
              }
            : {
                status: 'cpni_protected',
                ownerName: 'Unlisted International Subscriber',
                ownerType: 'Unlisted',
                sourceLabel: 'ITU-T E.164 International Registry',
                note: hasBrokerKeys
                  ? 'No subscriber record matched this international E.164 number.'
                  : 'Private international subscriber names & home addresses are protected under GDPR/regional privacy laws unless matched in public Wikidata filings or a licensed reverse-ID API (TRESTLE_API_KEY).',
              },
          dossier: {
            subscriberName: owner?.ownerName || 'Unlisted International Subscriber (GDPR / Regional Privacy)',
            subscriberType:
              owner?.ownerType === 'Individual'
                ? 'Individual'
                : owner?.ownerType
                ? 'Corporate'
                : 'Undisclosed / Prepaid',
            addressHistory:
              owner?.addressHistory && owner.addressHistory.length > 0
                ? owner.addressHistory
                : [
                    {
                      street: `Country Calling Code +${parsed.countryDialCode} Allocation`,
                      cityState: parsed.countryName,
                      years: 'Active E.164 Range',
                      isCurrent: true,
                    },
                  ],
            associatedEmails: owner?.emails || [],
            breachExposures: [],
            digitalFootprint: [
              ...(owner?.digitalFootprint || []),
              {
                platform: 'ITU-T E.164 Country Registry',
                profileHandle: `${parsed.e164} (${parsed.countryName})`,
                verified: true,
              },
            ],
            altPhoneNumbers: owner?.altPhones || [],
          },
        });
        return;
      }

      const isTollFree = NANPA_TOLL_FREE_NPAS.has(parsed.npa);
      const isFictional555 = parsed.nxx === '555';

      const [lergRes, fccRes, ownerRes] = await Promise.allSettled([
        isTollFree || isFictional555
          ? Promise.resolve(null)
          : queryLocalCallingGuide(parsed.npa, parsed.nxx, parsed.thousandBlock),
        queryFccExactRows(parsed.npa, parsed.nxx, parsed.line),
        isFictional555 ? Promise.resolve(null) : resolvePhoneOwnerInfo(parsed),
      ]);

      const lerg = lergRes.status === 'fulfilled' ? lergRes.value : null;
      const fccRows = fccRes.status === 'fulfilled' ? fccRes.value : [];
      const owner = ownerRes.status === 'fulfilled' ? ownerRes.value : null;
      const fccCount = fccRows.length;
      const latestFcc = fccRows[0];

      // Determine serving carrier & line classification from live LERG prefix data (and CNAM provider override if present)
      let carrierName = owner?.carrierOverride?.name || `NPA-${parsed.npa} Exchange Carrier`;
      let carrierType: 'Tier-1 Wireless' | 'Regional Mobile' | 'VoIP / Cloud PBX' | 'Landline ILEC' | 'Toll-Free CLEC' = 'Landline ILEC';
      let lineType: 'Mobile' | 'Landline' | 'VoIP' | 'Toll-Free' | 'Virtual / Burner' =
        owner?.carrierOverride?.lineType || 'Landline';
      let networkCode = `US-NPA-${parsed.npa}`;
      let originalNetwork = 'NANPA Numbering Allocation';
      let isPorted = false;

      if (isTollFree) {
        carrierName = owner?.carrierOverride?.name || `NANP Toll-Free Service (${parsed.npa} RespOrg Routing)`;
        carrierType = 'Toll-Free CLEC';
        lineType = 'Toll-Free';
        networkCode = `US-TF-${parsed.npa}`;
        originalNetwork = `Somos Toll-Free Registry (${parsed.npa})`;
      } else if (isFictional555) {
        carrierName = 'NANPA Reserved 555 Exchange (Non-Routable / Directory)';
        carrierType = 'Landline ILEC';
        lineType = 'Landline';
        networkCode = `US-RES-555`;
        originalNetwork = 'NANPA Special Service Block';
      } else if (lerg && lerg.companyName) {
        const classified = classifyLergCarrier(lerg.companyName, lerg.companyTypeCode);
        carrierName = owner?.carrierOverride?.name || lerg.companyName;
        carrierType = classified.carrierType;
        lineType = owner?.carrierOverride?.lineType || classified.lineType;
        networkCode = lerg.ocn ? `OCN-${lerg.ocn}` : `US-NPA-${parsed.npa}`;
        originalNetwork = lerg.ilecName || lerg.companyName;
        isPorted = Boolean(
          lerg.ilecName &&
            lerg.companyName &&
            lerg.ilecName.toUpperCase() !== lerg.companyName.toUpperCase()
        );
      }

      // Compute evidence-based risk score from live FCC Unwanted Calls reports + line characteristics
      let spamScore = 8;
      if (fccCount > 0) {
        spamScore = Math.min(96, 48 + fccCount * 6);
      } else if (lineType === 'VoIP') {
        spamScore = 38;
      } else if (isTollFree) {
        spamScore = 24;
      } else if (isFictional555 || !lerg) {
        spamScore = 15;
      }

      const riskLevel =
        spamScore >= 75 ? 'Severe' : spamScore >= 60 ? 'High' : spamScore >= 35 ? 'Moderate' : 'Low';

      const primaryFlag =
        fccCount > 0
          ? `${fccCount}${fccCount === 25 ? '+' : ''} FCC Consumer Unwanted-Call Report(s) (${
              latestFcc?.type_of_call_or_messge || latestFcc?.method || 'Unwanted Call'
            })`
          : isFictional555
          ? 'Reserved 555 Informational / Non-Subscriber Prefix'
          : owner?.ownerName
          ? `Registered to ${owner.ownerName} (${owner.sourceLabel})`
          : isTollFree
          ? 'Toll-Free Commercial / Support Routing (0 Exact FCC Complaints)'
          : lerg
          ? `Active ${lineType} Prefix Assignment · 0 Exact FCC Complaints`
          : `Unverified Exchange (${parsed.npa}-${parsed.nxx}) · No Active Prefix Match`;

      const activityCategory =
        fccCount >= 3
          ? latestFcc?.type_of_call_or_messge?.toLowerCase().includes('prerecorded')
            ? 'Telemarketing Robot'
            : 'Phishing / Impersonation'
          : isTollFree || owner?.ownerType === 'Corporate' || owner?.ownerType === 'Government / Public'
          ? 'Commercial Business'
          : 'Nominal Consumer';

      const regionCode = owner?.state || lerg?.region || 'US';
      const city =
        owner?.city ||
        (isTollFree
          ? 'National Toll-Free Routing'
          : lerg?.rateCenter || `NPA-${parsed.npa} Exchange`);
      const timeZone = isTollFree
        ? 'Multi-Region (US/CAN)'
        : REGION_TIMEZONES[regionCode] || 'America/New_York (EST)';
      const rateCenterCoordinates: [number, number] =
        lerg?.lat !== null && lerg?.lat !== undefined && lerg?.lon !== null && lerg?.lon !== undefined
          ? [Number(lerg.lat.toFixed(4)), Number(lerg.lon.toFixed(4))]
          : [39.8283, -98.5795];

      let coordinates: [number, number] = owner?.coordinates || rateCenterCoordinates;
      let formattedAddress: string | undefined;
      let geocodeAccuracy: 'rooftop_address' | 'approximate_address' | 'rate_center' =
        owner?.coordinates ? 'rooftop_address' : 'rate_center';
      let geocodeQuotaExceeded = false;

      if (owner?.streetAddress && !owner?.coordinates) {
        const streetQuery = [
          owner.streetAddress,
          owner.cityStateZip || (lerg?.rateCenter && regionCode !== 'US' ? `${lerg.rateCenter}, ${regionCode}` : ''),
        ]
          .filter(Boolean)
          .join(', ');
        const geo = await geocodeAddressServer(streetQuery);
        if (geo.coordinates) {
          coordinates = geo.coordinates;
          formattedAddress = geo.formattedAddress;
          geocodeAccuracy = geo.accuracy || 'rooftop_address';
        }
        if (geo.quotaExceeded) {
          geocodeQuotaExceeded = true;
        }
      }

      const hasCommercialOwnerKeys = Boolean(
        (process.env.TRESTLE_API_KEY || '').trim() ||
          ((process.env.TWILIO_ACCOUNT_SID || '').trim() && (process.env.TWILIO_AUTH_TOKEN || '').trim())
      );

      const ownerSummary = isFictional555
        ? {
            status: 'reserved_block' as const,
            ownerName: 'Reserved 555 Prefix (No Registered Subscriber)',
            ownerType: 'Unlisted' as const,
            sourceLabel: 'NANPA Special Service Block',
            note: 'NANPA 555-01xx numbers are reserved for directory/fictional use and have no registered owner or physical address.',
          }
        : owner
        ? {
            status: owner.status,
            ownerName: owner.ownerName,
            ownerType: owner.ownerType,
            streetAddress: owner.streetAddress,
            cityStateZip: owner.cityStateZip,
            sourceLabel: owner.sourceLabel,
            sourceUrl: owner.sourceUrl,
            note:
              owner.status === 'cnam_only'
                ? 'Carrier CNAM returned the registered caller name. Street-level billing address requires a licensed reverse-address broker key (TRESTLE_API_KEY).'
                : undefined,
          }
        : {
            status: 'cpni_protected' as const,
            ownerName: 'Private / Unlisted Subscriber (CPNI Protected)',
            ownerType: 'Unlisted' as const,
            cityStateZip: `${city}, ${regionCode}`,
            sourceLabel: 'NANPA / LERG Rate Center Geography',
            note: hasCommercialOwnerKeys
              ? 'No public corporate filing or commercial CNAM/address match was found for this number.'
              : 'No public corporate/SEC/Wikidata filing matched this number. Federal carrier privacy rules (47 U.S.C. § 222 CPNI) restrict personal names and home street addresses unless a licensed reverse-owner API (TRESTLE_API_KEY or TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) is configured in Settings > Secrets.',
          };

      const subscriberName = ownerSummary.ownerName;

      res.json({
        phoneNumber: parsed.e164,
        formattedNational: parsed.formattedNational,
        formattedInternational: parsed.formattedInternational,
        countryCode: 'US',
        countryName:
          regionCode === 'ON' || regionCode === 'BC' || regionCode === 'QC' || regionCode === 'AB'
            ? 'Canada (NANP)'
            : 'United States',
        carrier: {
          name: carrierName,
          type: carrierType,
          networkCode,
          originalNetwork,
          isPorted,
        },
        lineType,
        riskAnalysis: {
          spamScore,
          riskLevel,
          primaryFlag,
          totalReports: fccCount,
          activityCategory,
          lastActiveDate: latestFcc?.date_created
            ? new Date(latestFcc.date_created).toISOString()
            : new Date().toISOString(),
        },
        location: {
          city,
          state: regionCode,
          postalCode: owner?.postalCode || (isTollFree ? '00000' : `NPA-${parsed.npa}`),
          timeZone,
          rateCenter: lerg?.switchClli || (isTollFree ? `TOLLFREE-${parsed.npa}` : `NPA-${parsed.npa}-${parsed.nxx}`),
          coordinates,
          rateCenterCoordinates,
          geocodeAccuracy,
          ...(formattedAddress ? { formattedAddress } : {}),
          ...(geocodeQuotaExceeded ? { geocodeQuotaExceeded: true } : {}),
        },
        ownerSummary,
        dossier: {
          subscriberName,
          subscriberType:
            owner?.ownerType === 'Individual'
              ? 'Individual'
              : owner?.ownerType === 'Corporate' ||
                owner?.ownerType === 'Government / Public' ||
                isTollFree ||
                lineType === 'VoIP'
              ? 'Corporate'
              : 'Undisclosed / Prepaid',
          addressHistory:
            owner?.addressHistory && owner.addressHistory.length > 0
              ? owner.addressHistory
              : [
                  {
                    street: lerg?.rateCenter
                      ? `Rate Center Area: ${lerg.rateCenter}${lerg.lata ? ` (LATA ${lerg.lata})` : ''}`
                      : `Numbering Plan Area ${parsed.npa}-${parsed.nxx}`,
                    cityState: `${city}, ${regionCode}`,
                    years: lerg?.updatedAt ? `LERG Updated ${lerg.updatedAt.slice(0, 10)}` : 'Active NANP Allocation',
                    isCurrent: true,
                  },
                ],
          associatedEmails: owner?.emails || [],
          breachExposures: [],
          digitalFootprint: [
            ...(owner?.digitalFootprint || []),
            {
              platform: 'LERG / NANPA Prefix Registry',
              profileHandle: lerg
                ? `OCN ${lerg.ocn || 'N/A'} · Switch ${lerg.switchClli || 'N/A'}`
                : `${parsed.npa}-${parsed.nxx}-xxxx (${isTollFree ? 'Toll-Free' : 'Unassigned/Private'})`,
              verified: Boolean(lerg),
            },
            {
              platform: 'FCC Unwanted Calls Dataset (sr6c-syda)',
              profileHandle: `${fccCount} exact consumer complaint match(es)`,
              verified: true,
            },
          ],
          altPhoneNumbers: owner?.altPhones || [],
        },
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to complete reverse phone trace.',
      });
    }
  });

  // Live Web OSINT Lookup for Phone Numbers via Gemini + Google Search Grounding (with Public Web Fallback)
  app.post('/api/web-lookup/phone', async (req, res) => {
    try {
      const { phoneNumber, formattedNational, carrierName, locationHint } = req.body as {
        phoneNumber?: string;
        formattedNational?: string;
        carrierName?: string;
        locationHint?: string;
      };

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        res.status(400).json({ error: 'A valid phoneNumber is required.' });
        return;
      }

      const displayPhone = formattedNational || phoneNumber;
      const parsed = parsePhoneInputServer(phoneNumber);
      const areaCode = !('error' in parsed) && parsed.isNanp ? parsed.npa : '';

      const prompt = [
        `Search public web directories, caller-ID complaint aggregators, FCC/FTC robocall reports, and business listings for the phone number ${displayPhone} (${phoneNumber}).`,
        carrierName ? `Telecom carrier hint: ${carrierName}.` : '',
        locationHint ? `Area/Rate-center hint: ${locationHint}.` : '',
        'Provide a concise, factual OSINT summary organized into 3 short sections:',
        '1. Public Directory & Business Mentions (whether any business, organization, or public listing matches this exact number or area prefix; explicitly state if no direct public listing was found—never fabricate owner names).',
        '2. Spam, Scam & Complaint Signals (any public spam reports, robocall warnings, or fraud patterns found online).',
        '3. Area Code & Exchange Context (verified geographic area code coverage and common telecom context).',
        'Keep the response factual, crisp, and under 220 words.',
      ]
        .filter(Boolean)
        .join('\n');

      const fallbackQueries = [
        areaCode ? `Area code ${areaCode}` : `${displayPhone} telephone directory`,
        `${displayPhone} phone carrier lookup`,
      ];

      const payload = await executeGroundedLookupWithFallback({
        geminiPrompt: prompt,
        fallbackKind: 'phone',
        fallbackQueries,
        topicHeading: `Public Web OSINT Findings for ${displayPhone}`,
        phoneDigits: !('error' in parsed) ? parsed.e164 : phoneNumber,
      });

      res.json(payload);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to complete live web search.',
      });
    }
  });

  // Live Web ALPR / Flock Safety Jurisdiction & Transparency Lookup
  app.post('/api/web-lookup/alpr', async (req, res) => {
    try {
      const { state, cityOrCounty } = req.body as {
        state?: string;
        cityOrCounty?: string;
      };

      if (!state || typeof state !== 'string') {
        res.status(400).json({ error: 'A state jurisdiction code is required.' });
        return;
      }

      const scope = cityOrCounty?.trim() ? `${cityOrCounty.trim()}, ${state}` : `State of ${state}`;

      const prompt = [
        `Search the web for real public information about Flock Safety ALPR cameras, municipal ALPR transparency portals, and automated license plate reader laws in ${scope}.`,
        'Provide a concise, factual briefing with 3 short sections:',
        '1. Local Flock Safety / ALPR Deployments & Transparency Portals (any known police/city ALPR deployments, public Flock transparency portals, or public records disclosures in this area).',
        '2. Statutory Retention & Privacy Rules (the actual state or local law governing ALPR retention windows, access logs, and data sharing in this state).',
        '3. How Residents Can Verify Camera Queries (practical steps for residents in this jurisdiction to check if an agency queried their plate via official public records requests).',
        'Keep the response factual, accurate to web sources, and under 240 words.',
      ].join('\n');

      const fallbackQueries = [
        `Flock Safety ALPR transparency portal ${scope}`,
        `${state} automated license plate reader ALPR retention law statute`,
      ];

      const payload = await executeGroundedLookupWithFallback({
        geminiPrompt: prompt,
        fallbackKind: 'alpr',
        fallbackQueries,
        topicHeading: `Public ALPR & Flock Transparency Records (${scope})`,
        stateCode: state,
        cityOrAgency: cityOrCounty?.trim(),
      });

      res.json(payload);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to complete live ALPR web search.',
      });
    }
  });

  // Live Web FOIA / Public Records Portal Lookup
  app.post('/api/web-lookup/foia-portal', async (req, res) => {
    try {
      const { agencyOrCity, state } = req.body as {
        agencyOrCity?: string;
        state?: string;
      };

      if (!agencyOrCity || !agencyOrCity.trim()) {
        res.status(400).json({ error: 'Enter a city, county, or police agency name.' });
        return;
      }

      const target = state ? `${agencyOrCity.trim()}, ${state}` : agencyOrCity.trim();

      const prompt = [
        `Find the official public records request (FOIA / Sunshine Law / Open Records) portal, police records custodian email or web form, and governing state statute for: ${target}.`,
        'Summarize clearly in under 180 words:',
        '- Official Portal / Records Unit',
        '- Submission Instructions & Typical Response Timeline',
        '- Applicable State Statute Citation',
      ].join('\n');

      const fallbackQueries = [
        `${target} police public records request FOIA portal`,
        `${state || target} open records statute law`,
      ];

      const payload = await executeGroundedLookupWithFallback({
        geminiPrompt: prompt,
        fallbackKind: 'foia',
        fallbackQueries,
        topicHeading: `Public Records & FOIA Portal Results (${target})`,
        stateCode: state,
        cityOrAgency: agencyOrCity.trim(),
      });

      res.json(payload);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to locate FOIA portal via web search.',
      });
    }
  });

  // Mount Vite middleware in development or serve built dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(import.meta.dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VigilALPR & TraceID server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
