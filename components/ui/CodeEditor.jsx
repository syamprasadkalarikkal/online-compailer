import React, { useState } from 'react';
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { Code, Check, Copy, RotateCcw, Download, Play, Lock, Pause, Plus, Save, Edit3, X } from 'lucide-react';

// Language extension mapping
const getLanguageExtension = (lang) => {
  switch (lang) {
    case 'javascript':
      return [javascript()];
    case 'typescript':
      return [javascript({ typescript: true })];
    case 'python':
      return [python()];
    case 'java':
      return [java()];
    case 'cpp':
    case 'c':
      return [cpp()];
    case 'go':
      return [go()];
    case 'rust':
      return [rust()];
    case 'php':
      return [php()];
    default:
      return [];
  }
};

// File extensions mapping
const fileExtensions = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rs',
  php: 'php'
};

// Custom white theme for CodeMirror
const whiteTheme = EditorView.theme({
  "&": {
    backgroundColor: "#ffffff",
    color: "#24292e"
  },
  ".cm-content": {
    caretColor: "#24292e",
    backgroundColor: "#ffffff"
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#24292e"
  },
  ".cm-activeLine": {
    backgroundColor: "#f6f8fa"
  },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    color: "#6e7781",
    border: "none"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e8eaed"
  }
}, { dark: false });

export const CodeEditor = ({
  lang,
  code,
  setCode,
  copyCode,
  isCopied,
  resetCode,
  downloadCode,
  runCode,
  isRunning,
  readOnly = false,
  isCollaborating = false,
  // New props for save/new functionality
  user,
  currentCodeId,
  isEditingSavedCode,
  createNewCode,
  saveCode,
  codeTitle,
  setCodeTitle,
  isSaving,
  saveMessage,
  showSaveMessage
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  const extensions = [
    ...getLanguageExtension(lang),
    whiteTheme,
    ...(readOnly ? [EditorView.editable.of(false)] : []),
    ...(readOnly ? [
      EditorView.theme({
        "&": {
          opacity: "0.7"
        },
        ".cm-cursor": {
          display: "none"
        }
      })
    ] : [])
  ];

  const handleSaveClick = () => {
    if (user) {
      setShowSaveDialog(true);
    }
  };

  const handleSave = async () => {
    if (!codeTitle.trim() || codeTitle.trim().length > 100 || isSaving) {
      return;
    }
    
    // Call saveCode and wait for it
    await saveCode();
    
    // Auto-close the save dialog after 10ms
    setTimeout(() => {
      setShowSaveDialog(false);
    }, 10);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && codeTitle.trim() && !isSaving) {
      handleSave();
    } else if (e.key === 'Escape') {
      setShowSaveDialog(false);
      setCodeTitle('');
    }
  };

  return (
    <div className="bg-white backdrop-blur-sm border-r border-gray-600 flex flex-col h-full">
      {/* Save Dialog - Inline at top */}
      {showSaveDialog && (
        <div className="w-full bg-blue-50 border-b border-blue-200 shadow-sm">
          <div className="w-full px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Save className="w-4 h-4 text-blue-600" />
                {currentCodeId ? 'Update Code' : 'Save Code'}
              </h3>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setCodeTitle('');
                }}
                className="p-1 text-gray-600 hover:text-gray-900 rounded transition-colors"
              >
                <X className="w-4 h-4" />
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
                  className="w-full p-2 bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  autoFocus
                  maxLength={100}
                />
                {codeTitle.length > 80 && (
                  <div className="text-xs text-yellow-600 mt-1">
                    {100 - codeTitle.length} characters remaining
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded">
                  .{fileExtensions[lang] || 'txt'}
                </span>
                <span className="text-xs text-gray-500">
                  {code.split('\n').length} lines
                </span>
                
                <button
                  onClick={handleSave}
                  disabled={isSaving || !codeTitle.trim() || codeTitle.trim().length > 100}
                  className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors text-sm font-medium"
                >
                  {isSaving ? 'Saving...' : currentCodeId ? 'Update' : 'Save'}
                </button>
                
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setCodeTitle('');
                  }}
                  className="px-3 py-1.5 text-gray-700 hover:text-gray-900 bg-gray-200 hover:bg-gray-300 rounded transition-colors text-sm"
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
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {saveMessage}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-gray-600">
        <div className="flex items-center gap-2 text-gray-900">
          <Code className="w-5 h-5 text-indigo-600" />
          <span className="font-medium">Editor</span>
          <span className="text-sm text-gray-500">({lang})</span>
          
          {/* Read-only indicator */}
          {readOnly && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 border border-orange-300 rounded text-orange-700 text-xs">
              <Lock className="w-3 h-3" />
              <span>Read Only</span>
            </div>
          )}

          {/* Collaboration indicator */}
          {isCollaborating && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 border border-red-300 rounded text-red-700 text-xs">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span>Live</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* New Button */}
          <button
            onClick={createNewCode}
            className="flex items-center gap-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all text-sm"
            title={isEditingSavedCode ? 'Create new code (current changes will be lost)' : 'Create new code'}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </button>

          {/* Save Button */}
          {user ? (
            <button
              onClick={handleSaveClick}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-all text-sm font-medium ${
                isEditingSavedCode
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title={isEditingSavedCode ? 'Update saved code' : 'Save new code'}
            >
              {isEditingSavedCode ? (
                <>
                  <Edit3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Update</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-700/50 text-gray-400 rounded-lg text-sm">
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Login to Save</span>
            </div>
          )}
          
          {/* Separator */}
          <div className="w-px h-6 bg-gray-300"></div>

          {/* Copy Button */}
          <button
            onClick={copyCode}
            className={`p-2 rounded-lg transition-all ${
              isCopied
                ? 'bg-gray-100 text-gray-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Copy code"
          >
            {isCopied ? <Check className="w-4 h-3" /> : <Copy className="w-4 h-3" />}
          </button>
          
          {/* Reset Button */}
          <button
            onClick={resetCode}
            disabled={readOnly}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={readOnly ? "Cannot reset in read-only mode" : "Reset code"}
          >
            <RotateCcw className="w-4 h-3" />
          </button>
          
          {/* Download Button */}
          <button
            onClick={downloadCode}
            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
            title="Download code"
          >
            <Download className="w-4 h-3" />
          </button>
          
          {/* Run Button */}
          <button
            onClick={runCode}
            disabled={isRunning}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 ${
              isRunning
                ? 'bg-orange-100 text-orange-600 border border-orange-300'
                : 'bg-gray-100 text-black hover:bg-gray-200'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-3" />
              </>
            ) : (
              <>
                <Play className="w-4 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* CodeMirror Editor */}
      <div className="flex-1 relative min-h-0 bg-white code-editor-container">
        <CodeMirror
          value={code}
          height="100%"
          theme="light"
          extensions={extensions}
          onChange={(value) => {
            if (!readOnly) {
              setCode(value);
            }
          }}
          editable={!readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            indentOnInput: !readOnly,
            bracketMatching: true,
            closeBrackets: !readOnly,
            autocompletion: !readOnly,
            highlightSelectionMatches: true,
            searchKeymap: true,
          }}
          className={readOnly ? 'codemirror-readonly' : ''}
        />
      </div>

      {/* Custom styles */}
      <style jsx global>{`
        .codemirror-readonly .cm-content {
          cursor: not-allowed;
        }
        
        .codemirror-readonly .cm-line {
          cursor: not-allowed;
        }

        .cm-editor {
          background-color: #ffffff !important;
        }

        .cm-scroller {
          background-color: #ffffff !important;
        }

        /* Text selection - solid blue background only, keep text color from syntax highlighting */
        .code-editor-container .cm-content ::selection {
          background-color: #3b82f6 !important;
        }

        .code-editor-container .cm-content ::-moz-selection {
          background-color: #3b82f6 !important;
        }

        .code-editor-container .cm-line ::selection {
          background-color: #3b82f6 !important;
        }

        .code-editor-container .cm-line ::-moz-selection {
          background-color: #3b82f6 !important;
        }

        /* CodeMirror's native selection layer */
        .code-editor-container .cm-selectionLayer .cm-selectionBackground {
          background-color: #3b82f6 !important;
        }

        .code-editor-container .cm-editor.cm-focused .cm-selectionLayer .cm-selectionBackground {
          background-color: #3b82f6 !important;
        }

        /* Force selection for all elements */
        .code-editor-container .cm-editor ::selection {
          background-color: #3b82f6 !important;
        }

        .code-editor-container .cm-editor ::-moz-selection {
          background-color: #3b82f6 !important;
        }
      `}</style>
    </div>
  );
};