// hooks/useCollaboration.js - Enhanced with unsaved changes tracking
import { useState, useEffect, useCallback, useRef } from 'react';

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

  // Load collaborators for the current code
  const loadCollaborators = useCallback(async () => {
    if (!codeId || !supabase || !user) {
      console.log('Skipping loadCollaborators: missing requirements', { 
        codeId: !!codeId, 
        supabase: !!supabase, 
        user: !!user 
      });
      return;
    }

    try {
      console.log('📥 Loading collaborators for code:', codeId);

      const { data: collaboratorData, error: collabError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('code_id', codeId);

      if (collabError) {
        console.error('Error loading collaborators:', {
          message: collabError.message,
          details: collabError.details,
          hint: collabError.hint,
          code: collabError.code
        });
        setCollaborators([]);
        setActiveEditors([]);
        setIsLocked(false);
        return;
      }

      if (!collaboratorData || collaboratorData.length === 0) {
        console.log('No collaborators found for code:', codeId);
        setCollaborators([]);
        setActiveEditors([]);
        setIsLocked(false);
        return;
      }

      console.log('✅ Found collaborators:', collaboratorData.length);

      // Format collaborators
      const formattedCollaborators = collaboratorData.map((c, index) => ({
        user_id: c.user_id,
        email: c.user_id === user.id ? user.email : `User ${index + 1}`,
        name: c.user_id === user.id ? user.email : `User ${index + 1}`,
        is_owner: c.is_owner,
        is_editing: c.is_editing,
        last_active: c.last_active
      }));

      setCollaborators(formattedCollaborators);

      // Get list of active editors
      const editors = formattedCollaborators.filter(c => c.is_editing);
      setActiveEditors(editors);

      // Check if code is locked (someone else is editing)
      const someoneElseEditing = editors.some(e => e.user_id !== user.id);
      setIsLocked(someoneElseEditing);

      console.log('✅ Collaborators loaded:', formattedCollaborators.length);
      console.log('✅ Active editors:', editors.length);
      console.log('🔒 Code locked:', someoneElseEditing);

    } catch (error) {
      console.error('Exception in loadCollaborators:', error);
      setCollaborators([]);
      setActiveEditors([]);
      setIsLocked(false);
    }
  }, [codeId, supabase, user]);

  // Start editing - WITH LOCK CHECK
  const startEditing = useCallback(async () => {
    if (!codeId || !supabase || !user) {
      console.error('Missing required params for startEditing', {
        codeId: !!codeId,
        supabase: !!supabase,
        user: !!user
      });
      return false;
    }

    try {
      console.log('🔓 Attempting to start editing for user:', user.id);

      // CRITICAL: Check if anyone else is currently editing
      const { data: existingEditors, error: checkError } = await supabase
        .from('collaborators')
        .select('user_id, is_editing')
        .eq('code_id', codeId)
        .eq('is_editing', true);

      if (checkError) {
        console.error('Error checking for active editors:', {
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint,
          code: checkError.code
        });
        return false;
      }

      // If someone else is editing, deny access
      if (existingEditors && existingEditors.length > 0) {
        const otherUserEditing = existingEditors.some(e => e.user_id !== user.id);
        if (otherUserEditing) {
          console.log('❌ Code is locked by another user');
          return false;
        }
      }

      // Proceed to mark as editing
      const { error: updateError } = await supabase
        .from('collaborators')
        .update({ 
          is_editing: true,
          last_active: new Date().toISOString()
        })
        .eq('code_id', codeId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating editing status:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
        return false;
      }

      console.log('✅ Successfully started editing');
      await loadLatestVersion();
      setHasUnsavedChanges(false);
      startHeartbeat();
      await loadCollaborators();

      return true;
    } catch (error) {
      console.error('Exception starting edit:', error);
      return false;
    }
  }, [codeId, supabase, user]);

  // Stop editing
  const stopEditing = useCallback(async () => {
    if (!codeId || !supabase || !user) {
      console.log('Cannot stop editing: missing requirements');
      return;
    }

    // Don't allow stopping if there are unsaved changes
    if (hasUnsavedChanges) {
      console.log('Cannot stop editing: unsaved changes exist');
      return false;
    }

    try {
      console.log('🔒 Stopping editing for user:', user.id);

      const { error } = await supabase
        .from('collaborators')
        .update({ 
          is_editing: false,
          last_active: new Date().toISOString()
        })
        .eq('code_id', codeId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error stopping editing:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return false;
      } else {
        console.log('✅ Successfully stopped editing');
      }

      stopHeartbeat();
      setHasUnsavedChanges(false);
      await loadCollaborators();
      return true;

    } catch (error) {
      console.error('Exception stopping edit:', error);
      return false;
    }
  }, [codeId, supabase, user, hasUnsavedChanges, loadCollaborators]);

  // Remove collaborator (owner only)
  const removeCollaborator = useCallback(async (collaboratorUserId) => {
    if (!codeId || !supabase || !user) {
      console.error('Cannot remove collaborator: missing requirements');
      return false;
    }

    if (!collaboratorUserId) {
      console.error('Invalid collaboratorUserId');
      return false;
    }

    try {
      console.log('🗑️ Removing collaborator:', collaboratorUserId);

      // Verify current user is owner
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('collaborators')
        .select('is_owner')
        .eq('code_id', codeId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (ownerError) {
        console.error('Error checking ownership:', {
          message: ownerError.message,
          details: ownerError.details,
          hint: ownerError.hint,
          code: ownerError.code
        });
        return false;
      }

      if (!ownerCheck?.is_owner) {
        console.error('❌ Only owner can remove collaborators');
        return false;
      }

      // Can't remove yourself if you're the owner
      if (collaboratorUserId === user.id) {
        console.error('❌ Owner cannot remove themselves');
        return false;
      }

      // Remove the collaborator
      const { error: deleteError } = await supabase
        .from('collaborators')
        .delete()
        .eq('code_id', codeId)
        .eq('user_id', collaboratorUserId)
        .eq('is_owner', false);

      if (deleteError) {
        console.error('Error removing collaborator:', {
          message: deleteError.message,
          details: deleteError.details,
          hint: deleteError.hint,
          code: deleteError.code
        });
        return false;
      }

      console.log('✅ Collaborator removed successfully');
      await loadCollaborators();
      return true;

    } catch (error) {
      console.error('Exception removing collaborator:', error);
      return false;
    }
  }, [codeId, supabase, user, loadCollaborators]);

  // Load latest code version
  const loadLatestVersion = useCallback(async () => {
    if (!codeId || !supabase) {
      console.log('Skipping loadLatestVersion: missing codeId or supabase');
      return;
    }

    try {
      console.log('📥 Loading latest code version for:', codeId);

      // Try to get the latest edit from code_edits table
      const { data: latestEdit, error: editError } = await supabase
        .from('code_edits')
        .select('version, content')
        .eq('code_id', codeId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (editError) {
        console.error('Error loading latest edit:', {
          message: editError.message,
          details: editError.details,
          hint: editError.hint,
          code: editError.code
        });
      }

      if (latestEdit) {
        console.log('✅ Loaded latest version from code_edits:', latestEdit.version);
        setLastSyncedVersion(latestEdit.version);
        setRemoteCode(latestEdit.content);
        lastSyncedCode.current = latestEdit.content;
      } else {
        // Fallback to saved_codes table
        console.log('No edits found, loading from saved_codes');
        
        const { data: codeData, error: codeError } = await supabase
          .from('saved_codes')
          .select('code')
          .eq('id', codeId)
          .maybeSingle();

        if (codeError) {
          console.error('Error loading code:', {
            message: codeError.message,
            details: codeError.details,
            hint: codeError.hint,
            code: codeError.code,
            codeId: codeId
          });
          return;
        }

        if (!codeData) {
          console.warn('Code not found with id:', codeId);
          return;
        }

        console.log('✅ Loaded code from saved_codes');
        setRemoteCode(codeData.code);
        lastSyncedCode.current = codeData.code;
        setLastSyncedVersion(0);
      }
    } catch (error) {
      console.error('Exception loading latest version:', error);
    }
  }, [codeId, supabase]);

  // Sync code changes
  const syncCode = useCallback(async (code) => {
    if (!codeId || !supabase || !user) {
      console.log('Skipping syncCode: missing requirements');
      return;
    }

    if (isApplyingRemoteChange.current || isSyncing.current) {
      console.log('Skipping syncCode: already syncing or applying remote change');
      return;
    }

    // Track if changes are different from last synced version
    if (code !== lastSyncedCode.current) {
      setHasUnsavedChanges(true);
    }

    isSyncing.current = true;

    try {
      // Get the latest version
      const { data: lastEdit, error: versionError } = await supabase
        .from('code_edits')
        .select('version')
        .eq('code_id', codeId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionError) {
        console.error('Error getting latest version:', versionError);
      }

      const nextVersion = (lastEdit?.version || 0) + 1;
      console.log('💾 Syncing code, version:', nextVersion);

      // Insert new edit
      const { error: insertError } = await supabase
        .from('code_edits')
        .insert({
          code_id: codeId,
          user_id: user.id,
          content: code,
          version: nextVersion,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting edit:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        throw insertError;
      }

      // Update saved_codes table
      const { error: updateError } = await supabase
        .from('saved_codes')
        .update({ 
          code: code,
          updated_at: new Date().toISOString()
        })
        .eq('id', codeId);

      if (updateError) {
        console.error('Error updating saved_codes:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        });
      }

      setLastSyncedVersion(nextVersion);
      lastSyncedCode.current = code;
      setHasUnsavedChanges(false);
      console.log('✅ Successfully synced code, version:', nextVersion);

    } catch (error) {
      console.error('Exception syncing code:', error);
    } finally {
      isSyncing.current = false;
    }
  }, [codeId, supabase, user]);

  // Heartbeat
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
        console.error('Heartbeat error:', error);
      }
    }, 15000);

    console.log('💓 Heartbeat started');
  }, [codeId, supabase, user]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
      console.log('💓 Heartbeat stopped');
    }
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!codeId || !supabase || !user) {
      console.log('Skipping subscription setup: missing requirements');
      return;
    }

    console.log('🔌 Setting up real-time subscriptions for code:', codeId);
    
    // Initial load
    loadCollaborators();
    loadLatestVersion();

    // Subscribe to collaborator changes
    collaboratorsChannel.current = supabase
      .channel(`collaborators:${codeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collaborators',
        filter: `code_id=eq.${codeId}`
      }, (payload) => {
        console.log('👥 Collaborator change:', payload.eventType);
        loadCollaborators();
      })
      .subscribe((status) => {
        console.log('📡 Collaborators channel status:', status);
      });

    // Subscribe to code edits
    editsChannel.current = supabase
      .channel(`edits:${codeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'code_edits',
        filter: `code_id=eq.${codeId}`
      }, (payload) => {
        console.log('✏️ Code edit from:', payload.new.user_id);
        
        if (payload.new.user_id !== user.id) {
          console.log('📝 Applying remote change');
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
      .subscribe((status) => {
        console.log('📡 Edits channel status:', status);
      });

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up subscriptions and heartbeat');
      
      if (collaboratorsChannel.current) {
        supabase.removeChannel(collaboratorsChannel.current);
        collaboratorsChannel.current = null;
      }
      
      if (editsChannel.current) {
        supabase.removeChannel(editsChannel.current);
        editsChannel.current = null;
      }
      
      stopHeartbeat();
      
      // Mark as not editing on cleanup ONLY if window is actually closing
      if (supabase && user && codeId && isWindowClosing.current) {
        supabase
          .from('collaborators')
          .update({ 
            is_editing: false,
            last_active: new Date().toISOString()
          })
          .eq('code_id', codeId)
          .eq('user_id', user.id)
          .then(() => console.log('✅ Cleanup: stopped editing'))
          .catch(err => console.error('❌ Cleanup error:', err));
      }
    };
  }, [codeId, supabase, user, loadCollaborators, loadLatestVersion, stopHeartbeat]);

  // Page unload handler - ONLY for window close, NOT refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (supabase && user && codeId) {
        // Check if this is a real close (not refresh)
        // Set flag for cleanup
        isWindowClosing.current = true;
        
        // Use sendBeacon for reliable cleanup on page close
        if (navigator.sendBeacon) {
          const url = `${window.location.origin}/api/stop-editing`;
          const data = JSON.stringify({ codeId, userId: user.id });
          navigator.sendBeacon(url, data);
        }
        
        // Warn if there are unsaved changes
        if (hasUnsavedChanges) {
          e.preventDefault();
          e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          return e.returnValue;
        }
      }
    };

    // Detect if it's a refresh vs close
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Page is being hidden, but not necessarily closed
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

  // Calculate derived states
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