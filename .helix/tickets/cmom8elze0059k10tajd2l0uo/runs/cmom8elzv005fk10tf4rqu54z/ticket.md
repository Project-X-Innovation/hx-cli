# Ticket Context

- ticket_id: cmom8elze0059k10tajd2l0uo
- short_id: RSH-358
- run_id: cmom8elzv005fk10tf4rqu54z
- run_branch: helix/research/RSH-358-repository-vs-database
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Repository vs Database

## Description
I question the choice to have this stored totally as a database. That way you are limited to interacting only through Helix. Yes there is a CLI that other agents can use but it's not inherently portable. I was suggesting that we use a repository and we can have some kind of baseline agreement that:

- The first level is different mind maps.
- Once you get into a folder everything inside is a representation of a mind map.
- At the core of a mind map there can be a root MD that actually flesh out the mind map.

 I went through this in some detail in the first ticket so go please look at that one for how I imagined it. That allows for the portability and for the depth of the research that will come soon.



So I'm questioning the choice of keeping this in a database as opposed to the way that we've been working. I left as an example the Helix workspace, which is kind of a shared file system, as contacts instead of having little bits. It's just an entire shared file system that we keep in a repository. And in that case anyone can contribute: Helix, Claude Code, humans by hand.

## Attachments
- (none)
