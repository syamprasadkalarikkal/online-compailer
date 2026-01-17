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
            content: 'You are an expert code generator. You MUST respond with ONLY a valid JSON object, nothing else. No markdown, no explanations outside the JSON. The JSON must have this exact structure: {"generatedCode": "the complete code here", "explanation": "brief explanation"}. Do not wrap the JSON in code blocks or add any text before or after it.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      })
    }
  );

  return response;
}

export async function POST(request) {
  try {
    const { prompt, language, existingCode } = await request.json();

    if (!prompt || !language) {
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

    const hasExistingCode = existingCode && existingCode.trim().length > 0;

    const promptText = hasExistingCode 
      ? `Generate ${languageNames[language]} code based on this requirement. You MUST return ONLY a JSON object with "generatedCode" and "explanation" fields.

REQUIREMENT:
${prompt}

EXISTING CODE (modify/extend this code):
\`\`\`${language}
${existingCode}
\`\`\`

Return ONLY this JSON structure (no markdown, no extra text):
{
  "generatedCode": "the complete code here",
  "explanation": "brief explanation"
}`
      : `Generate ${languageNames[language]} code based on this requirement. You MUST return ONLY a JSON object with "generatedCode" and "explanation" fields.

REQUIREMENT:
${prompt}

Return ONLY this JSON structure (no markdown, no extra text):
{
  "generatedCode": "the complete code here",
  "explanation": "brief explanation"
}`;

    const response = await callGroq(promptText, apiKey);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: { message: 'Code generation failed' }
      }));
      
      return NextResponse.json(
        { error: { message: errorData.error?.message || 'Code generation failed' } },
        { status: response.status }
      );
    }

    const data = await response.json();
    let generateResult = data.choices?.[0]?.message?.content || '';

    generateResult = generateResult.trim();
    
    if (generateResult.includes('```json')) {
      const match = generateResult.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        generateResult = match[1].trim();
      }
    } else if (generateResult.includes('```')) {
      generateResult = generateResult.replace(/```[\w]*/g, '').replace(/```/g, '').trim();
    }

    let result;
    try {
      result = JSON.parse(generateResult);
    } catch (parseError) {
      const codeMatch = generateResult.match(/```[\w]*\n([\s\S]*?)\n```/);
      if (codeMatch) {
        return NextResponse.json({
          generatedCode: codeMatch[1].trim(),
          explanation: 'Code generated successfully',
          success: true
        });
      }
      
      return NextResponse.json(
        { error: { message: 'Failed to generate code. Please try again.' } },
        { status: 500 }
      );
    }

    if (!result.generatedCode) {
      return NextResponse.json(
        { error: { message: 'No code was generated' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      generatedCode: result.generatedCode,
      explanation: result.explanation || 'Code generated successfully',
      success: true
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: { 
          message: 'An error occurred. Please try again.',
          suggestion: 'Get a FREE Groq API key: https://console.groq.com'
        } 
      },
      { status: 500 }
    );
  }
}