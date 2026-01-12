import React, { InputHTMLAttributes } from 'react';

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
    label?: string; // Optional label if needed, though image shows placeholder/icon style
}

export default function AuthInput({ icon, className = '', ...props }: AuthInputProps) {
    return (
        <div className="relative group mb-3.5">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-800 transition-colors">
                {icon}
            </div>
            <input
                className={`
                    w-full bg-gray-50 border-0 rounded-xl py-3 pl-10 pr-4 text-sm
                    text-gray-900 placeholder:text-gray-400 font-medium
                    focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all
                    ${className}
                `}
                {...props}
            />
        </div>
    );
}
