import React, { ButtonHTMLAttributes } from 'react';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'social';
    icon?: React.ReactNode;
}

export default function AuthButton({ children, variant = 'primary', className = '', icon, ...props }: AuthButtonProps) {
    if (variant === 'social') {
        return (
            <button
                className={`
                    flex items-center justify-center gap-2 w-full bg-white border border-gray-100 
                    text-gray-700 font-semibold rounded-xl py-3
                    hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm active:scale-[0.98]
                    transition-all duration-200
                    ${className}
                `}
                {...props}
            >
                {icon}
                {children}
            </button>
        );
    }

    return (
        <button
            className={`
                w-full bg-blue-600 text-white text-sm font-bold rounded-xl py-3
                hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 active:scale-[0.98]
                disabled:opacity-70 disabled:cursor-not-allowed
                transition-all duration-200
                ${className}
            `}
            {...props}
        >
            {children}
        </button>
    );
}
