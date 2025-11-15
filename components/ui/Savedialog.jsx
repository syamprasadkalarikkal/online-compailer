import React from 'react';
import { Save, X } from 'lucide-react';

export const SaveDialog = ({
  showSaveDialog,
  setShowSaveDialog,
  currentCodeId,
  codeTitle,
  setCodeTitle,
  code,
  lang,
  fileExtensions,
  saveCode,
  isSaving,
  saveMessage,
  showSaveMessage
}) => {
  if (!showSaveDialog) return null;

  const handleClose = () => {
    setShowSaveDialog(false);
    setCodeTitle('');
  };

  const handleSave = () => {
    // Add validation
    if (!codeTitle.trim()) {
      return;
    }
    
    if (codeTitle.trim().length > 100) {
      return;
    }
    
    if (!isSaving) {
      saveCode();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && codeTitle.trim() && !isSaving) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div className="w-full bg-gray-800/90 backdrop-blur-sm border-b border-gray-600 shadow-lg">
      <div className="w-full px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Save className="w-5 h-5 text-blue-400" />
            {currentCodeId ? 'Update Code' : 'Save Code'}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={codeTitle}
              onChange={(e) => setCodeTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={currentCodeId ? "Update title..." : "Enter code title..."}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
              maxLength={100}
            />
            {codeTitle.length > 80 && (
              <div className="text-xs text-yellow-400 mt-1">
                {100 - codeTitle.length} characters remaining
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 px-2 py-1 bg-gray-700/50 rounded">
              .{fileExtensions[lang] || 'txt'}
            </span>
            <span className="text-xs text-gray-400">
              {code.split('\n').length} lines
            </span>
            
            <button
              onClick={handleSave}
              disabled={isSaving || !codeTitle.trim() || codeTitle.trim().length > 100}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-sm font-medium"
            >
              {isSaving ? 'Saving...' : currentCodeId ? 'Update' : 'Save'}
            </button>
            
            <button
              onClick={handleClose}
              className="px-3 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
        
        {/* Save Status */}
        {showSaveMessage && (
          <div className="mt-2">
            <div className={`inline-block px-3 py-1 rounded text-sm ${
              saveMessage.includes('Failed') || saveMessage.includes('error') || saveMessage.includes('Please')
                ? 'bg-red-600/20 text-red-300'
                : 'bg-green-600/20 text-green-300'
            }`}>
              {saveMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};