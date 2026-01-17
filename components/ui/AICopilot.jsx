import React, { useState, useEffect } from 'react';
import { Sparkles, Wand2, AlertCircle, CheckCircle, Lightbulb, X, Loader2, Zap, Bot, ChevronDown, ChevronUp, Code2 } from 'lucide-react';

const AICopilot = ({ code, lang, onFixApplied, isEnabled = true }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (autoAnalyze && code.trim()) {
      const timer = setTimeout(() => {
        analyzeCodeSilently();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [code, autoAnalyze]);

  const analyzeCodeSilently = async () => {
    if (!code.trim() || isAnalyzing) return;

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/analyze-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: lang
        })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setErrors(data.errors || []);
      setSuggestions(data.suggestions || []);
    } catch (error) {
      setErrors([{
        line: 0,
        severity: 'error',
        message: 'Failed to analyze code. Please try again.',
        type: 'system'
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeCode = async () => {
    if (!code.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setShowPanel(true);
    setShowSuggestions(false);

    try {
      const response = await fetch('/api/analyze-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: lang
        })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setErrors(data.errors || []);
      setSuggestions(data.suggestions || []);
    } catch (error) {
      setErrors([{
        line: 0,
        severity: 'error',
        message: 'Failed to analyze code. Please try again.',
        type: 'system'
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fixError = async (error) => {
    setIsFixing(true);

    try {
      const response = await fetch('/api/fix-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: lang,
          error: error.message,
          line: error.line
        })
      });

      if (!response.ok) {
        throw new Error('Fix failed');
      }

      const data = await response.json();
      if (data.fixedCode && onFixApplied) {
        onFixApplied(data.fixedCode, data.explanation);
        
        const notification = document.createElement('div');
        notification.innerHTML = `
          <div style="
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(16, 185, 129, 0.3);
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
            font-family: system-ui;
            max-width: 350px;
          ">
            <div style="display: flex; align-items: start; gap: 12px;">
              <div style="font-size: 24px;">✨</div>
              <div>
                <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
                  Code Fixed!
                </div>
                <div style="font-size: 13px; opacity: 0.95; line-height: 1.4;">
                  ${data.explanation || 'Error resolved successfully'}
                </div>
              </div>
            </div>
          </div>
          <style>
            @keyframes slideIn {
              from { transform: translateX(400px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          </style>
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
          notification.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(() => notification.remove(), 300);
        }, 4000);

        setTimeout(() => analyzeCodeSilently(), 500);
      }
    } catch (error) {
      alert('Failed to fix code. Please try again.');
    } finally {
      setIsFixing(false);
    }
  };

  const fixAllErrors = async () => {
    if (errors.length === 0) return;
    
    setIsFixing(true);

    try {
      const response = await fetch('/api/fix-all-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language: lang,
          errors: errors.map(e => e.message)
        })
      });

      if (!response.ok) {
        throw new Error('Fix all failed');
      }

      const data = await response.json();
      if (data.fixedCode && onFixApplied) {
        onFixApplied(data.fixedCode, 'Fixed all detected errors');
        
        setTimeout(() => analyzeCodeSilently(), 500);
      }
    } catch (error) {
      alert('Failed to fix all errors. Please try again.');
    } finally {
      setIsFixing(false);
    }
  };

  const generateCode = async () => {
    if (!promptText.trim() || isGenerating) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          language: lang,
          existingCode: code
        })
      });

      if (!response.ok) {
        throw new Error('Code generation failed');
      }

      const data = await response.json();
      if (data.generatedCode && onFixApplied) {
        onFixApplied(data.generatedCode, data.explanation || 'Code generated successfully');
        
        const notification = document.createElement('div');
        notification.innerHTML = `
          <div style="
            position: fixed;
            top: 80px;
            right: 20px;
            background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(139, 92, 246, 0.3);
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
            font-family: system-ui;
            max-width: 350px;
          ">
            <div style="display: flex; align-items: start; gap: 12px;">
              <div style="font-size: 24px;">✨</div>
              <div>
                <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px;">
                  Code Generated!
                </div>
                <div style="font-size: 13px; opacity: 0.95; line-height: 1.4;">
                  ${data.explanation || 'Your code has been generated successfully'}
                </div>
              </div>
            </div>
          </div>
          <style>
            @keyframes slideIn {
              from { transform: translateX(400px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          </style>
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
          notification.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(() => notification.remove(), 300);
        }, 4000);

        setPromptText('');
        setShowPromptInput(false);
        setTimeout(() => analyzeCodeSilently(), 500);
      }
    } catch (error) {
      alert('Failed to generate code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isEnabled) return null;

  const totalIssues = errors.length + suggestions.length;
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowPanel(!showPanel)}
          disabled={!code.trim()}
          className={`relative flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 ${
            isAnalyzing
              ? 'bg-gradient-to-br from-blue-500 to-blue-600 animate-pulse'
              : totalIssues > 0
              ? 'bg-gradient-to-br from-red-500 to-red-600'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="AI Copilot - Click to analyze"
        >
          {isAnalyzing ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Bot className="w-5 h-5 text-white" />
          )}
          
          {totalIssues > 0 && !isAnalyzing && (
            <div className="absolute -top-1 -right-1 bg-white text-red-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-red-600 shadow-lg">
              {totalIssues > 9 ? '9+' : totalIssues}
            </div>
          )}
          
          {autoAnalyze && !isAnalyzing && (
            <div className="absolute -bottom-1 -left-1 bg-green-500 rounded-full w-3 h-3 border-2 border-white animate-pulse" title="Auto-analyze enabled" />
          )}
        </button>
      </div>

      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPanel(false)}
          />
          
          <div className="fixed bottom-24 right-6 bg-white border-2 border-indigo-200 rounded-2xl shadow-2xl z-50 w-[480px] max-h-[70vh] overflow-hidden flex flex-col animate-slideUp">
            
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">AI Copilot</div>
                    <div className="text-xs opacity-90">Powered by Groq AI</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowPanel(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer bg-white/10 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoAnalyze}
                    onChange={(e) => setAutoAnalyze(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-white"
                  />
                  <span className="text-sm font-medium">Auto-analyze</span>
                </label>
                
                {totalIssues > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    {errorCount > 0 && (
                      <div className="flex items-center gap-1 bg-red-500/90 px-2 py-1 rounded">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-semibold">{errorCount}</span>
                      </div>
                    )}
                    {warningCount > 0 && (
                      <div className="flex items-center gap-1 bg-yellow-500/90 px-2 py-1 rounded">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-semibold">{warningCount}</span>
                      </div>
                    )}
                    {suggestions.length > 0 && (
                      <div className="flex items-center gap-1 bg-blue-500/90 px-2 py-1 rounded">
                        <Lightbulb className="w-4 h-4" />
                        <span className="font-semibold">{suggestions.length}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={analyzeCode}
                  disabled={isAnalyzing || !code.trim()}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Analyze Code
                    </>
                  )}
                </button>

                {errors.length > 0 && (
                  <button
                    onClick={fixAllErrors}
                    disabled={isFixing}
                    className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-2"
                  >
                    {isFixing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Fix All
                      </>
                    )}
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowPromptInput(!showPromptInput)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all text-sm font-medium flex items-center justify-center gap-2"
              >
                <Code2 className="w-4 h-4" />
                {showPromptInput ? 'Cancel' : 'Generate Code with AI'}
              </button>

              {showPromptInput && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Describe what code you want to generate... (e.g., 'Create a function to sort an array', 'Add error handling', 'Write a class for user authentication')"
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                    rows="3"
                    autoFocus
                  />
                  <button
                    onClick={generateCode}
                    disabled={isGenerating || !promptText.trim()}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Code
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {!isAnalyzing && errors.length === 0 && suggestions.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <p className="text-base font-medium text-gray-700">No issues found!</p>
                  <p className="text-sm mt-2">Your code looks good.</p>
                </div>
              )}

              {errors.map((error, index) => (
                <div
                  key={`error-${index}`}
                  className={`p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    error.severity === 'error' ? 'bg-red-50/50' : 'bg-yellow-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      error.severity === 'error' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm text-gray-900 font-medium">
                          {error.message}
                        </p>
                        {error.line > 0 && (
                          <span className="text-xs text-gray-500 whitespace-nowrap bg-white px-2 py-1 rounded border border-gray-300">
                            Line {error.line}
                          </span>
                        )}
                      </div>
                      {error.suggestion && (
                        <p className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border-l-2 border-indigo-500">
                          💡 {error.suggestion}
                        </p>
                      )}
                      {error.severity !== 'system' && (
                        <button
                          onClick={() => fixError(error)}
                          disabled={isFixing}
                          className="mt-3 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-1.5 font-medium"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          Fix This Issue
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {suggestions.length > 0 && (
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="w-full p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-b border-blue-200 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">
                      {suggestions.length} Suggestion{suggestions.length > 1 ? 's' : ''} Available
                    </span>
                  </div>
                  {showSuggestions ? (
                    <ChevronUp className="w-5 h-5 text-blue-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              )}

              {showSuggestions && suggestions.map((suggestion, index) => (
                <div
                  key={`suggestion-${index}`}
                  className="p-4 border-b border-gray-200 hover:bg-gray-50 bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 mt-0.5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 font-semibold mb-2">
                        {suggestion.title}
                      </p>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        {suggestion.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-indigo-50">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI-powered analysis using Groq's Llama 3.3 70B</span>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

export default AICopilot;