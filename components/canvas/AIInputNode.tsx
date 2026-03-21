"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AIInputNodeData } from '@/types';
import { useMindStore } from '@/store/useMindStore';
import { useAISettingsStore } from '@/store/useAISettingsStore';
import { AI_MODELS, canAccessModel, PlanType } from '@/lib/aiModels';
import { useCreditStore } from '@/store/useCreditStore';
import { ChevronDown, Lock, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';

/**
 * AI Input Node - Minimal design with double layer border
 * Design System: zinc palette, double border layer
 */
const AIInputNode = memo(({ id, data, selected }: NodeProps<AIInputNodeData>) => {
    const { convertAIInputToMind, updateNodeData } = useMindStore(useShallow(state => ({ convertAIInputToMind: state.convertAIInputToMind, updateNodeData: state.updateNodeData })));
    const { selectedModelId, setSelectedModel, currentSettings } = useAISettingsStore(useShallow(state => ({ selectedModelId: state.selectedModelId, setSelectedModel: state.setSelectedModel, currentSettings: state.currentSettings })));

    const [inputValue, setInputValue] = React.useState(data.inputValue || '');
    const [isEditing, setIsEditing] = React.useState(false);
    const [isModelMenuOpen, setIsModelMenuOpen] = React.useState(false);
    const router = useRouter();
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const modelMenuRef = React.useRef<HTMLDivElement>(null);

    // Read tier from useCreditStore (source of truth — fetched from Supabase on login)
    // This is reactive and will update when user logs in/logs out
    const userTier = useCreditStore(state => state.currentTier) as PlanType;
    const activeModel = AI_MODELS.find(m => m.id === selectedModelId) || AI_MODELS[0];

    const handleSubmit = () => {
        if (inputValue.trim()) {
            convertAIInputToMind(id, inputValue.trim());
        }
    };

    // Auto-enable editing mode and sync default search settings when node is first created
    React.useEffect(() => {
        if (!data.inputValue) {
            setIsEditing(true);
        }
        
        // Sync the toggle setting if undefined in node's prop
        if (data.webSearchEnabled === undefined) {
             updateNodeData(id, { webSearchEnabled: currentSettings.allowWebSearch });
        }
    }, [data.inputValue, data.webSearchEnabled, currentSettings.allowWebSearch, id, updateNodeData]);

    // Focus input when entering edit mode
    React.useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    // Auto-resize textarea
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [isEditing, inputValue]);

    // Close model menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
                setIsModelMenuOpen(false);
            }
        };
        if (isModelMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside, true);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isModelMenuOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputValue(value);
        updateNodeData(id, { inputValue: value });

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    const handleModelSelect = (model: typeof AI_MODELS[0]) => {
        if (!canAccessModel(userTier, model.requiredTier)) {
            setIsModelMenuOpen(false);
            router.push('/pricing');
            return;
        }
        setSelectedModel(model.id);
        setIsModelMenuOpen(false);
    };

    const tierBadgeColor: Record<string, string> = {
        free: 'bg-zinc-100 text-zinc-500',
        plus: 'bg-violet-100 text-violet-600',
        pro: 'bg-amber-100 text-amber-600',
    };

    return (
        <>
            {/* Outer Layer - Double border effect */}
            <div
                className={`
                    relative w-[380px] min-h-[56px]
                    rounded-2xl p-2.5 bg-blue-100
                    ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                    ${!isEditing ? 'cursor-grab' : ''}
                `}
                onDoubleClick={() => setIsEditing(true)}
            >
                {/* Inner Layer */}
                <div className="bg-white rounded-xl px-5 py-3 min-h-[44px] flex items-center">

                    {/* Handles */}
                    <Handle type="source" position={Position.Top} id="top" isConnectable={true}
                        className="!w-3 !h-3 !rounded-full !border-2 !border-white !bg-zinc-400"
                    />
                    <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={true}
                        className="!w-3 !h-3 !rounded-full !opacity-0 !bg-zinc-400"
                    />
                    <Handle type="source" position={Position.Left} id="left" isConnectable={true}
                        className="!w-3 !h-3 !rounded-full !opacity-0 !bg-zinc-400"
                    />
                    <Handle type="source" position={Position.Right} id="right" isConnectable={true}
                        className="!w-3 !h-3 !rounded-full !opacity-0 !bg-zinc-400"
                    />

                    {/* Input */}
                    {isEditing ? (
                        <textarea
                            ref={textareaRef}
                            className="nodrag w-full bg-transparent outline-none text-center text-zinc-700 font-medium placeholder:text-zinc-400 resize-none overflow-hidden"
                            placeholder="Ketik pertanyaan, tekan Enter..."
                            value={inputValue}
                            rows={1}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                                if (e.key === 'Escape') {
                                    setIsEditing(false);
                                }
                            }}
                            onBlur={() => setIsEditing(false)}
                        />
                    ) : (
                        <div className="w-full text-center text-zinc-400 font-medium whitespace-pre-wrap">
                            {inputValue || 'Klik dua kali untuk mengetik...'}
                        </div>
                    )}
                </div>

                {data.contextFrameId && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600 border border-blue-200 whitespace-nowrap">
                        Frame context aktif
                    </div>
                )}

                {/* Model Selector - shown when editing, positioned below the node */}
                {isEditing && (
                    <div ref={modelMenuRef} className={`absolute left-0 flex gap-2 nodrag ${data.contextFrameId ? '-bottom-20' : '-bottom-12'}`} style={{ zIndex: 50 }}>
                        {/* Trigger Button */}
                        <button
                            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-white border border-zinc-200 text-sm text-zinc-600 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm font-semibold"
                            onMouseDown={(e) => {
                                e.preventDefault(); // prevent textarea blur
                                e.stopPropagation();
                                setIsModelMenuOpen(prev => !prev);
                            }}
                        >
                            <span>{activeModel.name}</span>
                            <ChevronDown size={14} className={`transition-transform duration-150 ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {/* Web Search Toggle */}
                        <button
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl border transition-all shadow-sm font-semibold text-sm ${data.webSearchEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'}`}
                            onMouseDown={(e) => {
                                e.preventDefault(); // prevent textarea blur
                                e.stopPropagation();
                                updateNodeData(id, { webSearchEnabled: !data.webSearchEnabled });
                            }}
                            title="Nyalakan untuk mencari referensi data terbaru via Internet (+10 Kredit)"
                        >
                            <Globe size={14} className={data.webSearchEnabled ? 'animate-pulse' : ''} />
                            <span>Web Search</span>
                        </button>

                        {/* Dropdown Menu (opens downward) */}
                        {isModelMenuOpen && (
                            <div className="absolute top-full mt-2 left-0 bg-white border border-zinc-200 rounded-2xl shadow-lg py-1.5 min-w-[220px]">
                                {AI_MODELS.map(model => {
                                    const hasAccess = canAccessModel(userTier, model.requiredTier);
                                    const isActive = model.id === selectedModelId;
                                    return (
                                        <button
                                            key={model.id}
                                            className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-zinc-50 transition-colors ${isActive ? 'bg-zinc-50' : ''}`}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleModelSelect(model);
                                            }}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-xs font-semibold ${isActive ? 'text-zinc-800' : hasAccess ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                                        {model.name}
                                                    </span>
                                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${tierBadgeColor[model.requiredTier]}`}>
                                                        {model.badge}
                                                    </span>
                                                    {!hasAccess && (
                                                        <Lock size={10} className="text-zinc-400" />
                                                    )}
                                                </div>
                                                <p className={`text-[10px] mt-0.5 leading-tight ${hasAccess ? 'text-zinc-400' : 'text-zinc-300'}`}>
                                                    {model.description}
                                                </p>
                                            </div>
                                            {isActive && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}, (prevProps, nextProps) => {
    // Custom equality check to prevent re-renders purely from position changes during drag
    return (
        prevProps.selected === nextProps.selected &&
        prevProps.data.inputValue === nextProps.data.inputValue &&
        prevProps.data.contextFrameId === nextProps.data.contextFrameId &&
        prevProps.data.webSearchEnabled === nextProps.data.webSearchEnabled &&
        prevProps.dragging === nextProps.dragging
    );
});

AIInputNode.displayName = 'AIInputNode';

export default AIInputNode;
