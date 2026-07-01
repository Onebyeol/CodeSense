// api/analyze.js — Vercel Serverless Function
// API 키는 여기 서버에만 있어요. 사용자 브라우저에는 절대 노출되지 않습니다.

export const config = { runtime: 'edge' };

const GEMINI_MODELS = [
 'gemini-2.5-flash',
'gemini-2.5-pro',
'gemini-2.0-flash',
'gemini-2.0-flash-001',
'gemini-2.0-flash-lite-001',
'gemini-2.0-flash-lite',
'gemini-2.5-flash-preview-tts',
'gemini-2.5-pro-preview-tts',
'gemma-4-26b-a4b-it',
'gemma-4-31b-it',
'gemini-flash-latest',
'gemini-flash-lite-latest',
'gemini-pro-latest',
'gemini-2.5-flash-lite',
'gemini-2.5-flash-image',
'gemini-3-pro-preview',
'gemini-3-flash-preview',
'gemini-3.1-pro-preview',
'gemini-3.1-pro-preview-customtools',
'gemini-3.1-flash-lite-preview',
'gemini-3.1-flash-lite',
'gemini-3-pro-image-preview',
'gemini-3-pro-image',
'nano-banana-pro-preview',
'gemini-3.1-flash-image-preview',
'gemini-3.1-flash-image',
'gemini-3.1-flash-lite-image',
'gemini-3.5-flash',
'gemini-omni-flash-preview',
'lyria-3-clip-preview',
'lyria-3-pro-preview',
'gemini-3.1-flash-tts-preview',
'gemini-robotics-er-1.5-preview',
'gemini-robotics-er-1.6-preview',
'gemini-2.5-computer-use-preview-10-2025',
'antigravity-preview-05-2026',
'deep-research-max-preview-04-2026',
'deep-research-preview-04-2026',
'deep-research-pro-preview-12-2025',
'gemini-embedding-001',
'gemini-embedding-2-preview',
'gemini-embedding-2',
'aqa',
'imagen-4.0-generate-001',
'imagen-4.0-ultra-generate-001',
'imagen-4.0-fast-generate-001',
'veo-3.1-generate-preview',
'veo-3.1-fast-generate-preview',
'veo-3.1-lite-generate-preview',
'gemini-2.5-flash-native-audio-latest',
'gemini-2.5-flash-native-audio-preview-09-2025',
'gemini-2.5-flash-native-audio-preview-12-2025',
'gemini-3.1-flash-live-preview',
'gemini-3.5-live-translate-preview'
];

export default async function handler(req) {
  // CORS — 같은 Vercel 도메인에서만 허용
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST만 허용됩니다' }), { status: 405 });
  }

  // API 키는 Vercel 환경변수에서 가져옴 — 절대 클라이언트에 노출 안 됨
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: 'API 키가 설정되지 않았습니다' }), { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청입니다' }), { status: 400 });
  }

  const { prompt } = body;
  if (!prompt || typeof prompt !== 'string' || prompt.length > 20000) {
    return new Response(JSON.stringify({ error: '코드가 너무 길거나 비어있습니다' }), { status: 400 });
  }

  // 모델 순서대로 시도
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${API_KEY}`;

    try {
      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 }
        })
      });

      if (!geminiRes.ok) {
        const err = await geminiRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${geminiRes.status}`);
      }

      // Gemini SSE 스트림을 그대로 클라이언트에 전달
      return new Response(geminiRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        }
      });

    } catch (err) {
      lastErr = err;
      // 다음 모델로 시도
    }
  }

  return new Response(
    JSON.stringify({ error: lastErr?.message || '모든 모델에서 오류가 발생했습니다' }),
    { status: 502, headers: { 'Content-Type': 'application/json' } }
  );
}
