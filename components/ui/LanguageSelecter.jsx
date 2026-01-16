import React from 'react';
import { Lock } from 'lucide-react';

// Simple text-based icons matching the reference
const LanguageIcons = {
  c: () => (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-lg font-bold">C</span>
    </div>
  ),
  cpp: () => (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-base font-bold">C++</span>
    </div>
  ),
  go: () => (
    <svg className="w-8 h-8" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" rx="32" fill="currentColor" opacity="0.2" />
      <text
        x="50%"
        y="58%"
        textAnchor="middle"
        fontSize="96"
        fontWeight="bold"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="currentColor"
      >
        Go
      </text>
    </svg>
  ),
  java: () => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0-.001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0-.001.553.457 3.393.639"/>
    </svg>
  ),
  javascript: () => (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-base font-bold">JS</span>
    </div>
  ),
  php: () => (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-sm font-bold">php</span>
    </div>
  ),
  python: () => (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.31.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.83l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.23l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.24l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05 1.07.13zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09-.33.22zM21.1 6.11l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01.21.03zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08-.33.23z"/>
    </svg>
  ),
  rust: () => (
    <svg className="w-8 h-8" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M127.9 0l21.4 13.2 24.8-2.5 9.4 23.1 22.1 11.8-2.5 24.8 13.2 21.4-13.2 21.4 2.5 24.8-22.1 11.8-9.4 23.1-24.8-2.5-21.4 13.2-21.4-13.2-24.8 2.5-9.4-23.1-22.1-11.8 2.5-24.8-13.2-21.4 13.2-21.4-2.5-24.8 22.1-11.8 9.4-23.1 24.8 2.5L127.9 0z" opacity="0.9" />
      <text
        x="128"
        y="150"
        textAnchor="middle"
        fontSize="96"
        fontFamily="Arial, sans-serif"
        fill="#fff"
      >
        R
      </text>
    </svg>
  ),
  typescript: () => (
    <div className="flex items-center justify-center w-full h-full">
      <span className="text-base font-bold">TS</span>
    </div>
  )
};

const languages = [
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "rust", label: "Rust" },
  { value: "typescript", label: "TypeScript" }
];

export const LanguageSelector = ({ 
  lang, 
  setLang, 
  setIsMobileMenuOpen = () => {},
  isEditingSavedCode = false 
}) => {
  const handleLanguageClick = (languageValue) => {
    if (isEditingSavedCode) {
      return;
    }
    setLang(languageValue);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex flex-col gap-1 w-full items-center py-2 ">
      {languages.map((language) => {
        const IconComponent = LanguageIcons[language.value];
        const isActive = lang === language.value;
        const isDisabled = isEditingSavedCode && lang !== language.value;
        
        return (
          <button
            key={language.value}
            onClick={() => handleLanguageClick(language.value)}
            disabled={isDisabled}
            className={`relative w-12 h-12 transition-all flex items-center justify-center group ${
              isActive
                ? 'bg-gray-800 text-gray-300 border r '
                : isDisabled
                ? 'bg-white text-black border r opacity-50 cursor-not-allowed'
                : 'bg-white text-black border r hover:bg-gray-300 hover:text-black'
            }`}
            title={
              isDisabled
                ? 'Language locked. Click "New" to change language.'
                : language.label
            }
          >
            <IconComponent />
            
            {/* Lock icon for disabled languages */}
            {isDisabled && (
              <div className="absolute bottom-0.5 right-0.5 bg-red-500 rounded-full p-0.5">
                <Lock className="w-2.5 h-2.5 text-white" />
              </div>
            )}
            
            {/* Tooltip on hover */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity shadow-lg">
              {language.label}
              {isDisabled && <span className="text-red-300"> (locked)</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
};