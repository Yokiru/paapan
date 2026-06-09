# Tldraw-Style Seamless Sharing Spec

## Goal

Replace Paapan's current "shared board page" model with a seamless board-sharing model:

- owner opens the normal Paapan board
- owner shares a link
- recipient opens the link
- recipient lands in the same Paapan canvas experience
- access mode is applied inside the same app shell

No separate "shared board" landing page.
No duplicate-first flow.
No alternate viewer layout.

This should feel closer to tldraw's room-style sharing, while staying safer for Paapan.

## Product Direction

### What the user should feel

Sharing should feel like:

- one board
- one link
- one canvas
- different capabilities depending on role

Not like:

- one board for owner
- another special public page for viewers
- another flow for duplication

### Core product model

Treat each Paapan board as a shareable live document.

For the current codebase:

- `workspace` is effectively a `board`
- one `workspace` should become one shared canvas room
- sharing decides access mode, not page identity

## Access Model

For the next sharing model, support these roles:

- `private`
- `viewer`
- `editor`

Definitions:

- `private`: only owner can open
- `viewer`: anyone with link can open the same board in readonly mode
- `editor`: authenticated collaborator can open the same board and edit live

## Important security rule

Do not allow anonymous public editing.

Recommended policy:

- `viewer by link`: no login required
- `editor`: login required

Reason:

- keeps the UX seamless
- avoids destructive public edit links
- gives owner real control

If later desired, public editor links can be added behind a separate higher-risk mode, but not in the first implementation.

## UX Model

## Share panel

Keep the share panel simple, in the style already discussed:

- tabbed header if export remains
- `Share this board` ON/OFF
- access dropdown:
  - `Viewer`
  - `Editor`
- `Copy link`

Remove for now:

- `Allow duplicate`
- public duplicate messaging
- separate shared-board CTA

### Link behavior

When a recipient opens the link:

- they should land in the normal Paapan app canvas
- the board opens directly
- the app resolves the link token and access role
- the UI becomes viewer-mode or editor-mode

Do not show:

- "Shared Board"
- "Open Paapan"
- a separate public preview page shell
- a visibly different product mode

## Canvas behavior by role

### Viewer mode

Viewer opens the same board, but with restricted tools.

Allowed:

- mouse/select
- hand/pan
- pen
- zoom
- pan
- inspect board

Blocked:

- create node
- edit text
- AI actions
- delete
- upload
- board mutation

Toolbar should be reduced to:

- mouse
- hand
- pen

This is a Paapan product decision inspired by tldraw's limited readonly behavior, not a literal tldraw default.

### Editor mode

Editor opens the same board with full editing access.

Allowed:

- full toolbar
- edit all nodes
- create and delete
- AI actions
- uploads
- shared live changes

This mode should behave like true collaboration, not a cloned copy.

## Technical Direction

## Replace the current public shared board page

Current direction in the codebase introduced:

- `/b/[token]`
- a separate shared-board rendering page
- a separate readonly page shell

That should be treated as a transitional implementation.

Target direction:

- link still contains a share token
- but token resolution happens inside the normal Paapan board app
- the board loads into the same canvas surface

Possible routes:

- keep `/b/[token]`, but make it hydrate the normal canvas experience
- or resolve token and redirect into a canonical board route

Recommended user-facing behavior:

- recipient never feels like they left the main app experience

## Data model changes

The current fields added for secure sharing are still useful, but the access model should expand.

Current sharing fields:

- `share_visibility`
- `share_token_nonce`
- `allow_public_duplicate`
- `shared_at`
- `share_updated_at`

Recommended next shape:

```sql
share_visibility text -- 'private' | 'viewer' | 'editor'
share_token_nonce text
shared_at timestamptz
share_updated_at timestamptz
```

Optional collaborator table for editor access:

```sql
create table public.workspace_collaborators (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('editor')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
```

### Recommended interpretation

- `private`: no shared link access
- `viewer`: public link opens board in viewer mode
- `editor`: public link may still open board, but editing only activates for authenticated users allowed to edit

Safer variant:

- public link always opens viewer mode
- elevated editor access requires authenticated membership in `workspace_collaborators`

This is the version I recommend.

## Session resolution model

When someone opens a shared link:

1. app reads token
2. server validates token
3. server resolves board id + share mode
4. app loads the board in normal canvas shell
5. app decides effective role:
   - owner -> full edit
   - collaborator editor -> full edit
   - anonymous/public -> viewer

This means the same link can open the same board for different users, but with different permissions.

That matches the seamless behavior you want.

## Realtime collaboration requirement

If editor-mode should behave like tldraw-style collaboration, this cannot remain a snapshot/public-render system.

We need a live sync layer.

At minimum:

- one board = one room
- synchronized state updates
- presence
- conflict-safe writes

Without this, opening the same board for two editors would still just be "shared access to one document" but not true live collaboration.

## Recommended collaboration architecture

### Phase A: seamless access first

Do this first:

- remove alternate shared-board shell
- route shared links into the normal canvas experience
- enforce viewer/editor capability in the same app
- keep persistence via existing database save flow

This gives seamless UX before full multiplayer.

### Phase B: real collaboration

Then add:

- websocket or realtime transport
- board room presence
- live updates
- cursor/presence later

That is the moment Paapan becomes truly tldraw-like in collaboration behavior.

## Security model

### Viewer

- can open by token
- can inspect canvas
- cannot mutate anything

### Editor

- must be authenticated
- should be owner or listed collaborator
- should not be granted purely by public token

### Owner

- can toggle sharing
- can pick viewer/editor mode
- can revoke link
- can manage collaborators later

## Assets

The previous security warning still applies:

private or shared board access is not truly secure if image URLs remain permanently public.

So even in the seamless model, image strategy still needs to move toward:

- `storagePath` as canonical value
- signed URL or proxy resolution at runtime

Otherwise:

- a board may be access-controlled
- but assets can still leak by raw URL

## What should be removed from the current implementation

When migrating to the seamless model, remove or phase out:

- separate `shared board` heading
- separate shared-board top bar
- `Open Paapan` button
- separate public readonly layout
- duplicate-first public flow

Keep:

- token generation and validation
- secure owner share settings
- regenerate link behavior

## Implementation order

### Phase 1: product and data cleanup

1. Replace `link_view` concept with role-based share access
2. Remove duplicate flow from share panel
3. Update share panel to:
   - ON/OFF
   - `Viewer / Editor`
   - `Copy link`

### Phase 2: seamless routing

4. Refactor `/b/[token]` to load the normal board canvas shell
5. Remove the special shared-board presentation layer
6. Resolve effective role in the board app

### Phase 3: viewer/editor restrictions

7. Implement viewer capability restrictions
8. Reduce viewer toolbar to:
   - mouse
   - hand
   - pen
9. Keep editor toolbar full

### Phase 4: authenticated editor access

10. Add collaborator access model or equivalent editor authorization
11. Enforce editor access server-side

### Phase 5: true live collaboration

12. Introduce room-based sync per board
13. Add live updates
14. Add optional presence/cursors later

## Recommendation

The best version of this idea for Paapan is:

- public shared links open the same Paapan canvas experience
- viewers feel seamless, not redirected into a special page
- editors collaborate on the same board, not a duplicate
- editor permission stays authenticated and controlled

In short:

- copy the `experience shape` from tldraw
- keep the `security discipline` from a serious SaaS app

That combination is better for Paapan than either:

- the current alternate shared-board page
- or fully public edit-by-link from day one
