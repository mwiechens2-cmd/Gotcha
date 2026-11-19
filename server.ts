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
        return { summary, sources, searchQueries };
      }
      throw new Error('Gemini returned an empty search response.');
    } catch (err) {
      lastErr = err;
      const parsed = formatApiError(err);
      if (!parsed.retryable || attempt === 1) {
        throw err;
      }
      await sleep(600 * (attempt + 1));
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

    if (uri.startsWith('http') && title && !seen.has(uri)) {
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

async function queryWikipediaSearch(searchQuery: string): Promise<WebSource[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    searchQuery
  )}&srlimit=4&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'VigilALPR-OSINT/1.0' },
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

async function runPublicWebFallback(
  queries: string[],
  topicHeading: string,
  fallbackReason: string
): Promise<WebLookupPayload> {
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

  for (const q of queries) {
    const [bingRes, ddgHtmlRes] = await Promise.allSettled([
      queryBingRssSearch(q),
      queryDuckDuckGoHtml(q),
    ]);

    if (bingRes.status === 'fulfilled') {
      addSources(bingRes.value);
    } else {
      errors.push(bingRes.reason instanceof Error ? bingRes.reason.message : String(bingRes.reason));
    }

    if (ddgHtmlRes.status === 'fulfilled') {
      addSources(ddgHtmlRes.value);
    } else {
      errors.push(
        ddgHtmlRes.reason instanceof Error ? ddgHtmlRes.reason.message : String(ddgHtmlRes.reason)
      );
    }

    if (collected.length < 3) {
      const [instant, wiki] = await Promise.allSettled([
        queryDuckDuckGoInstantAnswer(q),
        queryWikipediaSearch(q),
      ]);
      if (instant.status === 'fulfilled') addSources(instant.value);
      if (wiki.status === 'fulfilled') addSources(wiki.value);
    }

    if (collected.length >= 6) break;
  }

  if (collected.length === 0) {
    throw new Error(
      `Unable to reach Gemini Search or public web endpoints (${errors[0] || fallbackReason}). Check internet connectivity and retry.`
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
    `${topicHeading} (Live Public Web Search Results)`,
    '',
    topSnippets,
    '',
    'Review the verified external web links below to inspect full public directory listings, transparency portals, or records.',
  ].join('\n');

  return {
    summary,
    sources: collected.slice(0, 6).map(({ title, uri }) => ({ title, uri })),
    searchQueries: queries,
    searchMode: 'public_web_fallback',
    notice: `${fallbackReason} Returned live results via Public Web Search fallback.`,
  };
}

async function executeGroundedLookupWithFallback(options: {
  geminiPrompt: string;
  fallbackQueries: string[];
  topicHeading: string;
}): Promise<WebLookupPayload> {
  if (isGeminiConfigured()) {
    try {
      const gemini = await runGeminiGroundedSearch(options.geminiPrompt);
      return {
        ...gemini,
        searchMode: 'gemini_grounding',
      };
    } catch (err) {
      const parsed = formatApiError(err);
      return runPublicWebFallback(
        options.fallbackQueries,
        options.topicHeading,
        parsed.message
      );
    }
  }

  return runPublicWebFallback(
    options.fallbackQueries,
    options.topicHeading,
    'GEMINI_API_KEY is not configured.'
  );
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
      accessSecretConfigured: access.customSecretConfigured,
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
      const areaDigits = phoneNumber.replace(/\D/g, '');
      const areaCode = areaDigits.length >= 10 ? areaDigits.slice(-10, -7) : '';

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
        `"${displayPhone}" phone spam OR directory OR business`,
        areaCode ? `area code ${areaCode} ${locationHint || ''} telecom`.trim() : `${phoneNumber} phone lookup`,
      ];

      const payload = await executeGroundedLookupWithFallback({
        geminiPrompt: prompt,
        fallbackQueries,
        topicHeading: `Public Web OSINT Findings for ${displayPhone}`,
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
        fallbackQueries,
        topicHeading: `Public ALPR & Flock Transparency Records (${scope})`,
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
        fallbackQueries,
        topicHeading: `Public Records & FOIA Portal Results (${target})`,
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
