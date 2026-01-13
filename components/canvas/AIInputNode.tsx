"use client";

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { AIInputNodeData } from '@/types';
import { useMindStore } from '@/store/useMindStore';

/**
 * AI Input Node - Minimal design with double layer border
 * Design System: zinc palette, double border layer
 */
const AIInputNode = memo(({ id, data, selected }: NodeProps<AIInputNodeData>) => {
    const { convertAIInputToMind, updateNodeData } = useMindStore();
    const [inputValue, setInputValue] = React.useState(data.inputValue || '');
    const [isEditing, setIsEditing] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
        if (inputValue.trim()) {
            convertAIInputToMind(id, inputValue.trim());
        }
    };

    // Auto-enable editing mode when node is first created
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

    // Auto-resize textarea
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [isEditing, inputValue]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputValue(value);
        updateNodeData(id, { inputValue: value });

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    return (
        <>
            {/* Outer Layer - Double border effect */}
            <div
                className={`
                    relative w-[380px] min-h-[56px]
                    rounded-2xl p-2.5
                    transition-all duration-200
                    ${selected ? 'ring-2 ring-zinc-400 ring-offset-2' : ''}
                    ${!isEditing ? 'cursor-grab' : ''}
                `}
                style={{ backgroundColor: '#F4F4F5' }}
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
            </div>
        </>
    );
});

AIInputNode.displayName = 'AIInputNode';

export default AIInputNode;
