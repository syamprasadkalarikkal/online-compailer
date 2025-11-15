import React from 'react';
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { rust } from "@codemirror/lang-rust";
import { php } from "@codemirror/lang-php";
import { EditorView } from "@codemirror/view";
import { Code, Check, Copy, RotateCcw, Download, Play, Lock, Unlock } from 'lucide-react';

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
  isCollaborating = false
}) => {
  const extensions = [
    ...getLanguageExtension(lang),
    // Add read-only extension if needed
    ...(readOnly ? [EditorView.editable.of(false)] : []),
    // Add styling for read-only state
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

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800/50 border-b border-gray-700">
        <div className="flex items-center gap-2 text-white">
          <Code className="w-5 h-5 text-indigo-400" />
          <span className="font-medium">Editor</span>
          <span className="text-sm text-gray-400">({lang})</span>
          
          {/* Read-only indicator */}
          {readOnly && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-300 text-xs">
              <Lock className="w-3 h-3" />
              <span>Read Only</span>
            </div>
          )}

          {/* Collaboration indicator */}
          {isCollaborating && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              <span>Live</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className={`p-2 rounded-lg transition-all ${
              isCopied
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            title="Copy code"
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          
          <button
            onClick={resetCode}
            disabled={readOnly}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={readOnly ? "Cannot reset in read-only mode" : "Reset code"}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={downloadCode}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all"
            title="Download code"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={runCode}
            disabled={isRunning}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Collaboration warning banner */}
      {isCollaborating && readOnly && (
        <div className="bg-orange-900/30 border-b border-orange-700/50 px-4 py-2 flex items-center gap-2">
          <Lock className="w-4 h-4 text-orange-300 flex-shrink-0" />
          <div className="text-orange-200 text-sm">
            <span className="font-medium">Read-only mode:</span> Another user is currently editing. You'll see their changes in real-time.
          </div>
        </div>
      )}

      {/* CodeMirror Editor */}
      <div className="flex-1 relative min-h-0">
        <CodeMirror
          value={code}
          height="100%"
          theme={oneDark}
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

        {/* Read-only overlay hint */}
        {readOnly && (
          <div className="absolute bottom-4 right-4 pointer-events-none">
            <div className="bg-orange-500/90 text-white px-3 py-1.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2">
              <Unlock className="w-3 h-3" />
              <span>Request edit access to modify code</span>
            </div>
          </div>
        )}
      </div>

      

      {/* Custom styles for read-only state */}
      <style jsx global>{`
        .codemirror-readonly .cm-content {
          cursor: not-allowed;
        }
        
        .codemirror-readonly .cm-line {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};