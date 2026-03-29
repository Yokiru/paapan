import React from 'react';
import Image from 'next/image';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    footer?: React.ReactNode;
    visualImageSrc?: string;
    visualImageAlt?: string;
    visualPriority?: boolean;
    backgroundClassName?: string;
}

export default function AuthLayout({
    children,
    title,
    subtitle,
    footer,
    visualImageSrc,
    visualImageAlt = '',
    visualPriority = false,
    backgroundClassName,
}: AuthLayoutProps) {
    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#F8F9FA] p-4 font-sans text-gray-900">
            {backgroundClassName && (
                <div
                    className={`absolute inset-0 ${backgroundClassName}`}
                    style={{ viewTransitionName: 'auth-background' }}
                />
            )}
            {visualImageSrc && (
                <div className="absolute inset-0">
                    <div className="absolute inset-0 hidden lg:block">
                        <Image
                            src={visualImageSrc}
                            alt={visualImageAlt}
                            fill
                            priority={visualPriority}
                            sizes="100vw"
                            className="object-cover"
                        />
                    </div>
                </div>
            )}

            <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[450px] items-center justify-center">
                <div
                    className="auth-card-shell w-full rounded-[32px] border border-white/35 bg-white/18 p-3 backdrop-blur-xl shadow-[0_24px_80px_rgba(35,61,94,0.14)] flex flex-col justify-center items-center gap-2 overflow-hidden"
                    style={{ viewTransitionName: 'auth-shell' }}
                >
                    <div
                        className="w-full bg-white/88 border border-white/40 rounded-[20px] px-8 py-7 relative overflow-hidden backdrop-blur-md"
                        style={{ viewTransitionName: 'auth-card' }}
                    >
                        <div className="w-11 h-11 bg-gray-900 rounded-xl mx-auto mb-5 flex items-center justify-center shadow-md shadow-gray-200">
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

                    {footer && (
                        <div className="auth-card-footer py-3 text-center text-sm" style={{ viewTransitionName: 'auth-footer' }}>
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
