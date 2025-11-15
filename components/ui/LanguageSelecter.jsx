// components/LanguageSelector.jsx
import React from 'react';

const languages = [
  { value: "javascript", label: "JavaScript", icon: "JS" },
  { value: "typescript", label: "TypeScript", icon: "TS" },
  { value: "python", label: "Python", icon: "PY" },
  { value: "java", label: "Java", icon: "JA" },
  { value: "cpp", label: "C++", icon: "C++" },
  { value: "c", label: "C", icon: "C" },
  { value: "go", label: "Go", icon: "GO" },
  { value: "rust", label: "Rust", icon: "RS" },
  { value: "php", label: "PHP", icon: "PHP" }
];

export const LanguageSelector = ({ lang, setLang, setIsMobileMenuOpen }) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
      {languages.map((language) => (
        <button
          key={language.value}
          onClick={() => {
            setLang(language.value);
            setIsMobileMenuOpen(false);
          }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            lang === language.value
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white'
          }`}
        >
          <span className="text-xs font-bold px-1 py-0.5 bg-black/20 rounded">
            {language.icon}
          </span>
          <span className="hidden sm:inline">{language.label}</span>
        </button>
      ))}
    </div>
  );
};