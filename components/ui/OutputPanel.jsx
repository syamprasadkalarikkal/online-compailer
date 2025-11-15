// components/OutputPanel.jsx
import React from 'react';
import { Terminal } from 'lucide-react';

export const OutputPanel = ({ output, execTime, isRunning }) => {
  return (
    <div className="bg-gray-800/30 backdrop-blur-sm flex flex-col h-full">
      <div className="flex items-center justify-between p-3 bg-gray-800/50 border-b border-gray-700">
        <div className="flex items-center gap-2 text-white">
          <Terminal className="w-5 h-5 text-green-400" />
          <span className="font-medium">Output</span>
          {execTime > 0 && (
            <span className="text-sm text-gray-400">({execTime}ms)</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-2 text-yellow-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              <span className="text-sm">Running</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 bg-gray-900 overflow-auto min-h-0">
        {output || !isRunning ? (
          <pre className="text-gray-100 font-mono text-sm whitespace-pre-wrap">
            {output || "Click 'Run' to execute your code..."}
          </pre>
        ) : (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin"></div>
            <span>Preparing execution environment...</span>
          </div>
        )}
      </div>
    </div>
  );
};