// app/api/stop-editing/route.js - API endpoint for stopping edit mode
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { codeId, userId } = body;

    if (!codeId || !userId) {
      return NextResponse.json(
        { error: 'Missing codeId or userId' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key (server-side only)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Update the collaborator's editing status
    const { error } = await supabase
      .from('collaborators')
      .update({ 
        is_editing: false,
        last_active: new Date().toISOString()
      })
      .eq('code_id', codeId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error stopping editing:', error);
      return NextResponse.json(
        { error: 'Failed to stop editing', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Successfully stopped editing for user:', userId, 'code:', codeId);

    return NextResponse.json({ 
      success: true,
      message: 'Editing stopped successfully' 
    });

  } catch (error) {
    console.error('Exception in stop-editing endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}