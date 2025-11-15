// components/CollaborationBar.jsx - WITH EDIT LOCKING AND REMOVE FEATURE
import React, { useState, useEffect } from 'react';
import { Users, Edit3, UserCheck, Crown, Lock, X, AlertCircle } from 'lucide-react';

export const CollaborationBar = ({
  collaborators,
  activeEditors,
  isEditing,
  isLocked,
  isOwner,
  startEditing,
  stopEditing,
  removeCollaborator,
  user,
  supabase
}) => {
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);

  // Load user profiles for all collaborators
  useEffect(() => {
    if (!collaborators?.length || !supabase) {
      setLoading(false);
      return;
    }

    // For now, just use the data we have
    setLoading(false);
  }, [collaborators, supabase]);

  const handleEditToggle = async () => {
    try {
      if (isEditing) {
        await stopEditing();
      } else {
        // Check if locked before attempting
        if (isLocked) {
          alert('❌ Someone else is currently editing. Please wait for them to finish.');
          return;
        }
        
        const success = await startEditing();
        if (!success) {
          alert('❌ Unable to start editing. Another user may have just started editing.');
        }
      }
    } catch (error) {
      console.error('Error toggling edit mode:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleRemoveCollaborator = async (collaboratorUserId) => {
    if (!removeCollaborator) return;
    
    const success = await removeCollaborator(collaboratorUserId);
    if (success) {
      alert('✅ Collaborator removed successfully');
      setShowRemoveConfirm(null);
    } else {
      alert('❌ Failed to remove collaborator');
    }
  };

  const currentUserIsEditing = activeEditors?.some(e => e.user_id === user?.id) || false;
  const validCollaborators = collaborators?.filter(c => c.user_id) || [];
  const whoIsEditing = activeEditors?.find(e => e.user_id !== user?.id);

  if (loading || validCollaborators.length === 0) {
    return null;
  }

  // Only show if there are multiple collaborators (actual collaboration)
  if (validCollaborators.length === 1) {
    return null;
  }

  return (
    <div className="relative z-50 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 backdrop-blur-sm border-b border-purple-700/50 px-4 py-3 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Left side - Collaborators info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-purple-300" />
            <span className="font-medium">
              {validCollaborators.length} Collaborator{validCollaborators.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Collaborators avatars */}
          <div className="flex items-center gap-2">
            {validCollaborators.map((collaborator, index) => {
              const isCurrentUser = collaborator.user_id === user?.id;
              const isActiveEditor = activeEditors?.some(e => e.user_id === collaborator.user_id) || false;
              
              return (
                <div
                  key={collaborator.user_id}
                  className={`relative group ${index > 0 ? '-ml-2' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all overflow-hidden ${
                    isCurrentUser
                      ? 'bg-green-500 border-green-300 text-white'
                      : isActiveEditor
                      ? 'bg-yellow-500 border-yellow-300 text-gray-900'
                      : 'bg-blue-500 border-blue-300 text-white'
                  }`}>
                    {(collaborator.name?.charAt(0) || collaborator.email?.charAt(0) || '?').toUpperCase()}
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {collaborator.name || collaborator.email || 'Unknown'}
                    {isCurrentUser && ' (You)'}
                    {isActiveEditor && ' - Editing'}
                    {collaborator.is_owner && (
                      <Crown className="inline-block w-3 h-3 ml-1 text-yellow-400" />
                    )}
                  </div>

                  {/* Editing indicator */}
                  {isActiveEditor && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-purple-900 animate-pulse" />
                  )}

                  {/* Owner badge */}
                  {collaborator.is_owner && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-purple-900 flex items-center justify-center">
                      <Crown className="w-2 h-2 text-purple-900" />
                    </div>
                  )}

                  {/* Remove button (owner only, can't remove self or other owners) */}
                  {isOwner && !isCurrentUser && !collaborator.is_owner && (
                    <button
                      onClick={() => setShowRemoveConfirm(collaborator.user_id)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-purple-900 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                      title="Remove collaborator"
                    >
                      <X className="w-2 h-2 text-white" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active editors status */}
          {activeEditors && activeEditors.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-yellow-200 text-sm">
              <Edit3 className="w-3 h-3" />
              <span>
                {whoIsEditing ? `${whoIsEditing.name || 'Someone'} is editing` : 'You are editing'}
              </span>
            </div>
          )}

          {/* Locked indicator */}
          {isLocked && !currentUserIsEditing && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-200 text-sm">
              <Lock className="w-3 h-3" />
              <span>Locked</span>
            </div>
          )}
        </div>

        {/* Right side - Edit control */}
        <div className="flex items-center gap-3">
          {currentUserIsEditing && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-200 text-sm">
              <UserCheck className="w-4 h-4" />
              <span>You're editing</span>
            </div>
          )}

          <button
            onClick={handleEditToggle}
            disabled={!user || (isLocked && !currentUserIsEditing)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              currentUserIsEditing
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : isLocked
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed opacity-50'
                : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed'
            }`}
          >
            {currentUserIsEditing ? (
              <>
                <Edit3 className="w-4 h-4" />
                <span>Stop Editing</span>
              </>
            ) : isLocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Locked</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4" />
                <span>Start Editing</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info message */}
      <div className="mt-2 text-xs text-purple-200 flex items-start gap-2">
        {isLocked && !currentUserIsEditing ? (
          <>
            <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>Someone else is editing. You can view the code but cannot edit until they stop.</span>
          </>
        ) : currentUserIsEditing ? (
          <>
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>✓ You can edit the code. Changes are synced in real-time. Others cannot edit while you're editing.</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>Click "Start Editing" to begin. Only one person can edit at a time to prevent conflicts.</span>
          </>
        )}
      </div>

      {/* Remove Confirmation Dialog */}
      {showRemoveConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowRemoveConfirm(null)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl p-6 z-50 max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Remove Collaborator</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to remove this collaborator? They will lose access to this code immediately.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveCollaborator(showRemoveConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};