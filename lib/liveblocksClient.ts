"use client";

import { createClient, type Room } from '@liveblocks/client';

import { supabase } from '@/lib/supabase';
import type { BoardPresenceUser } from '@/types';

export type LiveblocksBoardPresence = BoardPresenceUser & Record<string, any>;

export type LiveblocksBoardEvent =
    | {
        type: 'board-delta';
        payload: any;
    }
    | {
        type: 'board-updated';
        payload: {
            boardId: string;
            senderId: string;
            updatedAt: number;
        };
    };

export type LiveblocksBoardRoom = Room<LiveblocksBoardPresence, {}, any, LiveblocksBoardEvent>;

let client: ReturnType<typeof createClient> | null = null;

export const getLiveblocksClient = () => {
    if (client) return client;

    client = createClient({
        authEndpoint: async (room) => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            const response = await fetch('/api/liveblocks/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ room }),
            });

            return response.json();
        },
        throttle: 16,
        lostConnectionTimeout: 4000,
    });

    return client;
};

export const getBoardRoomId = (workspaceId: string) => `paapan:board:${workspaceId}`;
