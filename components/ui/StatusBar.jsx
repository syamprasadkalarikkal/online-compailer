// components/StatusBar.jsx - Bottom Status Bar with Profile Picture
import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { CollaborationRequests } from './CollaborationRequests';
import { CollaborationButton } from './CollaborationButton';

export const StatusBar = ({
  lang,
  code,
  isRunning,
  execTime,
  user,
  savedCodes,
  showUserMenu,
  setShowUserMenu,
  router,
  loadCode,
  editingCodeName,
  setEditingCodeName,
  renameCode,
  deleteCode,
  fileExtensions,
  handleLogout,
  supabase,
  onUserUpdate = () => {},
  onAcceptCollaboration,
  currentCodeId,
  codeTitle
}) => {
  const [profilePicture, setProfilePicture] = useState(null);
  const [userName, setUserName] = useState('');

  // Load user profile data
  useEffect(() => {
    if (user && supabase) {
      loadUserProfile();
    }
  }, [user?.id, supabase]);

  const loadUserProfile = async () => {
    if (!supabase || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setProfilePicture(data.avatar_url);
        setUserName(data.name);
      } else {
        // Fallback to user email
        setUserName(user.email?.split('@')[0] || 'User');
        setProfilePicture(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setUserName(user.email?.split('@')[0] || 'User');
      setProfilePicture(null);
    }
  };

  // Reload profile when menu opens to ensure fresh data
  useEffect(() => {
    if (showUserMenu && user && supabase) {
      loadUserProfile();
    }
  }, [showUserMenu]);

  const handleUserUpdateWrapper = () => {
    loadUserProfile();
    onUserUpdate();
  };

  return (
    <footer className="bg-white backdrop-blur-sm border-t border-gray-600 px-4 py-2">
      <div className="flex justify-between items-center text-sm text-black">
        <div className="flex items-center gap-4">
          <span>Language: {lang}</span>
          <span>Lines: {code.split('\n').length}</span>
          <span>Characters: {code.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <span className="text-yellow-400">Executing...</span>
            ) : (
              <span className="text-green-400">Ready</span>
            )}
            {execTime > 0 && <span>Last run: {execTime}ms</span>}
          </div>
          
          {user ? (
            <div className="flex items-center gap-3">
              {/* Collaboration Button */}
              <CollaborationButton
                currentCodeId={currentCodeId}
                codeTitle={codeTitle}
                user={user}
                supabase={supabase}
              />

              {/* Collaboration Requests */}
              <CollaborationRequests
                user={user}
                supabase={supabase}
                onAcceptRequest={onAcceptCollaboration}
              />

              {/* User Menu with Profile Picture */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1 bg-white rounded transition-colors text-black hover:bg-gray-100"
                  title={userName}
                >
                  {profilePicture ? (
                    <img 
                      src={profilePicture}
                      alt={userName}
                      className="w-6 h-6 rounded-full object-cover border border-gray-300"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-6 h-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center ${profilePicture ? 'hidden' : 'flex'}`}
                  >
                    <User className="w-3 h-3 text-white" />
                  </div>
                </button>
                
                <UserMenu
                  showUserMenu={showUserMenu}
                  setShowUserMenu={setShowUserMenu}
                  user={user}
                  savedCodes={savedCodes}
                  loadCode={loadCode}
                  editingCodeName={editingCodeName}
                  setEditingCodeName={setEditingCodeName}
                  renameCode={renameCode}
                  deleteCode={deleteCode}
                  fileExtensions={fileExtensions}
                  handleLogout={handleLogout}
                  supabase={supabase}
                  onUserUpdate={handleUserUpdateWrapper}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 px-3 py-1 bg-black hover:text-gray-300 rounded transition-colors text-white text-xs"
            >
              <User className="w-3 h-3" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}