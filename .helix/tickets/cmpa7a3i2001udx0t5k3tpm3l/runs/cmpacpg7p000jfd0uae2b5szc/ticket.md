# Ticket Context

- ticket_id: cmpa7a3i2001udx0t5k3tpm3l
- short_id: FIX-483
- run_id: cmpacpg7p000jfd0uae2b5szc
- run_branch: helix/fix/FIX-483-github-issues
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Github Issues

## Description
I'm getting this error. See the image.

## Attachments
- image.png (image/png, 220175 bytes)

## Discussion
- **Helix** (2026-05-17T20:31:25.374Z) [Agent]: Changes applied to 1 repository. Verification could not be fully completed — please review the changes manually.
- **Usher** (2026-05-17T22:15:35.433Z) [Helix]: @Helix why have I never heard of this GitHub username env var?
- **Helix** (2026-05-17T22:15:51.655Z) [Agent]: That's exactly the problem Helix identified! **`GITHUB_USERNAME` was never documented anywhere** — it existed in the server config code but was completely absent from `.env.example`. Same goes for `GITHUB_TOKEN` and `GITHUB_ORG`.

So when someone went to configure the production server, there was no reference file listing these variables, making it easy to miss them entirely (or only add some of them, which is exactly what happened — `GITHUB_TOKEN` was added first, but `GITHUB_USERNAME` was overlooked).

The fix Helix made was to add all three variables to `.env.example` with clear comments explaining that they work together for library repo authentication and all need to be set at the same time. That way no one gets caught out by this again.

> ⚠️ **Action needed on your end**: The code change is a documentation fix, but you still need to actually set `GITHUB_USERNAME` (and `GITHUB_ORG` if not already set) in your production environment to resolve the live error.
- **Usher** (2026-05-17T22:16:23.743Z) [Helix]: Why do I need org and username?
- **Helix** (2026-05-17T22:16:33.449Z) [Agent]: Great question! They serve different purposes when authenticating with GitHub:

- **`GITHUB_USERNAME`** — the account that owns or has access to the private repo(s). It's used as the credential identity when making authenticated requests.
- **`GITHUB_TOKEN`** — the password/token for that username (a personal access token).
- **`GITHUB_ORG`** — tells the server *which GitHub organization* to look under when resolving library repos. Without it, the server doesn't know where to find the repos, even if it has valid credentials.

Think of it like: the **org** is the address, the **username + token** is the key to get in. You need both the address and the key for authenticated access to organization-owned private repositories.
- **Usher** (2026-05-17T22:18:05.076Z) [Helix]: And why are some of my tickets passing and some failing?
- **Helix** (2026-05-17T22:18:14.582Z) [Agent]: Most likely because not all tickets involve fetching from private GitHub repos. The ones that **pass** probably don't need to authenticate with GitHub at all — they work with code or data that's already available locally. The ones that **fail** are the ones that try to access a private library repo, which requires all three env vars (`GITHUB_USERNAME`, `GITHUB_TOKEN`, `GITHUB_ORG`) to be set correctly.

So it's not random — it's tied to whether a given ticket's work touches those authenticated GitHub resources or not. Once you set `GITHUB_USERNAME` (and confirm `GITHUB_ORG` is set) in your production environment, the failing ones should start working too.
- **Usher** (2026-05-17T22:32:45.825Z) [Helix]: All right I've set it here in the test M. You should be able to verify and add it to the.env.example.
