# Ticket Context

- ticket_id: cmns3kl2l00c2ex0vx0mgubik
- run_id: cmns3kl2x00c7ex0vf7j8q30j
- run_branch: helix/ticket/cmns3kl2l00c2ex0vx0mgubik
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Side Quests

## Description
Okay, so I want to explore an interesting idea with you where right now Helix is really good, but we're exploring how to make it even better, even slicker, even smoother, and really take it to the next level. 
Currently, when a user enters a ticket, it goes through one flow. It doesn't matter if it's the smallest bug fix or if it's the largest ticket that would take a team of 30 engineers to make. 

This is a little bit unfair, as different tickets need different levels of quality and time and attention. For the sake of this context, we can leave the current flow as the baseline. In a future date, we can explore shortening it, but for now keep the current flow as the baseline. Let's say the smallest bug fixes get this baseline, and let's explore how to give bigger tickets more time and attention. 

One way that I'm thinking of doing this that is possible is through side quests. What is a side quest? This is a standard thing that developers do all the time. You ask them to do A, and before they did A, they got lost in C, D, E, and F, and they added all these cool features and maybe things that were genuinely necessary and helped smooth along the way as interim steps.

In mathematics, you have the concept of a lemma to a proof, so maybe there were various lemmas: Lemma 1, Lemma 2, Lemma 3 that led to the proof. The developer would do mini feature A, mini feature B, mini feature C, and finally get to the feature that you had asked for. I think this is a normal part of development. 
I'm thinking that one of the things that we can allow the agents, these many, many agents that make up the Helix Flow, to do is call a side quest. It's a spin-off side quest, and what it does is it pauses execution and waits until this side quest is completed. The side quest is another ticket. It can be a bug fix. It can be usually not, or it can be a build. It can be research.

Suppose the ticket comes in and it's a really big ticket and it's not exactly clear. The product agent starts, and he sees, "Oh well, this is really big. You can spin off a research ticket." He can suspend, "Okay, I'll wait. Do the research, spin up, create a new ticket, a research ticket, done by the product agent. I'll wait, or I'll return control to the orchestrator; that's to be determined." Once the research is done, the product can continue, or the product research can do that, or maybe the product agency says, "Oh, I'm going to implement this big feature, but it would be nice if I can do it bit by bit. Let me start with A, I'll send that through and move on to B, send that through, on to C." This kind of side quest covers this concept. It covers many concepts, right? It covers a concept of doing research first. It covers a concept of sub tickets. 
Another thing to look into maybe is expecting multiple side quests. Do they all go at once? Do we want to chain them using /after? Do we want to do research and then chain it with the /implement command, which is currently being built? Can many run in parallel? Do we want some able to go in parallel and some chained? You know, you really get a whole ecosystem here. The idea is to, from these built-in blocks that we have, this Helix Flow to start stacking on. This is a one-dimensional flow with ten steps, each one gets implemented, but now we can start stacking blocks and blocks and blocks out of these flows. 

But this is just one way I'm thinking of doing it. You can brainstorm also, right? You understand the concept, right? The concept is how do we build blocks on top of this Helix? How do we make things better? How do we get Helix to run instead of for two hours for 10 or 20 or 30 hours? Instead of a human having to re-run because there wasn't enough information or enough detail, Helix just does that on his own. 

So it's really a loaded question. Think about my solution brainstorm. Think about how you want to do that: what are the mechanisms, what kind of implementation, what are the risks, just how to implement it? I have a hundred questions, but also think about other options to accomplish the same goal that may be better and more clever. No matter what, it's got to be cute, it's got to be slick, it's got to be helpful; the UX has to be stellar. 

I'm looking forward to seeing what you come up with. It's going to be great.

## Attachments
- (none)
