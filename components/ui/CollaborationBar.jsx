// components/CollaborationBar.jsx - PROFESSIONAL UI WITH PROFILE IMAGES - UPDATED
import React, { useState, useEffect } from 'react';
import { Users, Edit3, UserCheck, Crown, Lock, X, AlertCircle, Eye } from 'lucide-react';

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

  // Load user profiles with avatars for all collaborators AND active editors
  useEffect(() => {
    const loadProfiles = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        // Collect all unique user IDs from both collaborators and activeEditors
        const collabUserIds = collaborators?.map(c => c.user_id).filter(Boolean) || [];
        const editorUserIds = activeEditors?.map(e => e.user_id).filter(Boolean) || [];
        const allUserIds = [...new Set([...collabUserIds, ...editorUserIds])];
        
        if (allUserIds.length === 0) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('user_id, name, avatar_url, email')
          .in('user_id', allUserIds);

        if (!error && data) {
          const profilesMap = {};
          data.forEach(profile => {
            profilesMap[profile.user_id] = profile;
          });
          setUserProfiles(profilesMap);
        }
      } catch (error) {
        console.error('Error loading profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfiles();
    
    // Reload profiles when collaborators or activeEditors change
  }, [collaborators, activeEditors, supabase]);

  const handleEditToggle = async () => {
    try {
      if (isEditing) {
        await stopEditing();
      } else {
        if (isLocked) {
          alert(' Someone else is currently editing. Please wait for them to finish.');
          return;
        }
        
        const success = await startEditing();
        
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
      alert(' Collaborator removed successfully');
      setShowRemoveConfirm(null);
    } else {
      alert('Failed to remove collaborator');
    }
  };

  const getCollaboratorProfile = (collaborator) => {
    return userProfiles[collaborator.user_id] || {
      name: collaborator.name || collaborator.email,
      avatar_url: null,
      email: collaborator.email
    };
  };

  const getInitials = (collaborator) => {
    const profile = getCollaboratorProfile(collaborator);
    const name = profile.name || profile.email || '?';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const currentUserIsEditing = activeEditors?.some(e => e.user_id === user?.id) || false;
  const validCollaborators = collaborators?.filter(c => c.user_id) || [];
  const whoIsEditing = activeEditors?.find(e => e.user_id !== user?.id);

  if (loading || validCollaborators.length === 0) {
    return null;
  }

  // Only show if there are multiple collaborators
  if (validCollaborators.length === 1) {
    return null;
  }

  return (
    <div className="relative z-50 bg-white backdrop-blur-sm border-b border-gray-600">
      <div className="max-w-screen-2xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left side - Collaborators Section */}
          <div className="flex items-center gap-6">
            {/* Collaborators Count Badge */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <Users className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="text-sm font-semibold text-black">
                  {validCollaborators.length} Collaborator{validCollaborators.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400">Active on this code</p>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-12 w-px bg-purple-600/50" />

            {/* Collaborators Avatars */}
            <div className="flex items-center">
              <div className="flex items-center -space-x-3">
                {validCollaborators.map((collaborator, index) => {
                  const isCurrentUser = collaborator.user_id === user?.id;
                  const isActiveEditor = activeEditors?.some(e => e.user_id === collaborator.user_id) || false;
                  const profile = getCollaboratorProfile(collaborator);
                  
                  return (
                    <div
                      key={collaborator.user_id}
                      className="relative group"
                      style={{ zIndex: validCollaborators.length - index }}
                    >
                      {/* Avatar */}
                      <div className={`relative w-11 h-11 rounded-full ring-3 transition-all duration-200 ${
                        isCurrentUser
                          ? 'ring-emerald-400 hover:ring-emerald-500'
                          : isActiveEditor
                          ? 'ring-amber-400 hover:ring-amber-500'
                          : 'ring-white hover:ring-gray-200'
                      }`}>
                        {profile.avatar_url ? (
                          <img 
                            src={profile.avatar_url} 
                            alt={profile.name || profile.email}
                            className="w-full h-full rounded-full object-cover bg-gray-100"
                            key={`${collaborator.user_id}-${isActiveEditor}`}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallbackDiv = e.target.nextSibling;
                              if (fallbackDiv) {
                                fallbackDiv.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-full h-full rounded-full flex items-center justify-center text-sm font-bold ${
                            profile.avatar_url ? 'hidden' : 'flex'
                          } ${
                            isCurrentUser
                              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
                              : isActiveEditor
                              ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
                              : 'bg-gradient-to-br from-indigo-400 to-purple-600 text-white'
                          }`}
                        >
                          {getInitials(collaborator)}
                        </div>
                        
                        {/* Status Indicator */}
                        {isActiveEditor && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full border-2 border-white animate-pulse flex items-center justify-center">
                            <Edit3 className="w-2 h-2 text-white" />
                          </div>
                        )}

                        {/* Owner Crown */}
                        {collaborator.is_owner && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                            <Crown className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}

                        {/* Remove Button (owner only) */}
                        {isOwner && !isCurrentUser && !collaborator.is_owner && (
                          <button
                            onClick={() => setShowRemoveConfirm(collaborator.user_id)}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full border-2 border-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm"
                            title="Remove collaborator"
                          >
                            <X className="w-2.5 h-2.5 text-white" />
                          </button>
                        )}
                      </div>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50">
                        <div className="font-semibold">{profile.name || profile.email}</div>
                        {isCurrentUser && <div className="text-gray-300">You</div>}
                        {isActiveEditor && !isCurrentUser && <div className="text-amber-300">Currently editing</div>}
                        {!isActiveEditor && !isCurrentUser && <div className="text-gray-300">Viewing</div>}
                        {collaborator.is_owner && <div className="text-yellow-300 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Owner
                        </div>}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right side - Status & Actions */}
          <div className="flex items-center gap-3">
            {/* Status Badge */}
            {currentUserIsEditing ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-400/50 rounded-lg backdrop-blur-sm">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <UserCheck className="w-4 h-4 text-emerald-300" />
                <span className="text-sm font-medium text-emerald-200">You're editing</span>
              </div>
            ) : isLocked && whoIsEditing ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-400/50 rounded-lg backdrop-blur-sm">
                <Edit3 className="w-4 h-4 text-yellow-300 animate-pulse" />
                <span className="text-sm font-medium text-yellow-200">
                  {userProfiles[whoIsEditing.user_id]?.name || 'Someone'} is editing
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-500 border border-gray-200 rounded-lg backdrop-blur-sm">
                <Eye className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-white">Viewing mode</span>
              </div>
            )}

            {/* Edit Control Button */}
            <button
              onClick={handleEditToggle}
              disabled={!user || (isLocked && !currentUserIsEditing)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 shadow-lg ${
                currentUserIsEditing
                  ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:shadow-xl hover:shadow-red-500/50'
                  : isLocked
                  ? 'bg-gray-700/50 text-gray-black cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-xl hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed'
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

      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
            onClick={() => setShowRemoveConfirm(null)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-50 max-w-md w-full mx-4">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Remove Collaborator</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to remove this collaborator? They will immediately lose access to this code.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveCollaborator(showRemoveConfirm)}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg text-white font-semibold transition-all shadow-sm shadow-red-200"
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