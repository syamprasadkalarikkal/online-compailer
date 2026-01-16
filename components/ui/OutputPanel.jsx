// components/ui/OutputPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Edit3, X, FileText, AlertCircle } from 'lucide-react';

export const OutputPanel = ({ 
  output, 
  execTime, 
  isRunning,
  onInputsChange,
  savedInputs = ''
}) => {
  const [showInputEditor, setShowInputEditor] = useState(false);
  const [inputText, setInputText] = useState(savedInputs || '');
  const outputEndRef = useRef(null);

  const hasInputs = savedInputs && savedInputs.trim().length > 0;

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // Sync inputText with savedInputs when savedInputs changes externally
  useEffect(() => {
    if (!showInputEditor) {
      setInputText(savedInputs || '');
    }
  }, [savedInputs, showInputEditor]);

  const handleSaveInputs = () => {
    if (onInputsChange && typeof onInputsChange === 'function') {
      onInputsChange(inputText);
    }
    setShowInputEditor(false);
  };

  const handleClearInputs = () => {
    setInputText('');
    if (onInputsChange && typeof onInputsChange === 'function') {
      onInputsChange('');
    }
    setShowInputEditor(false);
  };

  const handleOpenEditor = () => {
    // Load current saved inputs when opening editor
    setInputText(savedInputs || '');
    setShowInputEditor(true);
  };

  const handleCancel = () => {
    // Reset to saved inputs on cancel
    setInputText(savedInputs || '');
    setShowInputEditor(false);
  };

  return (
    <div className="bg-white backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-600">
        <div className="flex items-center gap-2 text-gray-900">
          <Terminal className="w-5 h-5 text-green-600" />
          <span className="font-medium">Output</span>
          {execTime > 0 && (
            <span className="text-sm text-gray-500">({execTime}ms)</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenEditor}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 text-sm ${
              hasInputs 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={hasInputs ? "Modify program inputs" : "Set program inputs"}
          >
            <Edit3 className="w-4 h-4" />
            {hasInputs ? 'Edit Inputs' : 'Set Inputs'}
          </button>

          {hasInputs && (
            <button
              onClick={handleClearInputs}
              className="p-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all"
              title="Clear all inputs"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Input indicator banner */}
      {hasInputs && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <span className="text-blue-800 text-sm font-medium">
                Program inputs configured ({savedInputs.split('\n').filter(line => line.trim()).length} line{savedInputs.split('\n').filter(line => line.trim()).length !== 1 ? 's' : ''})
              </span>
            </div>
            <button
              onClick={handleOpenEditor}
              className="text-blue-600 hover:text-blue-800 text-xs underline"
            >
              View/Edit
            </button>
          </div>
          {/* Preview of inputs */}
          <div className="mt-2 p-2 bg-white rounded border border-blue-200">
            <div className="flex items-start gap-2">
              <FileText className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
              <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap line-clamp-3 break-all">
                {savedInputs}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Output area with white background and black text */}
      <div className="flex-1 p-4 bg-white overflow-auto min-h-0 border-t border-gray-200">
        {output || !isRunning ? (
          <>
            <pre className="text-gray-900 font-mono text-sm whitespace-pre-wrap break-words">
              {output || "Click 'Run' to execute your code...\n\nIf your code needs input (like input() in Python or Scanner in Java), click 'Set Inputs' first."}
            </pre>
            <div ref={outputEndRef} />
          </>
        ) : (
          <div className="flex items-center gap-3 text-gray-600">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin"></div>
            <span>Executing code...</span>
          </div>
        )}
      </div>

      {/* Input Editor Modal */}
      {showInputEditor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Program Inputs</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Enter all inputs your program needs, one per line
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-4 overflow-auto">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Example for 2 numbers:&#10;5&#10;10&#10;&#10;Example for name and age:&#10;John Doe&#10;25&#10;&#10;Each line will be used as one input when your program asks for it."
                className="w-full h-64 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono text-sm resize-none"
                autoFocus
              />
              
              {/* Helper text */}
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>💡 Tip:</strong> Each line you enter here will be used as input when your program calls input(), scanf(), Scanner.nextLine(), etc.
                  The inputs will be consumed in order from top to bottom.
                </p>
              </div>

              
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={handleClearInputs}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
              >
                Clear All
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInputs}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                >
                  Save Inputs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};