'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';

interface AuthTransitionLinkProps extends React.ComponentProps<typeof Link> {
    children: React.ReactNode;
}

export default function AuthTransitionLink({
    href,
    onClick,
    children,
    ...props
}: AuthTransitionLinkProps) {
    const router = useRouter();

    const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        const targetHref = typeof href === 'string' ? href : href.toString();
        if (!targetHref.startsWith('/')) {
            return;
        }

        event.preventDefault();

        const doc = document as Document & {
            startViewTransition?: (callback: () => void | Promise<void>) => unknown;
        };

        if (typeof document !== 'undefined' && doc.startViewTransition) {
            doc.startViewTransition(() => {
                router.push(targetHref);
            });
            return;
        }

        router.push(targetHref);
    };

    return (
        <Link href={href} onClick={handleClick} {...props}>
            {children}
        </Link>
    );
}
