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

async function callGroq(prompt, apiKey) {
  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code fixer. Fix code errors and bugs. Return ONLY a JSON object with {"fixedCode": "the complete fixed code", "explanation": "brief explanation of what was fixed"}'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 3000
      })
    }
  );

  return response;
}

export async function POST(request) {
  try {
    const { code, language, error, line } = await request.json();

    if (!code || !language || !error) {
      return NextResponse.json(
        { error: { message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: { 
            message: 'API key not configured. Get a FREE key from https://console.groq.com' 
          } 
        },
        { status: 500 }
      );
    }

    const prompt = `Fix this ${languageNames[language]} code error:

ERROR: ${error}
${line > 0 ? `LINE: ${line}` : ''}

CODE:
\`\`\`${language}
${code}
\`\`\`

Return a JSON object with:
- fixedCode: the complete corrected code
- explanation: brief explanation of the fix

Preserve all original functionality and code structure.`;

    const response = await callGroq(prompt, apiKey);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: { message: 'Fix failed' }
      }));
      
      return NextResponse.json(
        { error: { message: errorData.error?.message || 'Fix failed' } },
        { status: response.status }
      );
    }

    const data = await response.json();
    let fixResult = data.choices?.[0]?.message?.content || '';

    fixResult = fixResult.trim();
    
    if (fixResult.includes('```json')) {
      const match = fixResult.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        fixResult = match[1].trim();
      }
    } else if (fixResult.includes('```')) {
      fixResult = fixResult.replace(/```[\w]*/g, '').replace(/```/g, '').trim();
    }

    let result;
    try {
      result = JSON.parse(fixResult);
    } catch (parseError) {
      return NextResponse.json(
        { error: { message: 'Failed to parse fix result' } },
        { status: 500 }
      );
    }

    if (!result.fixedCode) {
      return NextResponse.json(
        { error: { message: 'No fixed code returned' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fixedCode: result.fixedCode,
      explanation: result.explanation || 'Code fixed successfully',
      success: true
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: { 
          message: error.message || 'Server error',
          suggestion: 'Get a FREE Groq API key: https://console.groq.com'
        } 
      },
      { status: 500 }
    );
  }
}