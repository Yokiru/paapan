'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DEFAULT_FIRST_WORKSPACE_NAME, getUserOnboardingState } from '@/lib/userOnboarding';

type Step = 'loading' | 'name' | 'greeting' | 'board' | 'saving';

const slugifyBoardName = (value: string) => value.trim().replace(/\s+/g, ' ');

export default function WelcomePage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('loading');
    const [nameInput, setNameInput] = useState('');
    const [boardInput, setBoardInput] = useState('');
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const boardInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const onboarding = await getUserOnboardingState(supabase);

            if (!onboarding) {
                router.replace('/login');
                return;
            }

            if (!onboarding.needsOnboarding) {
                router.replace('/');
                return;
            }

            if (cancelled) return;

            setUserId(onboarding.userId);
            setWorkspaceId(onboarding.workspaceId);
            setNameInput(onboarding.suggestedName);
            setBoardInput(
                onboarding.workspaceName && onboarding.workspaceName !== DEFAULT_FIRST_WORKSPACE_NAME
                    ? onboarding.workspaceName
                    : ''
            );
            setStep('name');
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [router]);

    useEffect(() => {
        if (step === 'name') {
            const id = window.setTimeout(() => {
                nameInputRef.current?.focus();
                nameInputRef.current?.select();
            }, 80);
            return () => window.clearTimeout(id);
        }

        if (step === 'board') {
            const id = window.setTimeout(() => {
                boardInputRef.current?.focus();
                boardInputRef.current?.select();
            }, 120);
            return () => window.clearTimeout(id);
        }
    }, [step]);

    const displayName = useMemo(() => nameInput.trim() || 'teman', [nameInput]);

    const handleNameSubmit = () => {
        const nextName = nameInput.trim();
        if (!nextName) return;

        setNameInput(nextName);
        setStep('greeting');

        window.setTimeout(() => {
            setStep('board');
        }, 1800);
    };

    const handleBoardSubmit = async () => {
        const nextName = nameInput.trim();
        const nextBoardName = slugifyBoardName(boardInput) || 'Board Pertama Saya';

        if (!userId || !nextName) return;

        setError(null);
        setBoardInput(nextBoardName);
        setStep('saving');

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            const email = user?.email || null;

            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(
                    {
                        id: userId,
                        email,
                        full_name: nextName,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'id' }
                );

            if (profileError) throw profileError;

            await supabase.auth.updateUser({
                data: {
                    full_name: nextName,
                },
            });

            if (workspaceId) {
                const { error: workspaceError } = await supabase
                    .from('workspaces')
                    .update({
                        name: nextBoardName,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', workspaceId)
                    .eq('user_id', userId);

                if (workspaceError) throw workspaceError;
            } else {
                const { error: workspaceCreateError } = await supabase
                    .from('workspaces')
                    .insert({
                        user_id: userId,
                        name: nextBoardName,
                        nodes: [],
                        edges: [],
                        strokes: [],
                        arrows: [],
                    });

                if (workspaceCreateError) throw workspaceCreateError;
            }

            router.replace('/');
            router.refresh();
        } catch (err) {
            console.error('[Welcome] Failed to finish onboarding:', err);
            setError('Belum berhasil menyimpan nama dan board. Coba sekali lagi.');
            setStep('board');
        }
    };

    const currentPrompt =
        step === 'name'
            ? 'Kita mulai dari namamu dulu.'
            : step === 'greeting'
                ? `Senang bertemu, ${displayName}.`
                : step === 'board'
                    ? 'Sekarang beri nama board pertamamu.'
                    : 'Menyiapkan ruang pertamamu...';

    return (
        <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#4D77A8_0%,#5D8DC3_42%,#7FB5F1_78%,#FCFEFF_100%)] px-6 py-8 text-slate-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.26),transparent_42%)]" />

            <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
                <div className="w-full rounded-[40px] border border-white/35 bg-white/18 p-4 shadow-[0_30px_120px_rgba(35,61,94,0.16)] backdrop-blur-xl">
                    <div className="rounded-[28px] border border-white/45 bg-white/84 px-10 py-12 backdrop-blur-md">
                        <div className="mx-auto max-w-2xl text-center">
                            <p className="text-sm font-medium uppercase tracking-[0.28em] text-slate-500">Paapan</p>

                            <div className="mt-8 min-h-[56px]">
                                <h1
                                    key={currentPrompt}
                                    className="animate-[fadeIn_420ms_ease-out] text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl"
                                >
                                    {currentPrompt}
                                </h1>
                            </div>

                            <div className="mt-10 min-h-[110px]">
                                {step === 'loading' && (
                                    <div className="flex items-center justify-center">
                                        <div className="h-10 w-10 rounded-full border-2 border-white/60 border-t-slate-600 animate-spin" />
                                    </div>
                                )}

                                {step === 'name' && (
                                    <div className="animate-[fadeIn_420ms_ease-out]">
                                        <input
                                            ref={nameInputRef}
                                            value={nameInput}
                                            onChange={(e) => setNameInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleNameSubmit();
                                                }
                                            }}
                                            placeholder="Nama kamu"
                                            className="w-full border-0 bg-transparent px-2 py-3 text-center text-5xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400 md:text-6xl"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleNameSubmit}
                                            disabled={!nameInput.trim()}
                                            className="mt-6 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
                                        >
                                            Lanjut
                                        </button>
                                    </div>
                                )}

                                {step === 'greeting' && (
                                    <div className="animate-[fadeIn_420ms_ease-out]">
                                        <p className="text-5xl font-semibold tracking-tight text-slate-900 md:text-6xl">{displayName}</p>
                                        <p className="mt-4 text-base text-slate-500">Sebentar lagi board pertamamu siap dinamai.</p>
                                    </div>
                                )}

                                {step === 'board' && (
                                    <div className="animate-[fadeIn_420ms_ease-out]">
                                        <input
                                            ref={boardInputRef}
                                            value={boardInput}
                                            onChange={(e) => setBoardInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    void handleBoardSubmit();
                                                }
                                            }}
                                            placeholder="Nama board pertama"
                                            className="w-full border-0 bg-transparent px-2 py-3 text-center text-4xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-400 md:text-5xl"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => void handleBoardSubmit()}
                                            disabled={!boardInput.trim()}
                                            className="mt-6 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
                                        >
                                            Masuk ke board
                                        </button>
                                    </div>
                                )}

                                {step === 'saving' && (
                                    <div className="animate-[fadeIn_420ms_ease-out]">
                                        <div className="mx-auto h-10 w-10 rounded-full border-2 border-white/60 border-t-slate-600 animate-spin" />
                                        <p className="mt-5 text-base text-slate-500">Menyimpan nama dan board pertamamu...</p>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <p className="mt-6 text-sm text-rose-600">{error}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
