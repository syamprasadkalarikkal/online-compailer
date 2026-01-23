import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for managing real-time code collaboration
 * Handles multi-user editing with locking, versioning, and sync via WebSocket
 */
export const useCollaboration = (codeId, user, supabase) => {
  const [collaborators, setCollaborators] = useState([]);
  const [activeEditors, setActiveEditors] = useState([]);
  const [remoteCode, setRemoteCode] = useState(null);
  const [lastSyncedVersion, setLastSyncedVersion] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentUserEditing, setCurrentUserEditing] = useState(false);

  const wsRef = useRef(null);
  const isApplyingRemoteChange = useRef(false);
  const lastSyncedCode = useRef(null);
  const isWindowClosing = useRef(false);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!codeId || !user) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Collaboration WS connected');
      ws.send(JSON.stringify({
        type: 'join',
        codeId,
        userId: user.id,
        userEmail: user.email || user.user_metadata?.email || 'Anonymous'
      }));

      // Check if we were editing before reload
      const wasEditing = sessionStorage.getItem(`isEditing_${codeId}`);
      if (wasEditing === 'true') {
        ws.send(JSON.stringify({
          type: 'start_edit',
          codeId,
          userId: user.id,
          userEmail: user.email
        }));
      }
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'code_update':
          if (message.userId !== user.id) {
            isApplyingRemoteChange.current = true;
            setRemoteCode(message.code);
            lastSyncedCode.current = message.code;
            setTimeout(() => {
              isApplyingRemoteChange.current = false;
            }, 100);
          }
          break;

        case 'collaborators':
          setCollaborators(message.collaborators.map(c => ({
            user_id: c.userId,
            email: c.userEmail,
            name: c.userEmail,
            is_editing: c.isEditing
          })));

          const editors = message.collaborators
            .filter(c => c.isEditing)
            .map(c => ({
              user_id: c.userId,
              email: c.userEmail
            }));

          setActiveEditors(editors);

          // Update lock status
          const otherUserEditing = editors.some(e => e.user_id !== user.id);
          setIsLocked(otherUserEditing);

          // Update own editing status based on server truth
          const amIEditing = editors.some(e => e.user_id === user.id);
          setCurrentUserEditing(amIEditing);
          break;

        case 'edit_granted':
          setCurrentUserEditing(true);
          setHasUnsavedChanges(false);
          sessionStorage.setItem(`isEditing_${codeId}`, 'true');
          setActiveEditors(prev => {
            if (prev.some(e => e.user_id === user.id)) return prev;
            return [...prev, { user_id: user.id, email: user.email }];
          });
          break;

        case 'edit_denied':
          setCurrentUserEditing(false);
          sessionStorage.removeItem(`isEditing_${codeId}`);
          alert('Editing denied. Someone else might be editing.');
          break;

        case 'edit_started':
          if (message.userId !== user.id) {
            setIsLocked(true);
            setActiveEditors(prev => {
              if (prev.some(e => e.user_id === message.userId)) return prev;
              return [...prev, { user_id: message.userId, email: message.userEmail }];
            });
          }
          break;

        case 'edit_stopped':
          if (message.userId === user.id) {
            setCurrentUserEditing(false);
          }

          setActiveEditors(prev => {
            const next = prev.filter(e => e.user_id !== message.userId);
            const stillLocked = next.some(e => e.user_id !== user.id);
            setIsLocked(stillLocked);
            return next;
          });
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      console.log('Collaboration WS disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [codeId, user]);

  /**
   * Attempts to acquire editing lock via WebSocket
   */
  const startEditing = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;

    wsRef.current.send(JSON.stringify({
      type: 'start_edit',
      codeId,
      userId: user.id,
      userEmail: user.email
    }));

    return true;
  }, [codeId, user]);

  /**
   * Releases editing lock via WebSocket
   */
  const stopEditing = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    // We remove the blocking check for hasUnsavedChanges to allow immediate stop.
    // The client should ensure final sync if possible, but we won't block the UI action.

    wsRef.current.send(JSON.stringify({
      type: 'stop_edit',
      codeId,
      userId: user.id
    }));

    // Optimistic update
    setCurrentUserEditing(false);
    setActiveEditors(prev => prev.filter(e => e.user_id !== user.id));
    // Check if locked for others (unlikely if I was the editor, but good for consistency if multiple editors allowed later)
    setIsLocked(false);

    setHasUnsavedChanges(false);
    sessionStorage.removeItem(`isEditing_${codeId}`);
    return true;
  }, [codeId, user, hasUnsavedChanges]);

  /**
   * Removes a collaborator - this is still an administrative action better suited for Supabase or a specific admin WS message.
   * For now, we'll keep the Supabase implementation for "Kicking" a user if that was the intent,
   * OR we can implement a 'kick' message in WS.
   * Given the server code doesn't have 'kick', we will retain the Supabase delete for data persistence,
   * but we might need to inform the WS server to disconnect them or they will just reconnect?
   * 
   * Actually, the `websocket-server.js` doesn't listen to database changes. 
   * So purely deleting from DB won't disconnect them from WS immediately.
   * However, the requirements were "Real time code is not update".
   * Let's stick to fixing sync first.
   * We will leave removeCollaborator using Supabase for now as it affects Permissions which usually persist.
   */
  const removeCollaborator = useCallback(async (collaboratorUserId) => {
    if (!codeId || !supabase || !user || !collaboratorUserId) return false;

    try {
      // ... (Existing Supabase deletion logic)
      // This effectively removes their "Permission" to access the file in the future.
      // But for real-time kicking we might need more. 
      // For this task, we'll just keep the existing DB clean up.
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('collaborators')
        .select('is_owner')
        .eq('code_id', codeId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (ownerError || !ownerCheck?.is_owner) return false;

      const { error: deleteError } = await supabase
        .from('collaborators')
        .delete()
        .eq('code_id', codeId)
        .eq('user_id', collaboratorUserId)
        .eq('is_owner', false);

      if (deleteError) return false;

      return true;

    } catch (error) {
      return false;
    }
  }, [codeId, supabase, user]);

  /**
   * Syncs local code changes to the server via WebSocket
   */
  const syncCode = useCallback(async (code) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (isApplyingRemoteChange.current) return;

    if (code !== lastSyncedCode.current) {
      setHasUnsavedChanges(true); // Technically "unsaved to DB", but "synced to peers"
    }

    wsRef.current.send(JSON.stringify({
      type: 'code_update',
      codeId,
      userId: user.id,
      code
    }));

    lastSyncedCode.current = code;
    // We don't setHasUnsavedChanges(false) here because we still want the user to "Save" to DB eventually.
    // Or we can consider "synced" as good enough for "hasUnsavedChanges" warning? 
    // Usually "Unsaved changes" implies persistence to disk/DB.
    // So we keep hasUnsavedChanges true until explicit Save.

  }, [codeId, user]);

  /**
   * Clears state when codeId becomes null
   */
  useEffect(() => {
    if (!codeId) {
      setCollaborators([]);
      setActiveEditors([]);
      setIsLocked(false);
      setRemoteCode(null);
      setLastSyncedVersion(0);
      setHasUnsavedChanges(false);
      setCurrentUserEditing(false);
      lastSyncedCode.current = null;
    }
  }, [codeId]);

  /**
   * Handles browser close/refresh events
   */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      isWindowClosing.current = true;

      // Try to release lock via beacon or WS close
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'stop_edit',
          codeId,
          userId: user?.id
        }));
      }

      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [codeId, user, hasUnsavedChanges]);

  // Derived state
  const isCollaborator = collaborators.some(c => c.user_id === user?.id);
  const isOwner = false; // logic for isOwner needs to be fetched from DB or passed in. 
  // The WS 'collaborators' msg doesn't necessarily carry 'isOwner' info from DB unless we modify server.
  // For now, allow isOwner to be false or derived differently.
  // We can fetch initial collaborators from DB to get 'isOwner' status and merge it?
  // Let's add a quick initial DB fetch just for permissions if needed.

  // Re-adding a small effect to fetch isOwner status from DB since WS doesn't have it
  const [dbCollaborators, setDbCollaborators] = useState([]);
  useEffect(() => {
    if (!codeId || !supabase) return;
    supabase.from('collaborators').select('*').eq('code_id', codeId).then(({ data }) => {
      if (data) setDbCollaborators(data);
    });
  }, [codeId, supabase]);

  const realIsOwner = dbCollaborators.find(c => c.user_id === user?.id)?.is_owner || false;

  return {
    collaborators, // From WS
    activeEditors, // From WS
    isCollaborator, // Derived
    isOwner: realIsOwner, // From DB
    isLocked, // From WS
    currentUserEditing, // From WS state
    hasUnsavedChanges,
    startEditing,
    stopEditing,
    removeCollaborator,
    syncCode,
    remoteCode,
    totalCollaborators: dbCollaborators,
    lastSyncedVersion
  };
};