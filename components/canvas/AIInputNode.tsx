"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AIInputNodeData, PastelColor } from '@/types';
import { useMindStore } from '@/store/useMindStore';

// Color variants matching MindNode
const colorVariants: Record<PastelColor, { border: string; glow: string }> = {
    'pastel-blue': { border: '#93c5fd', glow: 'shadow-blue-200' },
    'pastel-green': { border: '#6ee7b7', glow: 'shadow-emerald-200' },
    'pastel-pink': { border: '#fda4af', glow: 'shadow-rose-200' },
    'pastel-lavender': { border: '#c4b5fd', glow: 'shadow-violet-200' },
};

/**
 * AI Input Node - Sleek pill-shaped input for spawning new thoughts
 * Features:
 * - Glowing border animation
 * - 4-way handles for connections
 * - Auto-focus input
 * - Enter to convert to MindNode
 * - Auto-expanding textarea for multi-line
 */
const AIInputNode = memo(({ id, data, selected }: NodeProps<AIInputNodeData>) => {
    const { convertAIInputToMind, updateNodeData } = useMindStore();
    const [inputValue, setInputValue] = React.useState(data.inputValue || '');
    const [isEditing, setIsEditing] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const theme = colorVariants[data.color] || colorVariants['pastel-blue'];

    const handleSubmit = () => {
        if (inputValue.trim()) {
            convertAIInputToMind(id, inputValue.trim());
        }
    };

    // Auto-enable editing mode when node is first created (no initial value)
    React.useEffect(() => {
        if (!data.inputValue) {
            setIsEditing(true);
        }
    }, []);

    // Focus input when entering edit mode
    React.useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    // Auto-resize textarea when entering edit mode or value changes
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [isEditing, inputValue]);

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputValue(value);
        updateNodeData(id, { inputValue: value });

        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    return (
        <div
            className={`
                relative flex items-center justify-center
                w-[350px] min-h-[48px] py-3 px-5 bg-white rounded-2xl
                border-2 shadow-lg
                transition-all duration-300 ease-out
                ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
                animate-pulse-glow
                ${!isEditing ? 'cursor-grab' : ''}
            `}
            style={{
                borderColor: theme.border,
                boxShadow: `0 0 20px ${theme.border}60, 0 4px 20px rgba(0,0,0,0.1)`,
            }}
            onDoubleClick={() => setIsEditing(true)}
        >
            {/* ===== HANDLES - Only TOP visible ===== */}

            {/* TOP Handle (visible) */}
            <Handle type="source" position={Position.Top} id="top" isConnectable={true}
                className="!w-3 !h-3 !rounded-full !border-2 !border-white"
                style={{ backgroundColor: theme.border, boxShadow: 'none' }}
            />

            {/* BOTTOM Handle (hidden) */}
            <Handle type="source" position={Position.Bottom} id="bottom" isConnectable={true}
                className="!w-3 !h-3 !rounded-full !opacity-0"
                style={{ backgroundColor: theme.border }}
            />

            {/* LEFT Handle (hidden) */}
            <Handle type="source" position={Position.Left} id="left" isConnectable={true}
                className="!w-3 !h-3 !rounded-full !opacity-0"
                style={{ backgroundColor: theme.border }}
            />

            {/* RIGHT Handle (hidden) */}
            <Handle type="source" position={Position.Right} id="right" isConnectable={true}
                className="!w-3 !h-3 !rounded-full !opacity-0"
                style={{ backgroundColor: theme.border }}
            />

            {/* Textarea or Placeholder */}
            {isEditing ? (
                <textarea
                    ref={textareaRef}
                    className="nodrag w-full bg-transparent outline-none text-center text-gray-700 font-medium placeholder:text-gray-400 resize-none overflow-hidden"
                    placeholder="Type your question and press Enter..."
                    value={inputValue}
                    rows={1}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        // Submit on Enter without Shift
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
                <div className="w-full text-center text-gray-400 font-medium whitespace-pre-wrap">
                    {inputValue || 'Double-click to type...'}
                </div>
            )}
        </div>
    );
});

AIInputNode.displayName = 'AIInputNode';

export default AIInputNode;
