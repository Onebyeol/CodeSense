// api/analyze.js — Vercel Serverless Function
// API 키는 여기 서버에만 있어요. 사용자 브라우저에는 절대 노출되지 않습니다.

export const config = { runtime: 'edge' };

// Groq 무료 모델 목록 (순서대로 폴백)
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',   // 가장 강력한 무료 모델 (1순위)
  'llama-3.1-8b-instant',      // 빠른 경량 모델 (2순위)
  'gemma2-9b-it',              // Google Gemma 2 (3순위)
];

export default async function handler(req) {
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

  const API_KEY = process.env.GROQ_API_KEY;
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

  let lastErr = null;

  for (const model of GROQ_MODELS) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.3,
          stream: true,
        })
      });

      if (!groqRes.ok) {
        const err = await groqRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${groqRes.status}`);
      }

      // Groq SSE 스트림을 그대로 클라이언트에 전달 (OpenAI 호환 형식)
      return new Response(groqRes.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        }
      });

    } catch (err) {
      lastErr = err;
      // 다음 모델로 폴백
    }
  }

  return new Response(
    JSON.stringify({ error: lastErr?.message || '모든 모델에서 오류가 발생했습니다' }),
    { status: 502, headers: { 'Content-Type': 'application/json' } }
  );
}
