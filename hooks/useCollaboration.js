// hooks/useCollaboration.js - WITH EDIT LOCKING (single editor at a time)
import { useState, useEffect, useCallback, useRef } from 'react';

export const useCollaboration = (codeId, user, supabase) => {
  const [collaborators, setCollaborators] = useState([]);
  const [activeEditors, setActiveEditors] = useState([]);
  const [remoteCode, setRemoteCode] = useState(null);
  const [lastSyncedVersion, setLastSyncedVersion] = useState(0);
  const [isLocked, setIsLocked] = useState(false); // Track if someone else is editing
  
  const collaboratorsChannel = useRef(null);
  const editsChannel = useRef(null);
  const heartbeatInterval = useRef(null);
  const isApplyingRemoteChange = useRef(false);
  const isSyncing = useRef(false);

  // Load collaborators for the current code
  const loadCollaborators = useCallback(async () => {
    if (!codeId || !supabase || !user) return;

    try {
      console.log('📥 Loading collaborators for code:', codeId);

      const { data: collaboratorData, error: collabError } = await supabase
        .from('collaborators')
        .select('*')
        .eq('code_id', codeId);

      if (collabError) {
        console.error('Error loading collaborators:', collabError);
        return;
      }

      if (!collaboratorData || collaboratorData.length === 0) {
        console.log('No collaborators found');
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
      console.error('Error in loadCollaborators:', error);
      setCollaborators([]);
      setActiveEditors([]);
      setIsLocked(false);
    }
  }, [codeId, supabase, user]);

  // Start editing - WITH LOCK CHECK
  const startEditing = useCallback(async () => {
    if (!codeId || !supabase || !user) {
      console.error('Missing required params for startEditing');
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
        console.error('Error checking for active editors:', checkError);
        throw checkError;
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
      const { error } = await supabase
        .from('collaborators')
        .update({ 
          is_editing: true,
          last_active: new Date().toISOString()
        })
        .eq('code_id', codeId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating editing status:', error);
        throw error;
      }

      console.log('✅ Successfully started editing');
      await loadLatestVersion();
      startHeartbeat();
      await loadCollaborators();

      return true;
    } catch (error) {
      console.error('Error starting edit:', error);
      return false;
    }
  }, [codeId, supabase, user]);

  // Stop editing
  const stopEditing = useCallback(async () => {
    if (!codeId || !supabase || !user) return;

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
        console.error('Error stopping editing:', error);
      }

      stopHeartbeat();
      await loadCollaborators();
      console.log('✅ Successfully stopped editing');

    } catch (error) {
      console.error('Error stopping edit:', error);
    }
  }, [codeId, supabase, user, loadCollaborators]);

  // Remove collaborator (owner only)
  const removeCollaborator = useCallback(async (collaboratorUserId) => {
    if (!codeId || !supabase || !user) return false;

    try {
      console.log('🗑️ Removing collaborator:', collaboratorUserId);

      // Verify current user is owner
      const { data: ownerCheck } = await supabase
        .from('collaborators')
        .select('is_owner')
        .eq('code_id', codeId)
        .eq('user_id', user.id)
        .single();

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
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('code_id', codeId)
        .eq('user_id', collaboratorUserId);

      if (error) {
        console.error('Error removing collaborator:', error);
        throw error;
      }

      console.log('✅ Collaborator removed');
      await loadCollaborators();
      return true;

    } catch (error) {
      console.error('Error removing collaborator:', error);
      return false;
    }
  }, [codeId, supabase, user, loadCollaborators]);

  // Load latest code version
  const loadLatestVersion = useCallback(async () => {
    if (!codeId || !supabase) return;

    try {
      console.log('📥 Loading latest code version...');

      const { data: latestEdit, error: editError } = await supabase
        .from('code_edits')
        .select('version, content')
        .eq('code_id', codeId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (editError) {
        console.error('Error loading latest edit:', editError);
      }

      if (latestEdit) {
        console.log('✅ Loaded latest version:', latestEdit.version);
        setLastSyncedVersion(latestEdit.version);
        setRemoteCode(latestEdit.content);
      } else {
        const { data: codeData, error: codeError } = await supabase
          .from('saved_codes')
          .select('code')
          .eq('id', codeId)
          .single();

        if (codeError) {
          console.error('Error loading code:', codeError);
        } else if (codeData) {
          console.log('✅ Loaded code from saved_codes');
          setRemoteCode(codeData.code);
          setLastSyncedVersion(0);
        }
      }
    } catch (error) {
      console.error('Error loading latest version:', error);
    }
  }, [codeId, supabase]);

  // Sync code changes
  const syncCode = useCallback(async (code) => {
    if (!codeId || !supabase || !user || isApplyingRemoteChange.current || isSyncing.current) {
      return;
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
      console.log('💾 Syncing code, version:', nextVersion);

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
        console.error('Error inserting edit:', insertError);
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from('saved_codes')
        .update({ 
          code: code,
          updated_at: new Date().toISOString()
        })
        .eq('id', codeId);

      if (updateError) {
        console.error('Error updating saved_codes:', updateError);
      }

      setLastSyncedVersion(nextVersion);
      console.log('✅ Successfully synced code, version:', nextVersion);

    } catch (error) {
      console.error('Error syncing code:', error);
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
      console.log('💔 Heartbeat stopped');
    }
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!codeId || !supabase || !user) return;

    console.log('🔌 Setting up real-time subscriptions for code:', codeId);
    loadCollaborators();
    loadLatestVersion();

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
        console.log('📡 Collaborators channel:', status);
      });

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
          setLastSyncedVersion(payload.new.version);
          setTimeout(() => { isApplyingRemoteChange.current = false; }, 100);
        }
      })
      .subscribe((status) => {
        console.log('📡 Edits channel:', status);
      });

    return () => {
      console.log('🧹 Cleaning up');
      collaboratorsChannel.current?.unsubscribe();
      editsChannel.current?.unsubscribe();
      stopHeartbeat();
      
      if (supabase && user && codeId) {
        supabase
          .from('collaborators')
          .update({ 
            is_editing: false,
            last_active: new Date().toISOString()
          })
          .eq('code_id', codeId)
          .eq('user_id', user.id)
          .then(() => console.log('✅ Cleanup done'))
          .catch(err => console.error('❌ Cleanup error:', err));
      }
    };
  }, [codeId, supabase, user, loadCollaborators, loadLatestVersion, stopHeartbeat]);

  // Page unload handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (supabase && user && codeId && navigator.sendBeacon) {
        const url = `${window.location.origin}/api/stop-editing`;
        const data = JSON.stringify({ codeId, userId: user.id });
        navigator.sendBeacon(url, data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [codeId, user, supabase]);

  const isCollaborator = collaborators.some(c => c.user_id === user?.id);
  const isOwner = collaborators.find(c => c.user_id === user?.id)?.is_owner || false;
  const currentUserEditing = activeEditors.some(e => e.user_id === user?.id);

  return {
    collaborators,
    activeEditors,
    isCollaborator,
    isOwner,
    isLocked, // NEW: indicates if someone else is editing
    currentUserEditing, // NEW: indicates if current user is editing
    startEditing,
    stopEditing,
    removeCollaborator, // NEW: function to remove collaborators
    syncCode,
    remoteCode,
    lastSyncedVersion
  };
};