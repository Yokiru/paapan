'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface AISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
    const [responseStyle, setResponseStyle] = useState('friendly');
    const [responseLanguage, setResponseLanguage] = useState('en');
    const [userName, setUserName] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        setIsSaving(true);
        // Simulate save
        setTimeout(() => {
            setIsSaving(false);
            onClose();
        }, 1000);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Card */}
            <div className="relative w-full max-w-[600px] max-h-[90vh] p-3 bg-zinc-100 rounded-[32px] animate-in fade-in zoom-in-95 duration-200">
                <div className="w-full bg-white rounded-[20px] p-8 relative overflow-y-auto max-h-[calc(90vh-24px)]">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Header */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">AI Personalization</h2>
                        <p className="text-sm text-gray-500 mt-1">Customize how AI responds to you</p>
                    </div>

                    {/* Settings */}
                    <div className="space-y-6">
                        {/* Response Style */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Response Style
                            </label>
                            <p className="text-xs text-gray-500 mb-3">Choose how AI communicates with you</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'professional', label: 'Professional', icon: '💼', desc: 'Formal & structured' },
                                    { value: 'friendly', label: 'Friendly', icon: '😊', desc: 'Casual & warm' },
                                    { value: 'concise', label: 'Concise', icon: '⚡', desc: 'Short & direct' },
                                ].map((style) => (
                                    <button
                                        key={style.value}
                                        onClick={() => setResponseStyle(style.value)}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${responseStyle === style.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="text-xl mb-2 block">{style.icon}</span>
                                        <p className={`text-sm font-medium ${responseStyle === style.value ? 'text-blue-700' : 'text-gray-900'}`}>
                                            {style.label}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">{style.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Response Language */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Response Language
                            </label>
                            <p className="text-xs text-gray-500 mb-3">AI will respond in this language</p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: 'en', label: 'English', flag: '🇺🇸' },
                                    { value: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
                                ].map((lang) => (
                                    <button
                                        key={lang.value}
                                        onClick={() => setResponseLanguage(lang.value)}
                                        className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${responseLanguage === lang.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="text-2xl">{lang.flag}</span>
                                        <span className={`text-sm font-medium ${responseLanguage === lang.value ? 'text-blue-700' : 'text-gray-900'}`}>
                                            {lang.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Your Name */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Your Name
                            </label>
                            <p className="text-xs text-gray-500 mb-3">AI will address you by this name</p>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="w-full bg-gray-50 border-0 rounded-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                                placeholder="What should AI call you?"
                            />
                        </div>

                        {/* Custom Instructions */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                Custom Instructions
                            </label>
                            <p className="text-xs text-gray-500 mb-3">Additional preferences AI should keep in mind</p>
                            <textarea
                                value={customInstructions}
                                onChange={(e) => setCustomInstructions(e.target.value)}
                                rows={4}
                                className="w-full bg-gray-50 border-0 rounded-xl py-3 px-4 text-sm text-gray-900 placeholder:text-gray-400 font-medium focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all resize-none"
                                placeholder="E.g., Focus on web development, explain things simply, include code examples..."
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-70"
                        >
                            {isSaving ? 'Saving...' : 'Save Preferences'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
