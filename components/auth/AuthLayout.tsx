import React from 'react';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    footer?: React.ReactNode;
}

export default function AuthLayout({ children, title, subtitle, footer }: AuthLayoutProps) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FA] p-4 font-sans text-gray-900">
            {/* Background elements if needed, or keeping it clean as per image */}

            <div className="w-full max-w-[450px] p-3 bg-zinc-100 rounded-[32px] flex flex-col justify-center items-center gap-2 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="w-full bg-white rounded-[20px] px-8 py-7 relative overflow-hidden">
                    {/* Logo Area */}
                    <div className="w-11 h-11 bg-gray-900 rounded-xl mx-auto mb-5 flex items-center justify-center shadow-md shadow-gray-200">
                        {/* Placeholder for App Logo */}
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>

                    <div className="text-center mb-6">
                        <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1.5">{title}</h1>
                        {subtitle && (
                            <p className="text-sm text-gray-500">{subtitle}</p>
                        )}
                    </div>

                    {children}
                </div>

                {/* Footer - Outside the white card but inside the gray frame */}
                {footer && (
                    <div className="py-3 text-center text-sm">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
