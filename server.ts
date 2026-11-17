import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

interface WebSource {
  title: string;
  uri: string;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
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

function formatApiError(err: unknown): { status: number; message: string } {
  const errStatus = (err as { status?: number })?.status;
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (errStatus === 400 || lower.includes('gemini_api_key') || lower.includes('api_key_invalid') || lower.includes('api key')) {
    return {
      status: 400,
      message: 'Gemini API key is missing or invalid. Please check your key in Settings > Secrets.',
    };
  }
  if (errStatus === 403 || lower.includes('permission_denied')) {
    return {
      status: 403,
      message: 'API access denied (403). Please verify your Gemini API key permissions in Settings > Secrets.',
    };
  }
  if (errStatus === 429 || lower.includes('resource_exhausted')) {
    return {
      status: 429,
      message: 'Rate limit or quota reached (429). Please wait a moment or verify your quota in Settings > Secrets.',
    };
  }
  if (errStatus === 404 || lower.includes('not_found')) {
    return {
      status: 404,
      message: `Requested model (${MODEL_NAME}) was not found.`,
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Failed to complete live web search request.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Live Web OSINT Lookup for Phone Numbers via Gemini + Google Search Grounding
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

      const ai = getAiClient();
      const displayPhone = formattedNational || phoneNumber;

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

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const { sources, searchQueries } = extractGrounding(response);
      res.json({
        summary: (response.text || '').trim() || 'No public web matches returned.',
        sources,
        searchQueries,
      });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
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

      const ai = getAiClient();
      const scope = cityOrCounty?.trim() ? `${cityOrCounty.trim()}, ${state}` : `State of ${state}`;

      const prompt = [
        `Search the web for real public information about Flock Safety ALPR cameras, municipal ALPR transparency portals, and automated license plate reader laws in ${scope}.`,
        'Provide a concise, factual briefing with 3 short sections:',
        '1. Local Flock Safety / ALPR Deployments & Transparency Portals (any known police/city ALPR deployments, public Flock transparency portals, or public records disclosures in this area).',
        '2. Statutory Retention & Privacy Rules (the actual state or local law governing ALPR retention windows, access logs, and data sharing in this state).',
        '3. How Residents Can Verify Camera Queries (practical steps for residents in this jurisdiction to check if an agency queried their plate via official public records requests).',
        'Keep the response factual, accurate to web sources, and under 240 words.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const { sources, searchQueries } = extractGrounding(response);
      res.json({
        summary: (response.text || '').trim() || 'No public ALPR records found for this jurisdiction.',
        sources,
        searchQueries,
      });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
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

      const ai = getAiClient();
      const target = state ? `${agencyOrCity.trim()}, ${state}` : agencyOrCity.trim();

      const prompt = [
        `Find the official public records request (FOIA / Sunshine Law / Open Records) portal, police records custodian email or web form, and governing state statute for: ${target}.`,
        'Summarize clearly in under 180 words:',
        '- Official Portal / Records Unit',
        '- Submission Instructions & Typical Response Timeline',
        '- Applicable State Statute Citation',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const { sources, searchQueries } = extractGrounding(response);
      res.json({
        summary: (response.text || '').trim() || 'No public records portal information found.',
        sources,
        searchQueries,
      });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
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
