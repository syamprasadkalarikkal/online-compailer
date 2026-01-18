import { NextResponse } from 'next/server';

const languageNames = {
  c: 'C',
  cpp: 'C++',
  go: 'Go',
  java: 'Java',
  javascript: 'JavaScript',
  php: 'PHP',
  python: 'Python',
  rust: 'Rust',
  typescript: 'TypeScript'
};

const conversionCache = new Map();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 1000 * 60 * 60;

let requestQueue = [];
const MAX_REQUESTS_PER_MINUTE = 20;

function getCacheKey(code, fromLang, toLang) {
  return `${fromLang}-${toLang}-${code.substring(0, 100)}`;
}

function cleanOldCache() {
  const now = Date.now();
  for (const [key, value] of conversionCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      conversionCache.delete(key);
    }
  }
  
  if (conversionCache.size > MAX_CACHE_SIZE) {
    const firstKey = conversionCache.keys().next().value;
    conversionCache.delete(firstKey);
  }
}

function isRateLimited() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  requestQueue = requestQueue.filter(time => time > oneMinuteAgo);
  
  if (requestQueue.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestRequest = requestQueue[0];
    const waitTime = Math.ceil((oldestRequest + 60000 - now) / 1000);
    return { limited: true, waitTime };
  }
  
  return { limited: false };
}

function addRequestToQueue() {
  requestQueue.push(Date.now());
}

async function callGroqWithRetry(prompt, apiKey, maxRetries = 3) {
  let lastError = null;
  
  const models = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768'
  ];
  
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert code translator. Convert code between programming languages accurately. Output ONLY the converted code without explanations, comments, or markdown formatting.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.2,
              max_tokens: 2000,
              top_p: 0.95
            })
          }
        );

        if (response.status === 429) {
          const waitTime = (attempt + 1) * 3000;
          
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else if (modelIndex < models.length - 1) {
            break;
          }
        }

        if (response.ok) {
          return { response, model };
        }

        const errorData = await response.json().catch(() => ({}));
        lastError = new Error(errorData.error?.message || `HTTP ${response.status}`);
        
        if (response.status >= 400 && modelIndex < models.length - 1) {
          break;
        }
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          const backoffTime = (attempt + 1) * 2000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
  }
  
  throw lastError || new Error('Service temporarily unavailable');
}

export async function POST(request) {
  try {
    const { code, fromLanguage, toLanguage } = await request.json();

    if (!code || !fromLanguage || !toLanguage) {
      return NextResponse.json(
        { error: { message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    cleanOldCache();
    const cacheKey = getCacheKey(code, fromLanguage, toLanguage);
    const cached = conversionCache.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({
        convertedCode: cached.code,
        model: 'Groq (cached)',
        success: true,
        cached: true
      });
    }

    const rateLimitCheck = isRateLimited();
    if (rateLimitCheck.limited) {
      return NextResponse.json(
        { 
          error: { 
            message: `Rate limit exceeded. Please wait ${rateLimitCheck.waitTime} seconds`,
            waitTime: rateLimitCheck.waitTime
          } 
        },
        { status: 429 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'Service temporarily unavailable' } },
        { status: 503 }
      );
    }
    
    addRequestToQueue();

    const prompt = `Convert this ${languageNames[fromLanguage]} code to ${languageNames[toLanguage]}.

RULES:
- Output ONLY the converted ${languageNames[toLanguage]} code
- NO explanations
- NO markdown code blocks
- Start directly with code

Input (${languageNames[fromLanguage]}):
${code}

Output (${languageNames[toLanguage]}):`;

    const { response, model } = await callGroqWithRetry(prompt, apiKey);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: { message: 'Request failed' }
      }));
      
      let message = errorData.error?.message || 'Conversion failed';
      let waitTime = 30;
      
      if (response.status === 429) {
        message = 'Rate limit exceeded. Please try again later.';
        waitTime = 20;
      } else if (response.status === 401) {
        message = 'Service authentication failed';
        waitTime = 0;
      }
      
      return NextResponse.json(
        { error: { message, waitTime } },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    let convertedCode = '';
    
    if (data.choices && data.choices.length > 0) {
      convertedCode = data.choices[0].message?.content || '';
    } else {
      return NextResponse.json(
        { error: { message: 'Invalid response from service' } },
        { status: 500 }
      );
    }

    convertedCode = convertedCode.trim();
    
    if (convertedCode.includes('```')) {
      const match = convertedCode.match(/```[\w]*\n([\s\S]*?)\n```/);
      if (match) {
        convertedCode = match[1].trim();
      } else {
        convertedCode = convertedCode.replace(/```[\w]*/g, '').replace(/```/g, '').trim();
      }
    }
    
    convertedCode = convertedCode
      .replace(/^Here'?s? the converted code:?\s*/i, '')
      .replace(/^Here is the [\w\s]+ code:?\s*/i, '')
      .replace(/^The converted code is:?\s*/i, '')
      .replace(/^Converted code:?\s*/i, '')
      .replace(/^Sure!?\s+/i, '')
      .replace(/^Certainly!?\s+/i, '')
      .replace(/^Output \([\w\s]+\):?\s*/i, '')
      .trim();
    
    const lines = convertedCode.split('\n');
    let codeEndIndex = lines.length;
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('Note:') || 
          line.startsWith('This code') || 
          line.startsWith('The code') ||
          line.match(/^I'?ve converted/i) ||
          line.match(/^Explanation:/i)) {
        codeEndIndex = i;
      } else if (line.length > 0) {
        break;
      }
    }
    
    if (codeEndIndex < lines.length) {
      convertedCode = lines.slice(0, codeEndIndex).join('\n').trim();
    }

    if (!convertedCode) {
      return NextResponse.json(
        { error: { message: 'Conversion resulted in empty code' } },
        { status: 500 }
      );
    }

    conversionCache.set(cacheKey, {
      code: convertedCode,
      timestamp: Date.now()
    });

    return NextResponse.json({
      convertedCode,
      model: model,
      success: true,
      cached: false
    });

  } catch (error) {
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}