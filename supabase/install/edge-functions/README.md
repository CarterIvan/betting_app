# Deploying the Edge Functions (no coding, no CLI, no terminal)

PickMates needs two small pieces of privileged backend logic that can't run
in the browser — creating a player's login account, and resetting the
league. These live in Supabase as "Edge Functions." You'll create both
directly in the Supabase Dashboard, no installation of any kind required.

Do this **after** you've run `install.sql` in the SQL Editor.

## For EACH of the two functions below

1. In the Supabase Dashboard, go to **Edge Functions** in the left sidebar.
2. Click **Create a new function** (or **Deploy a new function**).
3. For the name, type **exactly** the name shown below — not a nickname,
   not a different spelling. The app looks for this exact name.
4. You'll get a code editor with some starter code already in it. **Select
   all of that starter code and delete it.**
5. Open the matching file from this folder, select all of its contents,
   copy it, and paste it into the now-empty editor.
6. Click **Deploy**.

Repeat for the second function.

| Function name (type exactly this) | File to copy from this folder |
|---|---|
| `admin-create-player` | `admin-create-player.ts` |
| `admin-reset-league` | `admin-reset-league.ts` |

That's it — once both show as deployed in the Dashboard, this part is done.
You never need to touch these again unless you're told to update them for a
future app version.

## Why two files instead of the "real" ones in this package

The main copies of these functions (under `supabase/functions/`) share a
little bit of code between them, split into separate files — a common way
to organize a real codebase, meant for developers using command-line
tools. The Dashboard's function editor doesn't support that kind of
multi-file sharing, so the two files in *this* folder are self-contained,
paste-ready copies with that shared code already included inline. They
behave identically — nothing about what the app does was changed, only how
the code is packaged for a copy/paste installation.
