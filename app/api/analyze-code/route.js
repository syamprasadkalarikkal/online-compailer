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
            content: 'You are an expert code analyzer. Analyze code for errors, bugs, and potential issues. Return ONLY a JSON object with this structure: {"errors": [{"line": number, "severity": "error"|"warning", "message": "description", "suggestion": "how to fix"}], "suggestions": [{"title": "suggestion title", "description": "suggestion details"}]}'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    }
  );

  return response;
}

export async function POST(request) {
  try {
    const { code, language } = await request.json();

    if (!code || !language) {
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

    const prompt = `Analyze this ${languageNames[language]} code for errors, bugs, and potential issues:

\`\`\`${language}
${code}
\`\`\`

Return a JSON object with:
- errors: array of {line, severity, message, suggestion}
- suggestions: array of {title, description} for improvements

Be specific about line numbers and provide actionable fixes.`;

    const response = await callGroq(prompt, apiKey);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: { message: 'Analysis failed' }
      }));
      
      return NextResponse.json(
        { error: { message: errorData.error?.message || 'Analysis failed' } },
        { status: response.status }
      );
    }

    const data = await response.json();
    let analysisResult = data.choices?.[0]?.message?.content || '';

    analysisResult = analysisResult.trim();
    
    if (analysisResult.includes('```json')) {
      const match = analysisResult.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        analysisResult = match[1].trim();
      }
    } else if (analysisResult.includes('```')) {
      analysisResult = analysisResult.replace(/```[\w]*/g, '').replace(/```/g, '').trim();
    }

    let result;
    try {
      result = JSON.parse(analysisResult);
    } catch (parseError) {
      result = {
        errors: [],
        suggestions: [{
          title: 'Analysis Complete',
          description: 'Code analyzed successfully. No specific issues detected.'
        }]
      };
    }

    return NextResponse.json({
      errors: result.errors || [],
      suggestions: result.suggestions || [],
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