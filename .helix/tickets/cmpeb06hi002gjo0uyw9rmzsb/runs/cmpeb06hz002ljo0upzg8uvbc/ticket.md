# Ticket Context

- ticket_id: cmpeb06hi002gjo0uyw9rmzsb
- short_id: FIX-528
- run_id: cmpeb06hz002ljo0upzg8uvbc
- run_branch: helix/fix/FIX-528-longest-run-should-include-tickets-change-slash
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Longest run should include tickets change slash after that run consecutively

## Description
Currently the longest run only shows on a one-ticket level. However if somebody chains a dozen tickets together, technically that's one big run and that should count as the longest run. Caveat: it's only when it's running consecutively. If ticket A stops and then later somebody does a / after, that obviously is not one run, that's two separate runs. If somebody chains many /after and they run consecutively without interruption, like for example they can run all night, that should count as one big run.

## Attachments
- (none)
