import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for managing real-time code collaboration
 * Handles multi-user editing with locking, versioning, and sync
 */
export const useCollaboration = (codeId, user, supabase) => {
  const [collaborators, setCollaborators] = useState([]);
  const [activeEditors, setActiveEditors] = useState([]);
  const [remoteCode, setRemoteCode] = useState(null);
  const [lastSyncedVersion, setLastSyncedVersion] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const collaboratorsChannel = useRef(null);
  const editsChannel = useRef(null);
  const heartbeatInterval = useRef(null);
  const isApplyingRemoteChange = useRef(false);
  const isSyncing = useRef(false);
  const lastSyncedCode = useRef(null);
  const isWindowClosing = useRef(false);

  /**
   * Loads all collaborators for the current code document
   * Updates lock status based on active editors
   */
  const loadCollaborators = useCallback(async () => {
    if (!codeId || !supabase || !user) return;

    try {
      const { data: collaboratorData, error: collabError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('code_id', codeId);

      if (collabError) {
        setCollaborators([]);
        setActiveEditors([]);
        setIsLocked(false);
        return;
      }

      if (!collaboratorData || collaboratorData.length === 0) {
        setCollaborators([]);
        setActiveEditors([]);
        setIsLocked(false);
        return;
      }

      const formattedCollaborators = collaboratorData.map((c, index) => ({
        user_id: c.user_id,
        email: c.user_id === user.id ? user.email : `User ${index + 1}`,
        name: c.user_id === user.id ? user.email : `User ${index + 1}`,
        is_owner: c.is_owner,
        is_editing: c.is_editing,
        last_active: c.last_active
      }));

      setCollaborators(formattedCollaborators);

      const editors = formattedCollaborators.filter(c => c.is_editing);
      setActiveEditors(editors);

      const someoneElseEditing = editors.some(e => e.user_id !== user.id);
      setIsLocked(someoneElseEditing);

    } catch (error) {
      setCollaborators([]);
      setActiveEditors([]);
      setIsLocked(false);
    }
  }, [codeId, supabase, user]);

  /**
   * Attempts to acquire editing lock
   * Returns false if another user is currently editing
   */
  const startEditing = useCallback(async () => {
    if (!codeId || !supabase || !user) return false;

    try {
      const { data: existingEditors, error: checkError } = await supabase
        .from('collaborators')
        .select('user_id, is_editing')
        .eq('code_id', codeId)
        .eq('is_editing', true);

      if (checkError) return false;

      if (existingEditors && existingEditors.length > 0) {
        const otherUserEditing = existingEditors.some(e => e.user_id !== user.id);
        if (otherUserEditing) return false;
      }

      const { error: updateError } = await supabase
        .from('collaborators')
        .update({ 
          is_editing: true,
          last_active: new Date().toISOString()
        })
        .eq('code_id', codeId)
        .eq('user_id', user.id);

      if (updateError) return false;

      await loadLatestVersion();
      setHasUnsavedChanges(false);
      startHeartbeat();
      await loadCollaborators();

      return true;
    } catch (error) {
      return false;
    }
  }, [codeId, supabase, user]);

  /**
   * Releases editing lock
   * Prevents release if unsaved changes exist
   */
  const stopEditing = useCallback(async () => {
    if (!codeId || !supabase || !user) return;
    if (hasUnsavedChanges) return false;

    try {
      const { error } = await supabase
        .from('collaborators')
        .update({ 
          is_editing: false,
          last_active: new Date().toISOString()
        })
        .eq('code_id', codeId)
        .eq('user_id', user.id);

      if (error) return false;

      stopHeartbeat();
      setHasUnsavedChanges(false);
      await loadCollaborators();
      return true;

    } catch (error) {
      return false;
    }
  }, [codeId, supabase, user, hasUnsavedChanges, loadCollaborators]);

  /**
   * Removes a collaborator from the code document
   * Owner-only operation
   */
  const removeCollaborator = useCallback(async (collaboratorUserId) => {
    if (!codeId || !supabase || !user || !collaboratorUserId) return false;

    try {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('collaborators')
        .select('is_owner')
        .eq('code_id', codeId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (ownerError) return false;
      if (!ownerCheck?.is_owner) return false;
      if (collaboratorUserId === user.id) return false;

      const { error: deleteError } = await supabase
        .from('collaborators')
        .delete()
        .eq('code_id', codeId)
        .eq('user_id', collaboratorUserId)
        .eq('is_owner', false);

      if (deleteError) return false;

      await loadCollaborators();
      return true;

    } catch (error) {
      return false;
    }
  }, [codeId, supabase, user, loadCollaborators]);

  /**
   * Fetches the latest version of the code
   * Tries code_edits table first, falls back to saved_codes
   */
  const loadLatestVersion = useCallback(async () => {
    if (!codeId || !supabase) return;

    try {
      const { data: latestEdit, error: editError } = await supabase
        .from('code_edits')
        .select('version, content')
        .eq('code_id', codeId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestEdit) {
        setLastSyncedVersion(latestEdit.version);
        setRemoteCode(latestEdit.content);
        lastSyncedCode.current = latestEdit.content;
      } else {
        const { data: codeData, error: codeError } = await supabase
          .from('saved_codes')
          .select('code')
          .eq('id', codeId)
          .maybeSingle();

        if (codeError || !codeData) return;

        setRemoteCode(codeData.code);
        lastSyncedCode.current = codeData.code;
        setLastSyncedVersion(0);
      }
    } catch (error) {
      // Silent fail - maintains current state
    }
  }, [codeId, supabase]);

  /**
   * Syncs local code changes to the server
   * Creates new version entry and updates saved code
   */
  const syncCode = useCallback(async (code) => {
    if (!codeId || !supabase || !user) return;
    if (isApplyingRemoteChange.current || isSyncing.current) return;

    if (code !== lastSyncedCode.current) {
      setHasUnsavedChanges(true);
    }

    isSyncing.current = true;

    try {
      const { data: lastEdit } = await supabase
        .from('code_edits')
        .select('version')
        .eq('code_id', codeId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextVersion = (lastEdit?.version || 0) + 1;

      const { error: insertError } = await supabase
        .from('code_edits')
        .insert({
          code_id: codeId,
          user_id: user.id,
          content: code,
          version: nextVersion,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      await supabase
        .from('saved_codes')
        .update({ 
          code: code,
          updated_at: new Date().toISOString()
        })
        .eq('id', codeId);

      setLastSyncedVersion(nextVersion);
      lastSyncedCode.current = code;
      setHasUnsavedChanges(false);

    } catch (error) {
      // Retry logic could be added here
    } finally {
      isSyncing.current = false;
    }
  }, [codeId, supabase, user]);

  /**
   * Starts periodic heartbeat to maintain active status
   */
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();

    heartbeatInterval.current = setInterval(async () => {
      if (!codeId || !supabase || !user) return;

      try {
        await supabase
          .from('collaborators')
          .update({ last_active: new Date().toISOString() })
          .eq('code_id', codeId)
          .eq('user_id', user.id);
      } catch (error) {
        // Silent fail - heartbeat will retry
      }
    }, 15000);
  }, [codeId, supabase, user]);

  /**
   * Stops heartbeat interval
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  /**
   * Sets up real-time subscriptions for collaborators and code edits
   */
  useEffect(() => {
    if (!codeId || !supabase || !user) return;
    
    loadCollaborators();
    loadLatestVersion();

    collaboratorsChannel.current = supabase
      .channel(`collaborators:${codeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collaborators',
        filter: `code_id=eq.${codeId}`
      }, () => {
        loadCollaborators();
      })
      .subscribe();

    editsChannel.current = supabase
      .channel(`edits:${codeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'code_edits',
        filter: `code_id=eq.${codeId}`
      }, (payload) => {
        if (payload.new.user_id !== user.id) {
          isApplyingRemoteChange.current = true;
          setRemoteCode(payload.new.content);
          lastSyncedCode.current = payload.new.content;
          setLastSyncedVersion(payload.new.version);
          setHasUnsavedChanges(false);
          setTimeout(() => { 
            isApplyingRemoteChange.current = false; 
          }, 100);
        }
      })
      .subscribe();

    return () => {
      if (collaboratorsChannel.current) {
        supabase.removeChannel(collaboratorsChannel.current);
        collaboratorsChannel.current = null;
      }
      
      if (editsChannel.current) {
        supabase.removeChannel(editsChannel.current);
        editsChannel.current = null;
      }
      
      stopHeartbeat();
      
      if (supabase && user && codeId && isWindowClosing.current) {
        supabase
          .from('collaborators')
          .update({ 
            is_editing: false,
            last_active: new Date().toISOString()
          })
          .eq('code_id', codeId)
          .eq('user_id', user.id)
          .catch(() => {});
      }
    };
  }, [codeId, supabase, user, loadCollaborators, loadLatestVersion, stopHeartbeat]);

  /**
   * Handles browser close/refresh events
   * Warns on unsaved changes, releases lock on close
   */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (supabase && user && codeId) {
        isWindowClosing.current = true;
        
        if (navigator.sendBeacon) {
          const url = `${window.location.origin}/api/stop-editing`;
          const data = JSON.stringify({ codeId, userId: user.id });
          navigator.sendBeacon(url, data);
        }
        
        if (hasUnsavedChanges) {
          e.preventDefault();
          e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          return e.returnValue;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isWindowClosing.current = false;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [codeId, user, supabase, hasUnsavedChanges]);

  const isCollaborator = collaborators.some(c => c.user_id === user?.id);
  const isOwner = collaborators.find(c => c.user_id === user?.id)?.is_owner || false;
  const currentUserEditing = activeEditors.some(e => e.user_id === user?.id);

  return {
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
    remoteCode,
    lastSyncedVersion
  };
};