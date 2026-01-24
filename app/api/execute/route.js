// app/api/execute/route.js
import { NextResponse } from 'next/server';
import { executeInDocker, checkDockerAvailability } from '@/lib/dockerExecutor';

export async function POST(request) {
  try {
    const { code, language, stdin } = await request.json();

    // Logging for debugging
    console.log('=== Code Execution Request ===');
    console.log('Language:', language);
    console.log('Code length:', code?.length || 0);
    console.log('Stdin provided:', stdin ? `Yes (${stdin.length} chars)` : 'No');
    if (stdin) {
      console.log('Stdin preview:', stdin.substring(0, 100));
    }

    if (!code || !language) {
      return NextResponse.json(
        { error: 'Code and language are required' },
        { status: 400 }
      );
    }

    if (code.length > 50000) {
      return NextResponse.json(
        { error: 'Code exceeds maximum length of 50KB' },
        { status: 400 }
      );
    }

    const dockerAvailable = await checkDockerAvailability();

    if (!dockerAvailable) {
      return NextResponse.json(
        {
          error: 'Docker is not available. Please ensure Docker is installed and running.',
          output: '',
          executionTime: 0
        },
        { status: 503 }
      );
    }

    // Ensure stdin ends with newline for proper input handling
    const formattedStdin = stdin ? (stdin.endsWith('\n') ? stdin : stdin + '\n') : '';

    console.log('Executing with formatted stdin:', formattedStdin ? 'Yes' : 'No');

    // Pass stdin to executeInDocker
    const result = await executeInDocker(language, code, formattedStdin);

    console.log('Execution result:', {
      success: result.success,
      outputLength: result.output?.length || 0,
      executionTime: result.executionTime
    });

    if (result.success) {
      return NextResponse.json({
        output: result.output,
        error: null,
        executionTime: result.executionTime,
        success: true
      });
    } else {
      return NextResponse.json({
        output: result.output || '',
        error: result.error,
        executionTime: result.executionTime,
        success: false
      });
    }

  } catch (error) {
    console.error('Execution error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        output: '',
        executionTime: 0,
        success: false
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';