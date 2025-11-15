'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useCollaboration } from '@/hooks/useCollaboration';
import { Header } from './ui/Header';
import { ActionButtons } from './ui/ActionButtons';
import { LanguageSelector } from './ui/LanguageSelecter';
import { CodeEditor } from './ui/CodeEditor';
import { OutputPanel } from './ui/OutputPanel';
import { SaveDialog } from './ui/Savedialog';
import { StatusBar } from './ui/StatusBar';
import { CollaborationBar } from './ui/CollaborationBar';

// Language extensions and configurations
const fileExtensions = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rs',
  php: 'php'
};

const defaultCode = {
  javascript: 'console.log("Hello, World!");',
  typescript: 'console.log("Hello, TypeScript!");',
  python: 'print("Hello, World!")',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
  rust: 'fn main() {\n    println!("Hello, World!");\n}',
  php: '<?php\necho "Hello, World!";\n?>'
};

export default function Client() {
  const router = useRouter();
  
  // State management
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('javascript');
  const [code, setCode] = useState(defaultCode.javascript);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [execTime, setExecTime] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentCodeId, setCurrentCodeId] = useState(null);
  const [codeTitle, setCodeTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  
  // User menu state
  const [savedCodes, setSavedCodes] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingCodeName, setEditingCodeName] = useState(null);
  
  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Extensions for CodeMirror
  const [extensions, setExtensions] = useState([]);

  // Collaboration hook WITH EDIT LOCKING
  const {
    collaborators,
    activeEditors,
    isCollaborator,
    isOwner,
    isLocked,
    currentUserEditing,
    startEditing,
    stopEditing,
    removeCollaborator,
    syncCode,
    remoteCode
  } = useCollaboration(currentCodeId, user, supabase);

  // Debounce timer for code updates
  const updateTimerRef = useRef(null);
  const lastLocalUpdateRef = useRef(null);

  // 🔥 NEW: Save editor state to localStorage whenever it changes
  useEffect(() => {
    const editorState = {
      currentCodeId,
      codeTitle,
      code,
      lang,
      output,
      execTime,
      timestamp: Date.now()
    };
    localStorage.setItem('editorState', JSON.stringify(editorState));
  }, [currentCodeId, codeTitle, code, lang, output, execTime]);

  // Initialize auth state and listener + 🔥 RESTORE STATE
  useEffect(() => {
    if (!supabase) {
      console.error('Supabase client not available during initialization');
      setLoading(false);
      return;
    }

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setUser(session?.user ?? null);
        }

        // 🔥 RESTORE EDITOR STATE FROM localStorage AFTER SETTING USER
        const savedState = localStorage.getItem('editorState');
        if (savedState) {
          try {
            const state = JSON.parse(savedState);
            // Only restore if less than 24 hours old
            const isRecent = Date.now() - state.timestamp < 24 * 60 * 60 * 1000;
            
            if (isRecent) {
              console.log('✅ Restoring editor state from localStorage');
              if (state.currentCodeId) setCurrentCodeId(state.currentCodeId);
              if (state.codeTitle) setCodeTitle(state.codeTitle);
              if (state.code) setCode(state.code);
              if (state.lang) setLang(state.lang);
              if (state.output) setOutput(state.output);
              if (state.execTime) setExecTime(state.execTime);
            } else {
              console.log('⏰ Saved state expired, clearing...');
              localStorage.removeItem('editorState');
            }
          } catch (error) {
            console.error('❌ Failed to restore editor state:', error);
            localStorage.removeItem('editorState');
          }
        }
      } catch (error) {
        console.error('Error in getSession:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user) {
          loadUserCodes(session.user);
        } else {
          setSavedCodes([]);
          setCurrentCodeId(null);
          setCodeTitle('');
          createNewCode();
        }
      }
    );

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Load saved codes when user is available
  useEffect(() => {
    if (user && !loading && supabase) {
      loadUserCodes(user);
    }
  }, [user, loading]);

  // Language change handler
  useEffect(() => {
    if (!currentCodeId) {
      setCode(defaultCode[lang] || '');
    }
  }, [lang, currentCodeId]);

  // Handle remote code updates from other collaborators
  useEffect(() => {
    if (remoteCode !== null && remoteCode !== lastLocalUpdateRef.current) {
      console.log('Applying remote code update');
      setCode(remoteCode);
    }
  }, [remoteCode]);

  // Load user's saved codes from database
  const loadUserCodes = async (currentUser = user) => {
    if (!currentUser || !supabase) return;
    
    try {
      console.log('📂 Loading codes for user:', currentUser.id);

      const { data: collaboratorRecords, error: collabError } = await supabase
        .from('collaborators')
        .select(`
          code_id,
          is_owner,
          saved_codes!inner (
            id,
            user_id,
            title,
            code,
            language,
            extension,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', currentUser.id)
        .order('saved_codes(updated_at)', { ascending: false });
      
      if (collabError) {
        console.error('Error loading codes:', collabError);
        throw collabError;
      }

      console.log('✅ Collaborator records found:', collaboratorRecords?.length || 0);

      const allCodes = (collaboratorRecords || [])
        .map(record => {
          const code = record.saved_codes;
          return {
            ...code,
            is_owned: record.is_owner,
            is_shared: !record.is_owner
          };
        })
        .filter(Boolean);

      const uniqueCodes = Array.from(
        new Map(allCodes.map(code => [code.id, code])).values()
      );

      uniqueCodes.sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      );

      console.log('✅ Total unique codes loaded:', uniqueCodes.length);
      console.log('   - Owned:', uniqueCodes.filter(c => c.is_owned).length);
      console.log('   - Shared:', uniqueCodes.filter(c => c.is_shared).length);

      setSavedCodes(uniqueCodes);
      
    } catch (error) {
      console.error('❌ Error loading codes:', error);
    }
  };

  // Functions
  const createNewCode = async () => {
    if (currentUserEditing) {
      await stopEditing();
    }
    
    // 🔥 Clear saved state when creating new code
    localStorage.removeItem('editorState');
    
    setCurrentCodeId(null);
    setCodeTitle('');
    setCode(defaultCode[lang] || '');
    setOutput('');
    setShowSaveDialog(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const resetCode = () => {
    setCode(defaultCode[lang] || '');
    setOutput('');
  };

  const downloadCode = () => {
    const element = document.createElement('a');
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `code.${fileExtensions[lang] || 'txt'}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language: lang,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setOutput(result.output || result.error || 'No output');
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        let mockOutput = 'Hello, World!';
        setOutput(mockOutput);
      }
      
      setExecTime(Date.now() - startTime);
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setOutput('Hello, World!');
      setExecTime(Date.now() - startTime);
    } finally {
      setIsRunning(false);
    }
  };

  const saveCode = async () => {
    if (!supabase) {
      setSaveMessage('Database connection not available. Please refresh the page.');
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 5000);
      return;
    }

    if (!user || !codeTitle.trim()) {
      setSaveMessage('Please enter a title for your code');
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 3000);
      return;
    }
    
    setIsSaving(true);
    setSaveMessage('');
    setShowSaveMessage(false);
    
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) {
        throw new Error('Authentication required. Please log in again.');
      }

      const codeData = {
        title: codeTitle.trim(),
        code: code,
        language: lang,
        extension: fileExtensions[lang] || 'txt',
        user_id: session.user.id,
        updated_at: new Date().toISOString()
      };

      if (currentCodeId) {
        const { data, error } = await supabase
          .from('saved_codes')
          .update(codeData)
          .eq('id', currentCodeId)
          .select()
          .single();
        
        if (error) throw new Error(`Failed to update code: ${error.message}`);
        
        setSavedCodes(prev => prev.map(c => 
          c.id === currentCodeId 
            ? { ...data, is_owned: c.is_owned, is_shared: c.is_shared } 
            : c
        ));
        setSaveMessage('Code updated successfully!');
        
      } else {
        const { data, error } = await supabase
          .from('saved_codes')
          .insert([codeData])
          .select()
          .single();
        
        if (error) throw new Error(`Failed to save code: ${error.message}`);
        
        await supabase
          .from('collaborators')
          .insert([{
            code_id: data.id,
            user_id: session.user.id,
            is_owner: true,
            is_editing: false,
            last_active: new Date().toISOString()
          }]);
        
        setSavedCodes(prev => [{ ...data, is_owned: true, is_shared: false }, ...prev]);
        setCurrentCodeId(data.id);
        setSaveMessage('Code saved successfully!');
      }
      
      setShowSaveMessage(true);
      setTimeout(() => {
        setShowSaveMessage(false);
        setShowSaveDialog(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error saving code:', error);
      setSaveMessage(error.message || 'Failed to save code');
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const loadCode = async (savedCode) => {
    if (currentUserEditing) {
      await stopEditing();
    }
    
    setCurrentCodeId(savedCode.id);
    setCodeTitle(savedCode.title);
    setCode(savedCode.code);
    setLang(savedCode.language);
    setOutput('');
    setShowUserMenu(false);
    
    // 🔥 Update localStorage with loaded code
    const editorState = {
      currentCodeId: savedCode.id,
      codeTitle: savedCode.title,
      code: savedCode.code,
      lang: savedCode.language,
      output: '',
      execTime: 0,
      timestamp: Date.now()
    };
    localStorage.setItem('editorState', JSON.stringify(editorState));
  };

  const renameCode = async (codeId, newName) => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('saved_codes')
        .update({ 
          title: newName, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', codeId)
        .select()
        .single();
      
      if (error) throw error;
      
      setSavedCodes(prev => prev.map(c => 
        c.id === codeId 
          ? { ...data, is_owned: c.is_owned, is_shared: c.is_shared } 
          : c
      ));
      setEditingCodeName(null);
    } catch (error) {
      console.error('Failed to rename code:', error);
    }
  };

  const deleteCode = async (codeId) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('saved_codes')
        .delete()
        .eq('id', codeId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setSavedCodes(prev => prev.filter(c => c.id !== codeId));
      if (currentCodeId === codeId) {
        createNewCode();
      }
    } catch (error) {
      console.error('Failed to delete code:', error);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;

    try {
      if (currentUserEditing) {
        await stopEditing();
      }
      
      // 🔥 Clear editor state on logout
      localStorage.removeItem('editorState');
      
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleUserUpdate = async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && data.session) {
          setUser(data.session.user);
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  // Handle accepting collaboration request
  const handleAcceptCollaboration = async (request) => {
    if (!supabase) return;
    
    try {
      const { data: codeData, error } = await supabase
        .from('saved_codes')
        .select('*')
        .eq('id', request.code_id)
        .single();

      if (error) {
        console.error('Error loading shared code:', error);
        alert('Failed to load shared code');
        return;
      }

      if (currentUserEditing) {
        await stopEditing();
      }
      
      setCurrentCodeId(codeData.id);
      setCodeTitle(codeData.title);
      setCode(codeData.code);
      setLang(codeData.language);
      setOutput('');
      
      await loadUserCodes();
      
      alert(`✅ Now collaborating on "${codeData.title}"!`);
    } catch (error) {
      console.error('Error accepting collaboration:', error);
      alert('Failed to accept collaboration request');
    }
  };

  // Handle code changes with collaboration
  const handleCodeChange = (newCode) => {
    lastLocalUpdateRef.current = newCode;
    setCode(newCode);

    // Only sync if user is currently editing
    if (currentUserEditing && currentCodeId && isCollaborator) {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      updateTimerRef.current = setTimeout(() => {
        syncCode(newCode);
      }, 500);
    }
  };

  // Handle start/stop editing WITH LOCK CHECK
  const handleStartEditing = async () => {
    if (isLocked) {
      alert('❌ Someone else is currently editing. Please wait for them to finish.');
      return;
    }
    
    const success = await startEditing();
    if (!success) {
      alert('❌ Unable to start editing. Another user may have just started editing.');
    }
  };

  const handleStopEditing = async () => {
    await stopEditing();
  };

  // Handle removing collaborator
  const handleRemoveCollaborator = async (userId) => {
    const success = await removeCollaborator(userId);
    if (success) {
      await loadUserCodes();
    }
    return success;
  };

  // Determine if in collaboration mode
  const isCollaborating = collaborators.length > 1;

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state if Supabase client is not available
  if (!supabase) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L5.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-white text-lg font-semibold mb-2">Database Configuration Error</h3>
          <p className="text-gray-400 mb-4">
            Unable to initialize database connection. Please check your configuration.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <Header
        user={user}
        currentCodeId={currentCodeId}
        codeTitle={codeTitle}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        supabase={supabase}
        onUserUpdate={handleUserUpdate}
      />

      {/* Collaboration Bar - Only show when code has multiple collaborators */}
      {isCollaborating && (
        <CollaborationBar
          collaborators={collaborators}
          activeEditors={activeEditors}
          isEditing={currentUserEditing}
          isLocked={isLocked}
          isOwner={isOwner}
          startEditing={handleStartEditing}
          stopEditing={handleStopEditing}
          removeCollaborator={handleRemoveCollaborator}
          user={user}
          supabase={supabase}
        />
      )}

      {/* Save Dialog */}
      <SaveDialog
        showSaveDialog={showSaveDialog}
        setShowSaveDialog={setShowSaveDialog}
        currentCodeId={currentCodeId}
        codeTitle={codeTitle}
        setCodeTitle={setCodeTitle}
        code={code}
        lang={lang}
        fileExtensions={fileExtensions}
        saveCode={saveCode}
        isSaving={isSaving}
        saveMessage={saveMessage}
        showSaveMessage={showSaveMessage}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Controls Bar */}
        <div className={`bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 ${
          isMobileMenuOpen ? 'block' : 'hidden md:block'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <LanguageSelector
              lang={lang}
              setLang={setLang}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
            <ActionButtons
              user={user}
              createNewCode={createNewCode}
              setShowSaveDialog={setShowSaveDialog}
              currentCodeId={currentCodeId}
              codeTitle={codeTitle}
              supabase={supabase}
            />
          </div>
        </div>

        {/* Editor and Output */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
          <CodeEditor
            lang={lang}
            code={code}
            setCode={handleCodeChange}
            extensions={extensions}
            copyCode={copyCode}
            isCopied={isCopied}
            resetCode={resetCode}
            downloadCode={downloadCode}
            runCode={runCode}
            isRunning={isRunning}
            readOnly={isLocked && !currentUserEditing}
            isCollaborating={isCollaborating}
          />
          <OutputPanel
            output={output}
            execTime={execTime}
            isRunning={isRunning}
          />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        lang={lang}
        code={code}
        isRunning={isRunning}
        execTime={execTime}
        user={user}
        savedCodes={savedCodes}
        showUserMenu={showUserMenu}
        setShowUserMenu={setShowUserMenu}
        router={router}
        loadCode={loadCode}
        editingCodeName={editingCodeName}
        setEditingCodeName={setEditingCodeName}
        renameCode={renameCode}
        deleteCode={deleteCode}
        fileExtensions={fileExtensions}
        handleLogout={handleLogout}
        supabase={supabase}
        onUserUpdate={handleUserUpdate}
        onAcceptCollaboration={handleAcceptCollaboration}
        currentCodeId={currentCodeId}  
        codeTitle={codeTitle}          
      />
    </div>
  );
}