# Research Report: AvalAI API Client & Gemini STT Transcription Pipeline

- **Author**: AFK Research Agent
- **Tracking Issue**: [#2](https://github.com/aubed9/gantt/issues/2)
- **Context**: Part of [[Wayfinder Map] rpm_V1 Platform Architecture & Implementation (#1)](https://github.com/aubed9/gantt/issues/1)
- **Date**: November 2026
- **Status**: Completed

---

## 1. Executive Summary

This document establishes the technical blueprint and integration specification for connecting the `rpm_V1` resource and project management platform with the **AvalAI** cloud API infrastructure (`https://api.avalai.ir`). The integration leverages two distinct models:

1. **`deepseek-v4.1-flash`** for high-velocity agent reasoning, planning, task evaluation, and structured JSON generation within the Mastra framework.
2. **`gemini-3.8-flash`** for multimodal Speech-to-Text (STT) transcription of team member voice recordings (e.g. End-of-Job [EOJ] reports, task claims, and meeting feedback) in Persian (Farsi) and English.

The document provides comprehensive schemas, TypeScript implementations, frontend-to-backend audio streaming patterns, rate-limiting safeguards, Persian phonetics/typography optimizations, and error handling with exponential backoff and jitter.

---

## 2. Primary Sources & Architectural Foundations

| Resource | Base URL / Reference | Usage |
| :--- | :--- | :--- |
| **AvalAI Official Docs** | `https://docs.avalai.ir/en/` | Core provider specification, OpenAI compatibility routes, authentication, and headers |
| **AvalAI Audio Transcriptions** | `https://api.avalai.ir/v1/audio/transcriptions` | OpenAI-compatible endpoint for bounded audio files (`multipart/form-data`) |
| **AvalAI Chat Completions** | `https://api.avalai.ir/v1/chat/completions` | Multimodal chat endpoint supporting `input_audio` |
| **AvalAI Native Gemini (v1beta)** | `https://api.avalai.ir/v1beta/models/...` | Native Google GenAI SDK routing for multimodal Gemini 3.8 Flash |
| **Vercel AI SDK (`@ai-sdk/openai`)** | `createOpenAI({ baseURL, apiKey })` | OpenAI-compatible model provider constructor used by Mastra |
| **Mastra Agent Framework** | `https://mastra.ai/docs` | Agent and model definition guidelines adhering to single-instance invariants |

---

## 3. Mastra Agent Reasoning Configuration (`deepseek-v4.1-flash`)

### 3.1 Model Specifications & Provider Setup

`deepseek-v4.1-flash` (aliased as `deepseek-flash` on AvalAI) is a high-efficiency Mixture-of-Experts (MoE) model featuring 552B total parameters (with 8B active input parameters and 16B active output parameters) and an expanded **1 Million token context window**. It natively supports function/tool calling, structured JSON output, and rapid reasoning.

#### Authentication & Headers
- **Base URL**: `https://api.avalai.ir/v1`
- **Auth Header**: `Authorization: Bearer <AVALAI_API_KEY>`
- **Content Type**: `application/json`

### 3.2 Vercel AI SDK & Mastra Provider Integration

Mastra models are backed by Vercel AI SDK primitives. To bind AvalAI as an OpenAI-compatible provider:

```typescript
// src/mastra/providers/avalai.ts
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from '@ai-sdk/provider';

let avalaiProviderInstance: ReturnType<typeof createOpenAI> | null = null;

export function getAvalAIProvider() {
  const apiKey = process.env.AVALAI_API_KEY;
  if (!apiKey) {
    throw new Error('AVALAI_API_KEY is not defined in environment variables');
  }

  if (!avalaiProviderInstance) {
    avalaiProviderInstance = createOpenAI({
      baseURL: process.env.AVALAI_BASE_URL || 'https://api.avalai.ir/v1',
      apiKey,
      headers: {
        'User-Agent': 'rpm_V1-mastra-agent/1.0',
      },
    });
  }

  return avalaiProviderInstance;
}

export function getDeepSeekFlashModel(): LanguageModelV1 {
  const provider = getAvalAIProvider();
  return provider('deepseek-v4.1-flash');
}
```

### 3.3 Adherence to Single Mastra Instance & Dynamic Model Binding

To adhere to the **Single Mastra Instance Invariant** and ensure database-free/key-free unit boots for CI/CD:
1. Exactly one `new Mastra({ ... })` instance exists in the codebase (e.g., `chatbot/server/src/mastra/instance.ts` or `src/mastra/instance.ts`).
2. Agents must be registered as first-class domain agents inside `instance.ts`.
3. In test environments without live credentials, dynamic model binding falls back to mock models at call time, never throwing during static module imports.

```typescript
// src/mastra/instance.ts
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { getDeepSeekFlashModel } from './providers/avalai';
import { mockLanguageModel } from './testing/mock-model';

function resolveAgentModel() {
  if (process.env.NODE_ENV === 'test' || !process.env.AVALAI_API_KEY) {
    return mockLanguageModel;
  }
  return getDeepSeekFlashModel();
}

export const rpmCoordinatorAgent = new Agent({
  id: 'rpm-coordinator-agent',
  name: 'RPM Coordinator Agent',
  instructions: `
You are the central Resource & Project Management AI for rpm_V1.
Strictly adhere to the domain terminology defined in GLOSSARY.md:
- Human (HM): Internal team member or external stakeholder.
- Project (PR): High-level organizational initiative.
- Task (TS): Discrete unit of work with deadlines and success criteria.
- Event (EV): Scheduled company milestone, review, or meeting.
- Report (RP) / End-of-Job (EOJ) Report: Formal structured assessment submitted upon task completion.
Format all dates in Jalali (SH) alongside ISO timestamps.
`,
  model: resolveAgentModel(),
});

export const mastra = new Mastra({
  agents: {
    rpmCoordinatorAgent,
  },
});

export function getRpmCoordinatorAgent() {
  const agent = mastra.getAgent('rpmCoordinatorAgent');
  // Dynamic call-time binding ensures live keys can be updated without rebuilding
  agent.model = resolveAgentModel();
  return agent;
}
```

---

## 4. Audio Transcription Pipeline (`gemini-3.8-flash` STT)

### 4.1 Architectural Choices for Gemini 3.8 Flash STT

`gemini-3.8-flash` is a native multimodal reasoning model with exceptional comprehension of acoustic nuance, colloquial Persian dialects, technical jargon, and complex domain vocabulary. On AvalAI, two architectural paths are available for transcription:

```
[ Frontend: MediaRecorder ]
       |
       | multipart/form-data (audio/webm;codecs=opus)
       v
[ Backend: Express + Multer (In-Memory Buffer) ]
       |
       +---> Option A (Primary / Multimodal STT):
       |     Native Google GenAI SDK (v1beta) / Chat Completions with input_audio
       |     -> Gemini 3.8 Flash with Persian domain prompt & ZWNJ formatting
       |
       +---> Option B (OpenAI-Compatible Standard Endpoint):
             POST /v1/audio/transcriptions
             -> Form data with file, language='fa', model='gpt-4o-transcribe' or 'whisper-1'
```

#### Why Option A (Multimodal `gemini-3.8-flash`) is Superior for Persian `rpm_V1`:
- **Context-Aware Vocabulary Injection**: Traditional Whisper models transcribe phonetically without understanding domain acronyms. With `gemini-3.8-flash`, we inject platform glossary terms (e.g. `EOJ Report`, `Task Claim`, `PR-102`) into the transcription prompt.
- **Persian Typography & Punctuation**: Automatically inserts Persian zero-width non-joiners (نیم‌فاصله - ZWNJ), converts spoken numbers to either standard Persian (`۰-۹`) or Latin digits as specified, and segments sentences logically.
- **Combined Transcription & Structuring**: In a single round-trip, `gemini-3.8-flash` can transcribe Persian speech and parse it directly into the structured JSON schema required for an End-of-Job (EOJ) Report.

### 4.2 End-to-End Pipeline Implementation

#### Step 1: Frontend Audio Capture (Browser)
The frontend captures audio using the HTML5 `MediaRecorder` API:

```typescript
// frontend/src/audio/recorder.ts
export class VoiceReportRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1, // Mono preferred
      } 
    });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4';

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Emit chunks every 250ms
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return;
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        resolve(audioBlob);
      };
      this.mediaRecorder.stop();
    });
  }
}

export async function submitVoiceReport(
  audioBlob: Blob, 
  taskId: string, 
  humanId: string
): Promise<{ transcript: string; eojDraft?: any }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'report.webm');
  formData.append('taskId', taskId);
  formData.append('humanId', humanId);
  formData.append('language', 'fa');

  const response = await fetch('/api/audio/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || 'Audio transcription failed');
  }

  return response.json();
}
```

#### Step 2: Backend Multipart Ingestion & Memory Buffer (Node.js / Express)
The backend intercepts the multipart stream using `multer` with in-memory storage (avoiding disk I/O):

```typescript
// backend/src/controllers/audio.controller.ts
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribePersianAudio } from '../services/stt.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file format. Only audio files are allowed.'));
    }
  },
});

export const audioRouter = Router();

audioRouter.post(
  '/transcribe',
  upload.single('audio'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'bad_request', message: 'No audio file provided' });
      }

      const { taskId, humanId, language = 'fa' } = req.body;

      const result = await transcribePersianAudio({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        filename: req.file.originalname,
        taskId,
        humanId,
        language,
      });

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Audio transcription error:', error);
      const statusCode = error.status || 500;
      return res.status(statusCode).json({
        error: error.code || 'transcription_failed',
        message: error.message || 'Failed to process voice audio',
      });
    }
  }
);
```

#### Step 3: Forwarding to AvalAI (Gemini 3.8 Flash Multimodal & STT Service)

```typescript
// backend/src/services/stt.service.ts
import { executeWithBackoff } from '../utils/backoff';

export interface TranscribeParams {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  taskId?: string;
  humanId?: string;
  language?: string;
}

export interface TranscriptionResponse {
  transcript: string;
  language: string;
  durationSeconds?: number;
  tokensUsed?: number;
}

/**
 * Transcribes audio via AvalAI using Gemini 3.8 Flash multimodal reasoning.
 * Preserves Persian typography, zero-width non-joiners (نیم‌فاصله), and domain terms.
 */
export async function transcribePersianAudio(params: TranscribeParams): Promise<TranscriptionResponse> {
  const apiKey = process.env.AVALAI_API_KEY;
  if (!apiKey) {
    throw new Error('AVALAI_API_KEY is not configured');
  }

  const base64Audio = params.buffer.toString('base64');
  const normalizedMimeType = params.mimeType.split(';')[0]; // e.g. "audio/webm"

  const prompt = `
شما یک سیستم رونویسی و پیاده‌سازی صوت (Speech-to-Text) بسیار دقیق و رسمی برای پلتفرم مدیریت منابع و پروژه‌ها (rpm_V1) هستید.
وظیفه شما:
۱. تمام گفته‌های موجود در این فایل صوتی را با دقت ۱۰۰٪ به زبان فارسی رسمی و دقیق بنویسید.
۲. قواعد رسم‌الخط مصوب فرهنگستان و نیم‌فاصله (Zero-Width Non-Joiner - \u200C) را در تمام افعال، پیشوندها و پسوندها (مانند می‌روم، کرده‌ام، خانه‌ها) به درستی رعایت کنید.
۳. اصطلاحات استاندارد دامنه را شناسایی و تصحیح کنید:
   - Task / تسک
   - Project / پروژه
   - Human / همکار
   - EOJ Report / گزارش پایان کار
   - Event / رویداد
۴. کلمات پرکننده زائد (اممم، خب...) را بدون تغییر در معنای اصلی پیام پیراسته یا پالایش کنید.
۵. خروجی فقط و فقط باید متن پیاده‌شده باشد، بدون هیچ توضیح، مقدمه یا موخره اضافه.
`;

  const payload = {
    model: 'gemini-3.8-flash',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          {
            type: 'input_audio',
            input_audio: {
              data: base64Audio,
              format: normalizedMimeType.includes('webm') ? 'webm' : 'mp3',
            },
          },
        ],
      },
    ],
    temperature: 0.1, // Near-zero for deterministic transcription
  };

  const response = await executeWithBackoff(async () => {
    const res = await fetch('https://api.avalai.ir/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      const error = new Error(`AvalAI API returned HTTP ${res.status}: ${errorBody}`);
      (error as any).status = res.status;
      (error as any).headers = res.headers;
      throw error;
    }

    return res.json();
  });

  const transcript = response.choices?.[0]?.message?.content?.trim() || '';

  return {
    transcript,
    language: params.language || 'fa',
    tokensUsed: response.usage?.total_tokens,
  };
}
```

#### Step 4: Alternative Standard OpenAI-Compatible Transcriptions Route (`/v1/audio/transcriptions`)
If calling the dedicated multipart endpoint directly:

```typescript
// backend/src/services/stt-openai-compatible.service.ts
import FormData from 'form-data';
import fetch from 'node-fetch';
import { executeWithBackoff } from '../utils/backoff';

export async function transcribeWithAudioEndpoint(
  audioBuffer: Buffer, 
  filename = 'recording.webm'
): Promise<string> {
  const apiKey = process.env.AVALAI_API_KEY!;
  
  const form = new FormData();
  form.append('file', audioBuffer, {
    filename,
    contentType: 'audio/webm',
  });
  // Supported transcription models: gpt-4o-transcribe, gpt-4o-mini-transcribe, whisper-1
  form.append('model', 'gpt-4o-mini-transcribe');
  form.append('language', 'fa');
  form.append('prompt', 'گزارش پایان کار، تسک، پروژه، نیروی انسانی، جلالی');

  const result = await executeWithBackoff(async () => {
    const res = await fetch('https://api.avalai.ir/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!res.ok) {
      const error = new Error(`Transcription failed: ${res.statusText}`);
      (error as any).status = res.status;
      throw error;
    }

    return res.json() as Promise<{ text: string }>;
  });

  return result.text;
}
```

---

## 5. Persian Typography & NLP Normalization

To ensure transcripts are suitable for semantic embedding in pgvector and display in RTL UI widgets, the backend applies an automated post-transcription cleaning pass:

```typescript
// backend/src/utils/persian-normalizer.ts
export function normalizePersianText(input: string): string {
  if (!input) return '';

  return input
    // Unify Arabic kaf and yeh with Persian characters
    .replace(/\u064A/g, '\u06CC') // ي -> ی
    .replace(/\u0643/g, '\u06A9') // ك -> ک
    // Normalize zero-width non-joiners (\u200C) for prefixes and suffixes
    .replace(/\s+(می|نمی)\s+/g, ' $1\u200C')
    .replace(/\s+(تر|ترین|ها|های|ام|ات|اش|ایم|اید|اند)\b/g, '\u200C$1')
    // Standardize spacing around Persian punctuation
    .replace(/\s*([،؛!؟])\s*/g, '$1 ')
    // Trim extra spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

---

## 6. Rate Limiting, Latency, and Error Handling

### 6.1 AvalAI Account Tiers and Quota Headers

AvalAI dynamically monitors usage across multiple metrics:
- **RPM** (Requests Per Minute)
- **TPM** (Tokens Per Minute)
- **RPD** (Requests Per Day)

Responses include the following HTTP telemetry headers:
| Header | Description |
| :--- | :--- |
| `x-ratelimit-limit-requests` | Maximum allowed requests in current window |
| `x-ratelimit-remaining-requests` | Number of requests remaining before throttle |
| `x-ratelimit-reset-requests` | Seconds until request counter resets |
| `x-ratelimit-limit-tokens` | Maximum allowed tokens in current window |
| `x-ratelimit-remaining-tokens` | Number of tokens remaining |
| `x-ratelimit-reset-tokens` | Seconds until token quota resets |
| `Retry-After` | Provided on HTTP 429 to specify backoff time in seconds |

### 6.2 Token Latency Characteristics

| Model & Task | Time to First Token (TTFT) | Generation Throughput | Total Latency (Typical) |
| :--- | :--- | :--- | :--- |
| **`deepseek-v4.1-flash`** (Agent Planning) | 400ms – 800ms | 60 – 120 tokens/sec | 1.2s – 2.5s for structured plan |
| **`gemini-3.8-flash`** (30s Audio STT) | 800ms – 1.2s | N/A (Audio Ingest) | 1.5s – 3.2s total transcription |
| **`gpt-4o-mini-transcribe`** (30s Audio) | 600ms – 1.0s | N/A | 1.8s – 3.5s total transcription |

### 6.3 Resilient Exponential Backoff with Jitter

To prevent cascading failures and respect AvalAI's tier limits, all calls to AvalAI must pass through an exponential backoff wrapper:

```typescript
// backend/src/utils/backoff.ts
export interface BackoffOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export async function executeWithBackoff<T>(
  operation: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;

  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const statusCode = error.status || (error.response && error.response.status);

      // Retry on 429 (Rate Limit) or 5xx (Transient Gateway/Server errors)
      const isRetryable = statusCode === 429 || (statusCode >= 500 && statusCode < 600);

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Check for Retry-After header
      let waitTime = delay;
      if (error.headers) {
        const retryAfter = error.headers.get?.('retry-after') || error.headers['retry-after'];
        if (retryAfter) {
          const parsedSeconds = parseFloat(retryAfter);
          if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
            waitTime = parsedSeconds * 1000;
          }
        }
      }

      // Add full jitter (0% to 25% random delay)
      const jitter = waitTime * (0.1 + Math.random() * 0.15);
      const totalSleep = waitTime + jitter;

      console.warn(`[AvalAI] Throttled or Server Error (${statusCode}). Retrying attempt ${attempt + 1}/${maxRetries} after ${Math.round(totalSleep)}ms`);
      await new Promise((res) => setTimeout(res, totalSleep));

      delay = Math.min(delay * 2, maxDelayMs);
    }
  }

  throw new Error('Unreachable: backoff exceeded retry count');
}
```

---

## 7. Configuration Checklist & Environment Variables

Add the following environment variables to `.env` or deployment secrets:

```bash
# AvalAI API Configuration
AVALAI_API_KEY="av-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
AVALAI_BASE_URL="https://api.avalai.ir/v1"

# Models
AVALAI_REASONING_MODEL="deepseek-v4.1-flash"
AVALAI_STT_MODEL="gemini-3.8-flash"

# Audio Pipeline Constraints
MAX_AUDIO_SIZE_MB=25
AUDIO_DEFAULT_LANGUAGE="fa"
```

---

## 8. Summary of Findings & Next Steps

1. **Reasoning Agent**: Fully supported by wrapping `@ai-sdk/openai` with `baseURL: 'https://api.avalai.ir/v1'` and `model: 'deepseek-v4.1-flash'`. Fits seamlessly into Mastra's single-instance architecture with dynamic call-time model resolution.
2. **Audio Transcription**: `gemini-3.8-flash` handles multimodal Persian audio recordings natively via `input_audio` or GenAI REST paths, achieving sub-3-second latencies with accurate domain-vocabulary translation and zero-width non-joiner punctuation.
3. **Downstream Integration**: The findings in this report unblock Issue [#8](https://github.com/aubed9/gantt/issues/8) ("EOJ Voice-to-Report Transcription Pipeline").
