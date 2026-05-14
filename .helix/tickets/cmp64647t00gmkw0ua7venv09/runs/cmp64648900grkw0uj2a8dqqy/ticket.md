# Ticket Context

- ticket_id: cmp64647t00gmkw0ua7venv09
- short_id: RSH-465
- run_id: cmp64648900grkw0uj2a8dqqy
- run_branch: helix/research/RSH-465-helix-core-infrastructure
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Helix Core Infrastructure

## Description
This is meant to be a somewhat high-level understanding of the core flow of Helix. I want all of us to have it in our bones, a very deep understanding of how it works. We're not going to go into specific code examples unless it's extremely necessary. The idea is to understand the architecture, how it works, and how everything relates. Do your best to explain why decisions were made in a certain way. If you think decisions were made that were bad, it's also a good time to point out what decisions were made that were bad when they come up and what things should be done differently. What are the weak points? What are the strong points? 



And so I'm going to ask some specific questions just to give you direction. The point of this report is not to answer the specific questions necessarily but to give a full architectural overview, a full flow overview, a full understanding of the core trade-offs. For all the people that are going to expand on it, it will explain why things were done this way and how to expand. 



So my first question is: what is the relationship between the orchestrator and the agents? What is the role of the orchestrator at each step and why? Why does the orchestrator do certain things? Why can't the agents do them and vice versa? Why are the agents doing things that the orchestrator can? I understand the question doesn't make any sense and so you don't have to answer it verbatim. I'm just explaining to you the things that I'm curious about. 



Right so let's follow the whole flow. Tickety goes in, right? Then where does it go? What happens to it? Does it go to GitHub? Does it go to the database? Does it go into an agent? Into Cloud? Is the sandbox provisioned? Then Cloud is installed and then Cloud is run.



What happens to the next step after Scout? Do they close the sandbox? Do they reopen a new sandbox? Do they close the terminal and open a new agent? Is the Scout agent still alive? Are all the agents still alive? Can they theoretically talk to each other if we added such a program or is that structurally impossible? Can I later talk to agents or do they just no longer exist? 



What about context? What is context? What context is available? Do they have access to the CLI? Have they been using the CLI? Can they get previous tickets? Can any organization get previous tickets or just us? What other context is available to the agents? What is the relationship between them? How do they share information? How do they share information with the orchestrator? Do they share information? I'm not even sure I'm asking the right questions. 



What happens at the end of the process? Does it go back to the orchestrator? Does the sandbox get closed? Are all the agents still living on the sandbox? Is the last agent only living in the sandbox? Have there been many sandboxes open and closed?



I'm trying to understand the tradeoffs of the system, the depth of the system, not at code level. I want to get it. I want to grok it.

## Attachments
- (none)
