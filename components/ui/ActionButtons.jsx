import React from 'react';
import { Plus, Save, Lock } from 'lucide-react';

export const ActionButtons = ({
  user,
  createNewCode,
  setShowSaveDialog
}) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center md:justify-end md:ml-auto">
      <button
        onClick={createNewCode}
        className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">New</span>
      </button>
      
      {user ? (
        <button
          onClick={() => setShowSaveDialog(true)}
          className="flex items-center gap-1 px-3 py-2 bg-gray-700 text-white hover:bg-gray-600 rounded transition-colors text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">Save</span>
        </button>
      ) : (
        <div className="flex items-center gap-1 px-3 py-2 bg-gray-700/50 text-gray-400 rounded text-sm">
          <Lock className="w-4 h-4" />
          <span className="hidden sm:inline">Login to Save</span>
        </div>
      )}
    </div>
  );
};