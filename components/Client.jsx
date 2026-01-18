// Client.jsx - Production Version
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useCollaboration } from '@/hooks/useCollaboration';
import { Header } from './ui/Header';
import { LanguageSelector } from './ui/LanguageSelecter';
import { CodeEditor } from './ui/CodeEditor';
import { OutputPanel } from './ui/OutputPanel';
import { StatusBar } from './ui/StatusBar';
import { CollaborationBar } from './ui/CollaborationBar';

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

const loadEditorState = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const savedState = localStorage.getItem('editorState');
    if (!savedState) return null;
    
    const state = JSON.parse(savedState);
    const isRecent = Date.now() - state.timestamp < 24 * 60 * 60 * 1000;
    
    return isRecent ? state : null;
  } catch (error) {
    return null;
  }
};

export default function Client() {
  const router = useRouter();
  const initialState = loadEditorState();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState(initialState?.lang || 'javascript');
  const [code, setCode] = useState(initialState?.code || defaultCode[initialState?.lang || 'javascript']);
  const [output, setOutput] = useState(initialState?.output || '');
  const [isRunning, setIsRunning] = useState(false);
  const [execTime, setExecTime] = useState(initialState?.execTime || 0);
  const [isCopied, setIsCopied] = useState(false);
  const [programInputs, setProgramInputs] = useState(initialState?.programInputs || '');
  
  const abortControllerRef = useRef(null);
  
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [currentCodeId, setCurrentCodeId] = useState(initialState?.currentCodeId || null);
  const [codeTitle, setCodeTitle] = useState(initialState?.codeTitle || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [isEditingSavedCode, setIsEditingSavedCode] = useState(initialState?.isEditingSavedCode || false);
  const [isSharedCode, setIsSharedCode] = useState(initialState?.isSharedCode || false);
  
  const [savedCodes, setSavedCodes] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [editingCodeName, setEditingCodeName] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [extensions, setExtensions] = useState([]);

  const {
    collaborators,
    activeEditors,
    isCollaborator,
    isOwner,
    isLocked,
    currentUserEditing,
    hasUnsavedChanges,
    startEditing,
    stopEditing,
    removeCollaborator,
    syncCode,
    remoteCode
  } = useCollaboration(currentCodeId, user, supabase);

  const updateTimerRef = useRef(null);
  const lastLocalUpdateRef = useRef(null);
  const stateRestoredRef = useRef(!!initialState);

  useEffect(() => {
    try {
      const editorState = {
        currentCodeId,
        codeTitle,
        code,
        lang,
        output,
        execTime,
        isEditingSavedCode,
        isSharedCode,
        programInputs,
        timestamp: Date.now()
      };
      localStorage.setItem('editorState', JSON.stringify(editorState));
    } catch (error) {
      // Silent fail in production
    }
  }, [currentCodeId, codeTitle, code, lang, output, execTime, isEditingSavedCode, isSharedCode, programInputs]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error) {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        // Silent fail in production
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
          setIsEditingSavedCode(false);
          setIsSharedCode(false);
          setLang('javascript');
          setCode(defaultCode['javascript']);
          setOutput('');
          setExecTime(0);
          setProgramInputs('');
        }
      }
    );

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (user && !loading && supabase) {
      loadUserCodes(user);
    }
  }, [user, loading]);

  useEffect(() => {
    if (stateRestoredRef.current) {
      stateRestoredRef.current = false;
    }
  }, [lang]);

  useEffect(() => {
    if (remoteCode !== null && remoteCode !== lastLocalUpdateRef.current) {
      setCode(remoteCode);
    }
  }, [remoteCode]);

  const loadUserCodes = async (currentUser = user) => {
    if (!currentUser || !supabase) {
      return;
    }
    
    try {
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
        setSavedCodes([]);
        return;
      }

      const allCodes = (collaboratorRecords || [])
        .map(record => {
          const code = record.saved_codes;
          if (!code) return null;
          
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

      setSavedCodes(uniqueCodes);
      
    } catch (error) {
      setSavedCodes([]);
    }
  };

  const createNewCode = async () => {
    if (isEditingSavedCode && code.trim()) {
      const confirmed = confirm('You have unsaved changes. Create a new code?');
      if (!confirmed) return;
    }

    if (currentUserEditing) {
      await stopEditing();
    }
    
    try {
      localStorage.removeItem('editorState');
    } catch (error) {
      // Silent fail
    }
    
    setCurrentCodeId(null);
    setCodeTitle('');
    setCode(defaultCode[lang] || '');
    setOutput('');
    setProgramInputs('');
    setShowSaveDialog(false);
    setIsEditingSavedCode(false);
    setIsSharedCode(false);
    stateRestoredRef.current = false;
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      // Silent fail
    }
  };

  const resetCode = () => {
    setCode(defaultCode[lang] || '');
    setOutput('');
    setProgramInputs('');
  };

  const downloadCode = () => {
    try {
      const element = document.createElement('a');
      const file = new Blob([code], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `code.${fileExtensions[lang] || 'txt'}`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      // Silent fail
    }
  };

  const handleInputsChange = (newInputs) => {
    setProgramInputs(newInputs);
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');
    setExecTime(0);
    
    const startTime = Date.now();
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language: lang,
          stdin: programInputs || ''
        }),
        signal: abortControllerRef.current.signal
      });

      if (response.ok) {
        const result = await response.json();
        setOutput(result.output || result.error || 'No output');
        setExecTime(result.executionTime || Date.now() - startTime);
        setIsRunning(false);
      } else {
        const errorText = await response.text();
        setOutput(`Error: ${errorText || 'Execution failed'}`);
        setExecTime(Date.now() - startTime);
        setIsRunning(false);
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        setOutput('Execution cancelled');
      } else {
        setOutput(`Error: ${error.message || 'Failed to execute code'}`);
      }
      setExecTime(Date.now() - startTime);
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

    if (!user) {
      setSaveMessage('Please log in to save your code');
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 3000);
      return;
    }

    const trimmedTitle = codeTitle.trim();
    if (!trimmedTitle) {
      setSaveMessage('Please enter a title for your code');
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 3000);
      return;
    }

    if (trimmedTitle.length > 100) {
      setSaveMessage('Title must be 100 characters or less');
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
        title: trimmedTitle,
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
        
        if (error) {
          throw new Error(`Failed to update code: ${error.message}`);
        }
        
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
        
        if (error) {
          throw new Error(`Failed to save code: ${error.message}`);
        }
        
        const { error: collabError } = await supabase
          .from('collaborators')
          .insert([{
            code_id: data.id,
            user_id: session.user.id,
            is_owner: true,
            is_editing: false,
            last_active: new Date().toISOString()
          }]);

        if (collabError) {
          // Silent fail for collaborator insert
        }
        
        setSavedCodes(prev => [{ ...data, is_owned: true, is_shared: false }, ...prev]);
        setCurrentCodeId(data.id);
        setSaveMessage('Code saved successfully!');
        setIsSharedCode(false);
      }
      
      setIsEditingSavedCode(true);
      
      setShowSaveMessage(true);
      setTimeout(() => {
        setShowSaveMessage(false);
        setShowSaveDialog(false);
      }, 2000);
      
    } catch (error) {
      setSaveMessage(error.message || 'Failed to save code');
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const loadCode = async (savedCode) => {
    if (!savedCode || !savedCode.id) {
      return;
    }

    if (currentUserEditing) {
      await stopEditing();
    }
    
    setCurrentCodeId(savedCode.id);
    setCodeTitle(savedCode.title || 'Untitled');
    setCode(savedCode.code || '');
    setLang(savedCode.language || 'javascript');
    setOutput('');
    setProgramInputs('');
    setShowUserMenu(false);
    setIsEditingSavedCode(true);
    setIsSharedCode(savedCode.is_shared || false);
    stateRestoredRef.current = false;
    
    try {
      const editorState = {
        currentCodeId: savedCode.id,
        codeTitle: savedCode.title,
        code: savedCode.code,
        lang: savedCode.language,
        output: '',
        execTime: 0,
        programInputs: '',
        isEditingSavedCode: true,
        isSharedCode: savedCode.is_shared || false,
        timestamp: Date.now()
      };
      localStorage.setItem('editorState', JSON.stringify(editorState));
    } catch (error) {
      // Silent fail
    }
  };

  const renameCode = async (codeId, newName) => {
    if (!supabase || !newName || !newName.trim()) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_codes')
        .update({ 
          title: newName.trim(), 
          updated_at: new Date().toISOString() 
        })
        .eq('id', codeId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      setSavedCodes(prev => prev.map(c => 
        c.id === codeId 
          ? { ...data, is_owned: c.is_owned, is_shared: c.is_shared } 
          : c
      ));
      
      if (codeId === currentCodeId) {
        setCodeTitle(newName.trim());
      }
      
      setEditingCodeName(null);
    } catch (error) {
      alert('Failed to rename code. Please try again.');
    }
  };

  const deleteCode = async (codeId) => {
    if (!supabase || !user) {
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_codes')
        .delete()
        .eq('id', codeId)
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      setSavedCodes(prev => prev.filter(c => c.id !== codeId));
      
      if (currentCodeId === codeId) {
        createNewCode();
      }
    } catch (error) {
      alert('Failed to delete code. Please try again.');
    }
  };

  const handleLogout = async () => {
    if (!supabase) {
      return;
    }

    try {
      if (currentUserEditing) {
        await stopEditing();
      }
      
      localStorage.removeItem('editorState');
      await supabase.auth.signOut();
      
      setLang('javascript');
      setCode(defaultCode['javascript']);
      setOutput('');
      setExecTime(0);
      setProgramInputs('');
      setCurrentCodeId(null);
      setCodeTitle('');
      setIsEditingSavedCode(false);
      setIsSharedCode(false);
    } catch (error) {
      // Silent fail
    }
  };

  const handleUserUpdate = async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        setUser(data.session.user);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const handleAcceptCollaboration = async (request) => {
    if (!supabase) {
      alert('Database not available');
      return;
    }
    
    if (!request || !request.code_id) {
      alert('Invalid collaboration request');
      return;
    }
    
    try {
      const { data: codeData, error } = await supabase
        .from('saved_codes')
        .select('*')
        .eq('id', request.code_id)
        .maybeSingle();

      if (error) {
        alert(`Failed to load shared code: ${error.message || 'Unknown error'}`);
        return;
      }

      if (!codeData) {
        alert('Code not found or you no longer have access');
        return;
      }

      if (currentUserEditing) {
        await stopEditing();
      }
      
      setCurrentCodeId(codeData.id);
      setCodeTitle(codeData.title || 'Untitled');
      setCode(codeData.code || '');
      setLang(codeData.language || 'javascript');
      setOutput('');
      setProgramInputs('');
      setIsEditingSavedCode(true);
      setIsSharedCode(true);
      stateRestoredRef.current = false;
      
      await loadUserCodes();
      alert(`Now collaborating on "${codeData.title}"!`);
    } catch (error) {
      alert('Failed to accept collaboration request');
    }
  };

  const handleCodeChange = (newCode) => {
    lastLocalUpdateRef.current = newCode;
    setCode(newCode);

    if (currentUserEditing && currentCodeId && isCollaborator) {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      updateTimerRef.current = setTimeout(() => {
        syncCode(newCode);
      }, 500);
    }
  };

  const handleLanguageChange = (newLang, skipCodeReset = false) => {
    if (!skipCodeReset && isEditingSavedCode) {
      alert('Cannot change language while editing a saved code. Click "New" to start fresh.');
      return;
    }
    
    setLang(newLang);
    
    if (!skipCodeReset) {
      setCode(defaultCode[newLang] || '');
      setOutput('');
      setProgramInputs('');
    }
  };

  const handleStartEditing = async () => {
    if (isLocked) {
      alert('Someone else is currently editing. Please wait for them to finish.');
      return;
    }
    
    const success = await startEditing();
    if (!success) {
      alert('Unable to start editing. Another user may have just started editing.');
    }
  };

  const handleStopEditing = async () => {
    if (hasUnsavedChanges) {
      alert('Please wait for your changes to be saved before stopping editing.');
      return;
    }
    await stopEditing();
  };

  const handleRemoveCollaborator = async (userId) => {
    if (!userId) {
      return false;
    }
    
    const success = await removeCollaborator(userId);
    if (success) {
      await loadUserCodes();
    }
    return success;
  };

  const shouldShowCollaboration = isSharedCode || (collaborators.length > 1 && currentCodeId);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-black">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <Header
        user={user}
        currentCodeId={currentCodeId}
        codeTitle={codeTitle}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        supabase={supabase}
        onUserUpdate={handleUserUpdate}
      />

      {shouldShowCollaboration && (
        <CollaborationBar
          collaborators={collaborators}
          activeEditors={activeEditors}
          isEditing={currentUserEditing}
          isLocked={isLocked}
          isOwner={isOwner}
          hasUnsavedChanges={hasUnsavedChanges}
          startEditing={handleStartEditing}
          stopEditing={handleStopEditing}
          removeCollaborator={handleRemoveCollaborator}
          user={user}
          supabase={supabase}
        />
      )}

      <div className="flex-1 flex min-h-0">
        <div className="w-16 bg-white border-r border-gray-700 flex flex-col items-center py-4 overflow-y-auto">
          <LanguageSelector
            lang={lang}
            setLang={handleLanguageChange}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
            isEditingSavedCode={isEditingSavedCode}
          />
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0">
          <CodeEditor
            lang={lang}
            code={code}
            setCode={handleCodeChange}
            setLang={setLang}
            extensions={extensions}
            copyCode={copyCode}
            isCopied={isCopied}
            resetCode={resetCode}
            downloadCode={downloadCode}
            runCode={runCode}
            isRunning={isRunning}
            readOnly={shouldShowCollaboration && !currentUserEditing}
            isCollaborating={shouldShowCollaboration}
            user={user}
            currentCodeId={currentCodeId}
            isEditingSavedCode={isEditingSavedCode}
            createNewCode={createNewCode}
            saveCode={saveCode}
            codeTitle={codeTitle}
            setCodeTitle={setCodeTitle}
            isSaving={isSaving}
            saveMessage={saveMessage}
            showSaveMessage={showSaveMessage}
          />
          <OutputPanel
            output={output}
            execTime={execTime}
            isRunning={isRunning}
            onInputsChange={handleInputsChange}
            savedInputs={programInputs}
          />
        </div>
      </div>

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