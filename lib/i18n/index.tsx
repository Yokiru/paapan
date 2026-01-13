'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { id, Translations } from './id';
import { en } from './en';

type Language = 'id' | 'en';

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
}

const translations: Record<Language, Translations> = { id, en };

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
    // Default to Indonesian
    const [language, setLanguageState] = useState<Language>('id');

    const setLanguage = useCallback((lang: Language) => {
        setLanguageState(lang);
        // Persist to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('app-language', lang);
        }
    }, []);

    // Load from localStorage on mount
    React.useEffect(() => {
        const saved = localStorage.getItem('app-language') as Language | null;
        if (saved && (saved === 'id' || saved === 'en')) {
            setLanguageState(saved);
        }
    }, []);

    const t = translations[language];

    return (
        <I18nContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within I18nProvider');
    }
    return context;
}

// Export for convenience
export type { Language, Translations };
