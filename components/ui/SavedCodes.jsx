// components/SavedCodes.jsx - Enhanced with ownership indicators
import React from 'react';
import { FileText, Edit3, Trash2, Code, Crown, Users } from 'lucide-react';

export const SavedCodes = ({
  savedCodes,
  loadCode,
  editingCodeName,
  setEditingCodeName,
  renameCode,
  deleteCode,
  fileExtensions,
  setShowUserMenu,
  setActiveView
}) => {
  const handleRename = (codeId, newName) => {
    if (newName.trim()) {
      renameCode(codeId, newName);
      setEditingCodeName(null);
    } else {
      setEditingCodeName(null);
    }
  };

  // Separate owned and shared codes
  const ownedCodes = savedCodes.filter(c => c.is_owned);
  const sharedCodes = savedCodes.filter(c => c.is_shared);

  return (
    <div>
      {/* Header with back button */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <button
          onClick={() => setActiveView('profile')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h3 className="text-gray-900 font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Saved Codes
          </h3>
          <p className="text-gray-600 text-xs">
            {savedCodes.length} {savedCodes.length === 1 ? 'code' : 'codes'} 
            ({ownedCodes.length} owned, {sharedCodes.length} shared)
          </p>
        </div>
      </div>

      {/* Saved codes list */}
      <div className="max-h-80 overflow-y-auto">
        {savedCodes.length > 0 ? (
          <div className="p-3 space-y-2">
            {/* Owned Codes Section */}
            {ownedCodes.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-50 rounded">
                  <Crown className="w-3 h-3 text-yellow-600" />
                  <span>My Codes ({ownedCodes.length})</span>
                </div>
                {ownedCodes.map((savedCode) => (
                  <CodeItem
                    key={savedCode.id}
                    savedCode={savedCode}
                    editingCodeName={editingCodeName}
                    setEditingCodeName={setEditingCodeName}
                    handleRename={handleRename}
                    loadCode={loadCode}
                    setShowUserMenu={setShowUserMenu}
                    setActiveView={setActiveView}
                    deleteCode={deleteCode}
                    fileExtensions={fileExtensions}
                    isOwned={true}
                  />
                ))}
              </>
            )}

            {/* Shared Codes Section */}
            {sharedCodes.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-50 rounded mt-3">
                  <Users className="w-3 h-3 text-purple-600" />
                  <span>Shared With Me ({sharedCodes.length})</span>
                </div>
                {sharedCodes.map((savedCode) => (
                  <CodeItem
                    key={savedCode.id}
                    savedCode={savedCode}
                    editingCodeName={editingCodeName}
                    setEditingCodeName={setEditingCodeName}
                    handleRename={handleRename}
                    loadCode={loadCode}
                    setShowUserMenu={setShowUserMenu}
                    setActiveView={setActiveView}
                    deleteCode={deleteCode}
                    fileExtensions={fileExtensions}
                    isOwned={false}
                  />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Code className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-700 text-sm font-medium mb-1">No saved codes yet</p>
            <p className="text-gray-500 text-xs">Start coding and save your work!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Separate component for code item
const CodeItem = ({
  savedCode,
  editingCodeName,
  setEditingCodeName,
  handleRename,
  loadCode,
  setShowUserMenu,
  setActiveView,
  deleteCode,
  fileExtensions,
  isOwned
}) => {
  return (
    <div className={`p-3 rounded-lg hover:bg-gray-50 transition-all group border ${
      isOwned 
        ? 'border-transparent hover:border-gray-200' 
        : 'border-purple-100 hover:border-purple-200 bg-purple-50/30'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {editingCodeName === savedCode.id ? (
            <input
              type="text"
              defaultValue={savedCode.title}
              className="w-full text-sm bg-white text-gray-900 px-2 py-1 rounded border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              onBlur={(e) => handleRename(savedCode.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(savedCode.id, e.target.value);
                else if (e.key === 'Escape') setEditingCodeName(null);
              }}
              autoFocus
              disabled={!isOwned}
            />
          ) : (
            <button
              onClick={() => {
                loadCode(savedCode);
                setShowUserMenu(false);
                setActiveView('profile');
              }}
              className="w-full text-left group-hover:text-indigo-600 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-gray-900 text-sm font-medium truncate flex-1">
                  {savedCode.title}
                </h4>
                {isOwned ? (
                  <Crown className="w-3 h-3 text-yellow-600 flex-shrink-0" title="You own this code" />
                ) : (
                  <Users className="w-3 h-3 text-purple-600 flex-shrink-0" title="Shared with you" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">
                  {savedCode.language}
                </span>
                <span>•</span>
                <span className="font-mono">
                  .{savedCode.extension || fileExtensions[savedCode.language]}
                </span>
                <span>•</span>
                <span>{new Date(savedCode.updated_at).toLocaleDateString()}</span>
              </div>
            </button>
          )}
        </div>
        <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwned && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCodeName(savedCode.id);
                }}
                className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                title="Rename"
              >
                <Edit3 className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to delete this code?')) {
                    deleteCode(savedCode.id);
                  }
                }}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};