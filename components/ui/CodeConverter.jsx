import React, { useState, useRef, useEffect } from 'react';
import { Zap, RefreshCw, Sparkles, X, AlertCircle, Clock } from 'lucide-react';

const languageNames = {
  c: 'C',
  cpp: 'C++',
  go: 'Go',
  java: 'Java',
  javascript: 'JavaScript',
  php: 'PHP',
  python: 'Python',
  rust: 'Rust',
  typescript: 'TypeScript'
};

const MIN_REQUEST_INTERVAL = 1000;
let lastRequestTime = 0;

export const CodeConverter = ({ 
  currentLang, 
  currentCode, 
  onCodeConverted,
  setLang,
  disabled = false,
  isEditingSavedCode = false
}) => {
  const [isConverting, setIsConverting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDetails, setErrorDetails] = useState({ message: '', details: '' });
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  
  const cooldownTimerRef = useRef(null);

  const availableLanguages = Object.keys(languageNames).filter(
    lang => lang !== currentLang
  );

  const showError = (message, details = '') => {
    setErrorDetails({ message, details });
    setShowErrorDialog(true);
  };

  const checkRateLimit = () => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = Math.ceil((MIN_REQUEST_INTERVAL - timeSinceLastRequest) / 1000);
      return { allowed: false, waitTime };
    }
    
    return { allowed: true, waitTime: 0 };
  };

  const startCooldown = (seconds) => {
    setCooldownSeconds(seconds);
    
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    
    cooldownTimerRef.current = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const convertToLanguage = async (targetLang) => {
    if (!currentCode.trim()) {
      showError('No code to convert', 'Please write some code in the editor first!');
      return;
    }

    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      showError(
        '⏱ Please Wait',
        `To prevent rate limiting, please wait ${rateCheck.waitTime} second${rateCheck.waitTime > 1 ? 's' : ''} before converting again.\n\nGroq is super fast, so this will be quick!`
      );
      startCooldown(rateCheck.waitTime);
      return;
    }

    if (isEditingSavedCode) {
      const confirm = window.confirm(
        `⚠ You're editing a saved ${languageNames[currentLang]} file.\n\n` +
        `Converting to ${languageNames[targetLang]} will change the code.\n\n` +
        `Continue?`
      );
      if (!confirm) return;
    }

    setIsConverting(true);
    setShowDropdown(false);
    lastRequestTime = Date.now();

    try {
      const response = await fetch('/api/convert-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: currentCode,
          fromLanguage: currentLang,
          toLanguage: targetLang,
          maxTokens: 2000
        })
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: { message: `HTTP ${response.status}` } };
        }
        
        throw new Error(errorData.error?.message || 'Conversion failed');
      }

      const data = await response.json();
      let convertedCode = data.convertedCode || '';

      if (onCodeConverted && typeof onCodeConverted === 'function') {
        onCodeConverted(convertedCode, targetLang);
        showSuccessNotification(currentLang, targetLang, data.cached);
      }
      
    } catch (err) {
      if (!showErrorDialog && 
          !err.message.includes('Rate limit') && 
          !err.message.includes('API key')) {
        
        if (err.message.includes('network') || err.message.includes('fetch')) {
          showError(
            'Network Error',
            'Could not connect to Groq AI.\n\n' +
            'Check your internet connection and try again.'
          );
        } else {
          showError(
            'Conversion Failed',
            err.message || 'An unexpected error occurred.\n\n' +
            'Please try again in a few seconds.'
          );
        }
      }
    } finally {
      setIsConverting(false);
    }
  };

  const showSuccessNotification = (fromLang, toLang, wasCached) => {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, ${wasCached ? '#3b82f6' : '#10b981'} 0%, ${wasCached ? '#2563eb' : '#059669'} 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(${wasCached ? '59, 130, 246' : '16, 185, 129'}, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
        font-family: system-ui;
        max-width: 300px;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 24px;">${wasCached ? '⚡' : '✨'}</div>
          <div>
            <div style="font-weight: 600; font-size: 15px;">
              ${wasCached ? 'Instant Result!' : 'Converted by Groq AI!'}
            </div>
            <div style="font-size: 13px; opacity: 0.9;">
              ${languageNames[fromLang]} → ${languageNames[toLang]}
            </div>
            ${wasCached ? '<div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">From cache</div>' : ''}
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
    }, wasCached ? 2000 : 3000);
  };

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  const isOnCooldown = cooldownSeconds > 0;

  return (
    <>
      <div className="relative">
        <button
          onClick={() => {
            if (isOnCooldown) {
              showError(
                'Cooldown Active',
                `Please wait ${cooldownSeconds} second${cooldownSeconds > 1 ? 's' : ''} before converting again.`
              );
            } else {
              setShowDropdown(!showDropdown);
            }
          }}
          disabled={disabled || isConverting || !currentCode.trim()}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-sm font-medium shadow-sm ${
            isConverting
              ? 'bg-orange-100 text-orange-700 cursor-wait border-2 border-orange-300'
              : isOnCooldown
              ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300 cursor-not-allowed'
              : !currentCode.trim()
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 hover:shadow-md'
          } disabled:opacity-50`}
          title={
            isOnCooldown
              ? `Cooldown: ${cooldownSeconds}s`
              : !currentCode.trim() 
              ? "Write some code first" 
              : "Convert code using Groq AI (Lightning Fast!)"
          }
        >
          {isConverting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Converting...</span>
              <span className="sm:hidden">...</span>
            </>
          ) : isOnCooldown ? (
            <>
              <Clock className="w-4 h-4" />
              <span>{cooldownSeconds}s</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">Convert</span>
              <span className="sm:hidden">AI</span>
            </>
          )}
        </button>

        {showDropdown && !isConverting && !isOnCooldown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            
            <div className="absolute top-full mt-2 right-0 bg-white border border-gray-300 rounded-xl shadow-2xl z-50 min-w-[280px] max-w-[320px] overflow-hidden">
              
              <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <div className="text-sm font-bold text-gray-800">
                    AI Code Converter
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="font-semibold text-purple-700">• Lightning Fast & Free</span> 
                </div>
              </div>

              

              <div className="px-4 py-3">
                <div className="text-xs font-semibold text-gray-500 mb-3">
                  Convert {languageNames[currentLang]} to:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {availableLanguages.map(targetLang => (
                    <button
                      key={targetLang}
                      onClick={() => convertToLanguage(targetLang)}
                      className="px-3 py-2.5 text-left hover:bg-purple-50 text-gray-700 text-sm transition-all rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm flex items-center gap-2 font-medium group"
                    >
                      <Zap className="w-3.5 h-3.5 text-purple-600 group-hover:text-purple-700" />
                      <span className="group-hover:text-purple-700">{languageNames[targetLang]}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              
            </div>
          </>
        )}
      </div>

      {showErrorDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowErrorDialog(false)}
          />
          
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {errorDetails.message}
              </h3>
              <button
                onClick={() => setShowErrorDialog(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {errorDetails.details && (
              <div className="mb-6">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg border border-gray-200">
{errorDetails.details}
                </pre>
              </div>
            )}
            
            <button
              onClick={() => setShowErrorDialog(false)}
              className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
};