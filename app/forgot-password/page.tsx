'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthInput from '@/components/auth/AuthInput';
import AuthButton from '@/components/auth/AuthButton';

export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            setIsSubmitted(true);
        }, 2000);
    };

    if (isSubmitted) {
        return (
            <AuthLayout
                title="Check your email"
                subtitle="We've sent a password reset link to your email"
                footer={
                    <>
                        <Link href="/login" className="font-bold text-gray-900 hover:underline">
                            ← Back to Sign In
                        </Link>
                    </>
                }
            >
                <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                        Didn't receive the email? Check your spam folder or
                    </p>
                    <button
                        onClick={() => setIsSubmitted(false)}
                        className="text-sm font-bold text-blue-600 hover:underline"
                    >
                        Try another email
                    </button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Forgot password?"
            subtitle="Enter your email to receive a reset link"
            footer={
                <>
                    <Link href="/login" className="font-bold text-gray-900 hover:underline">
                        ← Back to Sign In
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="w-full">
                <AuthInput
                    type="email"
                    placeholder="Email Address"
                    required
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    }
                />

                <div className="mt-2">
                    <AuthButton type="submit" disabled={isLoading}>
                        {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </AuthButton>
                </div>
            </form>
        </AuthLayout>
    );
}
