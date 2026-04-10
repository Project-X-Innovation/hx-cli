# Ticket Context

- ticket_id: cmns6wwa9004yjt0t5rsnkef4
- short_id: RSH-195
- run_id: cmns8qa2u007gjt0t0jbdcy68
- run_branch: helix/research/RSH-195-code-not-being-written
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Code not being written

## Description
Something strange is going on in one of the tickets. Today we had made a whole bunch about different gits and external files. You can go and reference them all, but at some point I think we stopped committing any code at all to git. I just deployed a whole bunch of tickets, and I don't see the first one. I was surprised; the first one I was like, "Oh, interesting, maybe got rewritten or overwritten." The second one, again, surprised, "Oh, maybe something happened," and then I started looking more carefully and I see no code changes in any of these branches.

I think somewhere along the lines we made a huge mistake and actually stopped pushing any code to git. Now I'll remind you there are different circumstances. I think when we don't push non-code to git, we keep artifacts externally, but of course all code changes should always be committed and later merged and deployed. Something funny is going on. Take a look, find the problem, and tell us how to fix it. Narrow it down to a specific deployment/ticket gone wrong.

## Attachments
- (none)

## Continuation Context
cmnrxs8ev0037hu0u2b459aqf cmnrlcg4000dmiq0uh1edryk6 cmnrwc9lp000hhz0u4gk7fokt 
While your analysis may be correct, you have incorrectly diagnosed the problem. The problem is actually on not in hiding-artifacts-from-GitHub organization like DMW. In fact, on the organization that I am right now, project x, I, am having this problem. Please see the ticket above, where there were code changes listed in the implementation actual, but there are no code changes in the PR on GitHub. There are a number of tickets where this is happening. I will include more links.
