import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_FIRST_WORKSPACE_NAME = 'My First Workspace';

type OnboardingWorkspace = {
    id: string;
    name: string | null;
};

export type UserOnboardingState = {
    userId: string;
    profileName: string;
    suggestedName: string;
    workspaceId: string | null;
    workspaceName: string;
    workspaceCount: number;
    needsOnboarding: boolean;
};

const normalizeName = (value: string | null | undefined) => (value || '').trim();

export async function getUserOnboardingState(supabase: SupabaseClient): Promise<UserOnboardingState | null> {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const [profileResult, workspaceResult] = await Promise.all([
        supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle(),
        supabase
            .from('workspaces')
            .select('id, name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(5),
    ]);

    const profileName = normalizeName(profileResult.data?.full_name);
    const metadataName = normalizeName(
        typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
    );
    const fallbackName = normalizeName(user.email?.split('@')[0] || '');
    const suggestedName = profileName || metadataName || fallbackName;

    const workspaces = ((workspaceResult.data || []) as OnboardingWorkspace[]);
    const firstWorkspace = workspaces[0] || null;
    const workspaceCount = workspaces.length;
    const workspaceName = normalizeName(firstWorkspace?.name) || DEFAULT_FIRST_WORKSPACE_NAME;
    const boardNeedsNaming = !firstWorkspace || !normalizeName(firstWorkspace.name) || workspaceName === DEFAULT_FIRST_WORKSPACE_NAME;
    const hasMeaningfulName = Boolean(profileName || metadataName);

    return {
        userId: user.id,
        profileName,
        suggestedName,
        workspaceId: firstWorkspace?.id || null,
        workspaceName,
        workspaceCount,
        needsOnboarding: workspaceCount <= 1 && (!hasMeaningfulName || boardNeedsNaming),
    };
}
