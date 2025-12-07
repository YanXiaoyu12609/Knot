import React, { useState, useEffect } from 'react';
import { X, Save, Key, Cpu, Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from 'next-themes';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('gemini-2.0-flash');
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (isOpen) {
            const storedKey = localStorage.getItem('gemini_api_key') || '';
            const storedModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
            setApiKey(storedKey);
            setModel(storedModel);
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('gemini_model', model);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* API Key Section */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            <Key className="w-4 h-4 text-zinc-500" />
                            Google Gemini API Key
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter your API Key"
                            className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        />
                        <p className="text-xs text-zinc-500">
                            Your API key is stored locally in your browser.
                        </p>
                    </div>

                    {/* Theme Section */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            <div className="w-4 h-4 flex items-center justify-center">
                                <Sun className="w-4 h-4 hidden dark:block" />
                                <Moon className="w-4 h-4 block dark:hidden" />
                            </div>
                            Appearance
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'light', name: 'Light', icon: Sun },
                                { id: 'dark', name: 'Dark', icon: Moon },
                                { id: 'system', name: 'System', icon: Laptop },
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => setTheme(mode.id)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${theme === mode.id
                                        ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400'
                                        : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                                        }`}
                                >
                                    <mode.icon className="w-5 h-5 mb-2" />
                                    <span className="text-xs font-medium">{mode.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Model Selection Section */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            <Cpu className="w-4 h-4 text-zinc-500" />
                            AI Model
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Top-tier reasoning and intelligence' },
                                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Fast, versatile, next-gen performance' },
                                { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', desc: 'Extremely fast and cost-effective' },
                                { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Balanced performance (Standard)' },
                                { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', desc: 'Previous gen cost-effective option' },
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => setModel(m.id)}
                                    className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${model === m.id
                                        ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/50'
                                        : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className={`text-sm font-medium ${model === m.id ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                            {m.name}
                                        </span>
                                        {model === m.id && (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                        )}
                                    </div>
                                    <span className="text-xs text-zinc-500 mt-1">{m.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
