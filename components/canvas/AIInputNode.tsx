"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps, useUpdateNodeInternals } from 'reactflow';
import { AIInputNodeData } from '@/types';
import { useMindStore } from '@/store/useMindStore';
import { useAISettingsStore } from '@/store/useAISettingsStore';
import { AI_MODELS, AIModel, canAccessModel, PlanType } from '@/lib/aiModels';
import { useCreditStore } from '@/store/useCreditStore';
import { ArrowUp, ChevronDown, Lock, Globe, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';

/**
 * AI Input Node - Minimal design with double layer border
 * Design System: zinc palette, double border layer
 */
const AIInputNode = memo(({ id, data, selected }: NodeProps<AIInputNodeData>) => {
    const useExperimentUi = true;
    const { convertAIInputToMind, updateNodeData, nodes, edges } = useMindStore(useShallow(state => ({
        convertAIInputToMind: state.convertAIInputToMind,
        updateNodeData: state.updateNodeData,
        nodes: state.nodes,
        edges: state.edges,
    })));
    const { selectedModelId, setSelectedModel, currentSettings, byokValidationState, customApiKey, aiProviderMode, byokVisibleModelIds, byokAvailableModels } = useAISettingsStore(useShallow(state => ({
        selectedModelId: state.selectedModelId,
        setSelectedModel: state.setSelectedModel,
        currentSettings: state.currentSettings,
        byokValidationState: state.byokValidationState,
        customApiKey: state.customApiKey,
        aiProviderMode: state.aiProviderMode,
        byokVisibleModelIds: state.byokVisibleModelIds,
        byokAvailableModels: state.byokAvailableModels,
    })));

    const [inputValue, setInputValue] = React.useState(data.inputValue || '');
    const [isEditing, setIsEditing] = React.useState(false);
    const [isModelMenuOpen, setIsModelMenuOpen] = React.useState(false);
    const router = useRouter();
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const modelMenuRef = React.useRef<HTMLDivElement>(null);
    const modelDropdownRef = React.useRef<HTMLDivElement>(null);
    const updateNodeInternals = useUpdateNodeInternals();

    // Read tier from useCreditStore (source of truth — fetched from Supabase on login)
    // This is reactive and will update when user logs in/logs out
    const userTier = useCreditStore(state => state.currentTier) as PlanType;
    const hasActiveByok = aiProviderMode === 'byok' && Boolean(customApiKey.trim()) && byokValidationState === 'valid';
    const byokModelPool = byokAvailableModels.length > 0 ? byokAvailableModels : AI_MODELS;
    const visibleModels = hasActiveByok
        ? byokModelPool.filter((model) => byokVisibleModelIds.includes(model.id))
        : AI_MODELS;
    const activeModel = visibleModels.find(m => m.id === selectedModelId) || byokModelPool.find(m => m.id === selectedModelId) || AI_MODELS.find(m => m.id === selectedModelId) || visibleModels[0] || AI_MODELS[0];
    const canUseModel = (model: AIModel) => canAccessModel(userTier, model.requiredTier, { hasByok: hasActiveByok });
    const selectedNodeIdSet = React.useMemo(
        () => new Set(nodes.filter((node) => node.selected).map((node) => node.id)),
        [nodes]
    );
    const isTopHandleConnectedToSelected = React.useMemo(() => (
        edges.some((edge) => (
            (edge.source === id && (edge.sourceHandle || 'top') === 'top' && selectedNodeIdSet.has(edge.target)) ||
            (edge.target === id && (edge.targetHandle || 'top') === 'top' && selectedNodeIdSet.has(edge.source))
        ))
    ), [edges, id, selectedNodeIdSet]);
    const isTopHandleVisible = selected || isTopHandleConnectedToSelected;

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
            const target = e.target as Node;
            const isInsideModelMenu = modelMenuRef.current?.contains(target) || modelDropdownRef.current?.contains(target);
            if (!isInsideModelMenu) {
                setIsModelMenuOpen(false);
            }
        };
        if (isModelMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside, true);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isModelMenuOpen]);

    React.useEffect(() => {
        if (!useExperimentUi) return;

        const frameId = requestAnimationFrame(() => {
            updateNodeInternals(id);
        });
        const settleId = window.setTimeout(() => {
            updateNodeInternals(id);
        }, 460);

        return () => {
            cancelAnimationFrame(frameId);
            window.clearTimeout(settleId);
        };
    }, [id, isTopHandleConnectedToSelected, selected, updateNodeInternals, useExperimentUi]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputValue(value);
        updateNodeData(id, { inputValue: value });

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    const handleModelSelect = (model: AIModel) => {
        if (!canUseModel(model)) {
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

    if (useExperimentUi) {
        return (
            <div
                className={`
                    relative w-[560px] min-h-[130px] rounded-[24px]
                    border border-zinc-200 bg-white px-2 pt-2 pb-[58px]
                    shadow-[0_10px_30px_rgba(15,23,42,0.08)]
                `}
                onDoubleClick={() => setIsEditing(true)}
            >
                {selected && (
                    <div className="pointer-events-none absolute inset-0 z-30 rounded-[24px] border-2 border-blue-400 animate-[experimentSelectIn_340ms_cubic-bezier(0.16,1,0.3,1)_both]" />
                )}

                <Handle type="source" position={Position.Top} id="top" isConnectable={true}
                    className={`!z-40 !flex !h-[26px] !w-[26px] !items-center !justify-center !rounded-lg !border !border-zinc-200 !bg-white !shadow-[0_3px_8px_rgba(15,23,42,0.08)] experiment-node-handle experiment-node-handle-top ${isTopHandleVisible ? 'experiment-node-handle-visible' : 'experiment-node-handle-hidden'} hover:!shadow-[0_6px_12px_rgba(15,23,42,0.12)]`}
                    style={{
                        top: 0,
                        width: 26,
                        height: 26,
                        opacity: isTopHandleVisible ? 1 : 0,
                        pointerEvents: isTopHandleVisible ? 'auto' : 'none',
                    }}
                >
                    <Zap className="pointer-events-none h-3.5 w-3.5 fill-blue-500 text-blue-500" strokeWidth={2.2} />
                </Handle>
                <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={true}
                    className="!w-3 !h-3 !rounded-full !opacity-0 !bg-zinc-400"
                />
                <Handle type="source" position={Position.Left} id="left" isConnectable={true}
                    className="!w-3 !h-3 !rounded-full !opacity-0 !bg-zinc-400"
                />
                <Handle type="source" position={Position.Right} id="right" isConnectable={true}
                    className="!w-3 !h-3 !rounded-full !opacity-0 !bg-zinc-400"
                />

                <textarea
                    ref={textareaRef}
                    className="nodrag min-h-[58px] w-full resize-none overflow-hidden bg-transparent px-3 pt-3 text-[17px] font-normal leading-7 text-zinc-800 outline-none placeholder:text-zinc-400"
                    placeholder="Ask something..."
                    value={inputValue}
                    rows={2}
                    onFocus={() => setIsEditing(true)}
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
                />

                {data.contextFrameId && (
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600 whitespace-nowrap">
                        Frame context aktif
                    </div>
                )}

                <div ref={modelMenuRef} className="absolute bottom-1.5 left-1.5 right-1.5 flex cursor-grab items-center justify-between gap-2 rounded-[20px] border border-zinc-200/80 bg-[#F7F7F8] p-1.5 shadow-[0_1px_4px_rgba(15,23,42,0.045)] ring-1 ring-white/80">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <button
                            type="button"
                            className={`nodrag flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-semibold shadow-[0_3px_9px_rgba(15,23,42,0.07)] transition-colors ${
                                data.webSearchEnabled
                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                    : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                            }`}
                            title="Web Search"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                updateNodeData(id, { webSearchEnabled: !data.webSearchEnabled });
                            }}
                        >
                            <Globe size={16} strokeWidth={2} className={data.webSearchEnabled ? 'text-blue-600' : 'text-zinc-700'} />
                            <span>Web</span>
                        </button>

                        <div className="nodrag relative">
                            <button
                                type="button"
                                className="nodrag flex h-9 max-w-[180px] items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] font-semibold text-zinc-800 shadow-[0_3px_9px_rgba(15,23,42,0.07)] transition-colors hover:bg-zinc-50"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsModelMenuOpen(prev => !prev);
                                }}
                            >
                                <span className="min-w-0 truncate">{activeModel.name}</span>
                                <ChevronDown size={13} className={`shrink-0 text-zinc-500 transition-transform duration-150 ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                        </div>
                    </div>

                    <div className="flex shrink-0 items-center">
                        <button
                            type="button"
                            disabled={!inputValue.trim()}
                            className="nodrag flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_10px_rgba(15,23,42,0.22)] transition-[background-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:bg-zinc-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_16px_rgba(15,23,42,0.18)] active:translate-y-0 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none disabled:hover:translate-y-0"
                            title="Send"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={handleSubmit}
                        >
                            <ArrowUp size={17} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {isModelMenuOpen && (
                    <div ref={modelDropdownRef} className="nodrag absolute left-[132px] top-[calc(100%+10px)] z-50 min-w-[260px] rounded-[22px] border border-zinc-200 bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-white/80">
                        {visibleModels.map(model => {
                            const hasAccess = canUseModel(model);
                            const isActive = model.id === selectedModelId;
                            return (
                                <button
                                    key={model.id}
                                    className={`nodrag w-full rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 ${isActive ? 'bg-zinc-50' : ''}`}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleModelSelect(model);
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${hasAccess ? 'text-zinc-800' : 'text-zinc-400'}`}>
                                            {model.name}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierBadgeColor[model.requiredTier]}`}>
                                            {model.badge}
                                        </span>
                                        {!hasAccess && <Lock size={12} className="text-zinc-400" />}
                                    </div>
                                    <p className={`mt-0.5 text-xs leading-snug ${hasAccess ? 'text-zinc-500' : 'text-zinc-300'}`}>
                                        {model.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

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
                            className="flex max-w-[220px] items-center gap-2 px-5 py-2 rounded-2xl bg-white border border-zinc-200 text-sm text-zinc-600 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm font-semibold"
                            onMouseDown={(e) => {
                                e.preventDefault(); // prevent textarea blur
                                e.stopPropagation();
                                setIsModelMenuOpen(prev => !prev);
                            }}
                        >
                            <span className="min-w-0 flex-1 truncate text-left">{activeModel.name}</span>
                            {hasActiveByok && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                                    BYOK
                                </span>
                            )}
                            <ChevronDown size={14} className={`shrink-0 transition-transform duration-150 ${isModelMenuOpen ? 'rotate-180' : ''}`} />
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
                                {visibleModels.map(model => {
                                    const hasAccess = canAccessModel(userTier, model.requiredTier, { hasByok: hasActiveByok });
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
                                                    <span className={`min-w-0 truncate text-xs font-semibold ${isActive ? 'text-zinc-800' : hasAccess ? 'text-zinc-600' : 'text-zinc-400'}`}>
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
