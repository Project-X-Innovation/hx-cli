# Ticket Context

- ticket_id: cmom8elze0059k10tajd2l0uo
- short_id: RSH-358
- run_id: cmomcmdy2008hk10tksdfpov2
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

## Discussion
- **Helix** (2026-05-01T02:04:47.917Z) [Agent]: Your research report is ready!

## Continuation Context
I would just add some perspective and I think you have access here to the Helix Positioning repository. Tickets are an implementation detail in the long run; they're a mechanism. A Helix, at the end of the day, is a translation layer between the rules of the business and the operations. For all intents and purposes we can consider research, long-term, heavy-duty, autonomous research, as part of operations. One of the things that are happening is that code, research, and operations are all now getting merged and synonymous. 

But I'm digressing. The main idea is that these mind maps are operational plans. The mind maps are the rules. The mind maps are the brain of the business. Mind maps are the Bible. The tickets, if they get created from the mind map, are just implementation deals. They're just a mechanism for the business reality to match the mind map. Yeah sometimes the mind map is actually operational in the sense that it doesn't cover a major deep identity of the business and it's just a fancy to-do list. Yes that's perfectly possible and in that case there may be a direct correspondence to tickets but that's not the general intention. The general intention is that these mind maps are more permanent in nature. Not that each node is permanent but that the mind map describes the business is permanent. Of course the mind map itself changes possibly every hour but the mapping of this mind map to this part of the business is something that exists. That's the high-level idea and so I'm not so concerned with a hard and direct one-to-one correspondence between nodes and tickets. It's more like each node should have a folder. That's what I was thinking.



I was saying the structure can be represented two times:

1. Once in a markdown file in the root

2. Then as a folder structure, each node is a folder



&nbsp;

Inside the folder you can represent a mind map with a folder structure very easily. You just have another layer down of folders and you have sibling folders. In the root you can have whatever is necessary in the root and you can also have a folder for information. We can get creative and brainstorm what exactly the representation of each node should be in this file system. You can represent a mind map as a file system. Inside you can have:

- A description of the tickets that came out of it

- Related research

- Actual research papers

- Links

- All the artifacts that went into this

- Some kind of approval by humans



&nbsp;

Okay this is all that might be more baked into Git directly but that's the idea. The idea is that this is an operational plane and it's not a direct correspondence to tickets. Of course yes! Of course you want an easy way of going from this brain into the operational layer and that is through tickets perhaps. Maybe there's a way to do it even without tickets and the tickets are behind the scenes. If you dig, if you drill down, you'll see the tickets. There's not a direct connection. The mind map changes frequently. A ticket, once it's executed, is done and so the relationship exists but it's more kind of at a point in time, which is what Git is for.
