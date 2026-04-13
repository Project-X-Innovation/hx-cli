# Ticket Context

- ticket_id: cmnxtzw5q001jl30ueqfk5x2d
- short_id: RSH-218
- run_id: cmnxtzw6j001ol30utb5xa8zb
- run_branch: helix/research/RSH-218-research-artifact-gaps-for-non-github-orgs-and
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Research artifact gaps for non-GitHub orgs and Vercel upload workflow

## Description
- Investigate missing artifacts for organizations without GitHub commits
  - Determine whether artifacts are not being produced or not being pushed to Vercel
  - Confirm whether the full `.dot` folder should be uploaded to Vercel just like GitHub
  - Ensure artifacts are retrievable from the UI in both workflows
- Investigate artifact visibility inconsistencies
  - Agent appears to have sandbox access, but artifacts are not visible afterward
  - Confirm why files like `product.md` and scout R&D are missing
  - Check whether this is tied to an organization-level flag
- Review Vercel artifact upload behavior
  - Confirm what currently gets uploaded versus what should be uploaded
  - Verify whether repo policy files and ticket metadata are being omitted
  - Align Vercel artifact handling with GitHub behavior
- Research artifact accessibility requirements
  - Confirm support for consecutive runs using prior artifacts even when they are only stored outside GitHub
  - Explore cross-ticket artifact discovery and retrieval
  - Evaluate CLI support for direct artifact access without GitHub dependency

## Attachments
- (none)
