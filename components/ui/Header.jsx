// components/Header.jsx
import React from 'react';
import { Zap, Menu, X } from 'lucide-react';

export const Header = ({ 
  user, 
  currentCodeId, 
  codeTitle, 
  isMobileMenuOpen, 
  setIsMobileMenuOpen 
}) => {
  return (
    <header className="bg-white border-b border-gray-700">
      <div className="w-full px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-8 h-8 text-yellow-400" />
              <h1 className="text-2xl font-bold text-black">Collaborative Online Compiler</h1>
            </div>
            <div className="hidden sm:block text-gray-400">
              Interactive multi-language editor
            </div>
            {currentCodeId && (
              <span className="hidden md:block text-sm text-gray-300 bg-gray-700/50 px-2 py-1 rounded">
                Editing: {codeTitle || 'Untitled'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-white p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};