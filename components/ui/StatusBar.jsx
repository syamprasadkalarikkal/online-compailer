// components/StatusBar.jsx - Bottom Status Bar
import React from 'react';
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
  return (
    <footer className="bg-gray-800/50 backdrop-blur-sm border-t border-gray-700 px-4 py-2">
      <div className="flex justify-between items-center text-sm text-gray-400">
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

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1 bg-gray-700/50 hover:bg-gray-600/50 rounded transition-colors text-gray-300 hover:text-white"
                >
                  <div className="w-6 h-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs">{user.email}</span>
                  <span className="text-xs text-gray-500">({savedCodes.length})</span>
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
                  onUserUpdate={onUserUpdate}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="flex items-center gap-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors text-white text-xs"
            >
              <User className="w-3 h-3" />
              <span>Sign in</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};