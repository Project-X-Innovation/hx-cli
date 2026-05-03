# Ticket Context

- ticket_id: cmop8pnih00l9k10tccx9bcos
- short_id: RSH-365
- run_id: cmop8pniw00lek10tz5a21dsa
- run_branch: helix/research/RSH-365-ego-agent-continued
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Ego Agent Continued

## Description
This is going to be a mix of high-level concepts as well as, when we're done with that and we address them thoroughly, we can move on to some practical applications. 



So there's another idea I realized: besides the ego agent for a particular ticket, there's an ego agent for Helix at Large. The ability to:

- talk about multiple tickets

- switch context from one ticket to another

- see a bigger picture

- coordinate multiple tickets

- add new tickets

- double-check tickets

- see how things fit together

 

Building with AI seems to always have this fractal pattern, something I see again and again. If you remember anything from this fractal pattern 



And then there's, on a ticket level, right, it would be great if I can right away get some confirmation of the basics of the ticket before having to wait an hour to see that it actually understood what I wanted. It can be a basic check right away if you know it's coherent. 



So as you see I'm starting to mix and match here, right? I'm already getting into the technical challenges, right? One of the technical challenges in this Ego Agent is the ability to right away or at any time get relevant information, right?



Currently we need to get a Sandbox, we need to clone the repos. To get all that into context, only then can we get a meaningful interaction. We have to load up previous conversations and only then can we get a meaningful interaction. Now it could be that it only takes a few seconds and there's nothing that is stopping us from doing that. That should be one of the things you explore



But here are some things, besides the overall ego agent, that even on a ticket level would be nice. Again I'll reiterate: there's this grand ego agent that I can ask about any ticket, change context from one ticket to another, organize tickets, create new tickets when necessary, and repeat tickets like a grand agent.



Even on a ticket level there are many times I would use the ego agent:

1. When something goes wrong in the orchestration. Something needs to get revisited or the strictness doesn't work.

2. As soon as I've put in a ticket to be able to get some kind of coherence.

3. Chatting with Helix on a ticket while the ticket is still running. There should be nothing that stops you from commenting.



&nbsp;

We actually want to stay away from. But here are some things, besides the overall ego agent, that even on a ticket level would be nice. Again I'll reiterate: there's this grand ego agent that I can ask about any ticket, change context from one ticket to another, organize tickets, create new tickets when necessary, and repeat tickets like a grand agent.



Even on a ticket level there are many times I would use the ego agent:

1. When something goes wrong in the orchestration. Something needs to get revisited or the strictness doesn't work.

2. As soon as I've put in a ticket to be able to get some kind of coherence.

3. Commenting on a ticket while the ticket is still running. There should be nothing that stops you from commenting.



&nbsp;

We actually want to stay away from it's chatting with Helix because we don't want to get distracted from chat. We are more about long-running processes and we are more about making assumptions and getting to the end zone autonomously and interactions with the user but there is nothing that should stop a user from commenting. At that point you can decide maybe to go back to a previous step, or to just integrate the changes in this current step, the comment in the current step, or to just say, "Sorry it's too late." These are all options but there's nothing that should stop an interaction if the user comments. I don't see any reason why you should have to wait for an hour to redirect if you know something is off. Our philosophy is not to make the AI wait for the human but if the human offers information he can just be curt and they got it or that's it. I don't see why not. 



Another thing is this APL, right? What was the APL? It stands for Assumption Preserving Loop. What was the original purpose of it?



The original purpose was again: one of the foundational aspects of Helix is that we don't want Helix to wait for humans. However of course we understood that Helix would have to make many assumptions that may or may not be right or may not be the ones that the user wanted, the human wanted. We came up with this idea that Helix should record all the choice points. Every choice point Helix should record, not wait, not go back and ask the user but record. That way at any moment the user can rewind. The user can rewind and go back to a previous decision and have Helix replay from there. Helix always gets to the end zone. It doesn't wait for the human but Helix records the decisions, the choice points, the forks in the road and a human can always go and say, "Ah where you went A, I want to go B." That was the original purpose of the assumption-preserving loop or APL

And so it would be nice if even during a run the human can interact with this ticket-level ego agent and say, "Oh yeah, you know what? That assumption was wrong. You don't have to wait until the end of the run to now correct it. Just go right away and correct it."



(Oh by the way I'll throw in that git is nice for this rewind because between every stage we may commit. If you ever want to rewind to a previous choice point, git is helpful for that and you have a record. )



And then there are other times when Flow just needs some additional stuff in Helix Net Suite. It could be because something needs to be changed for it to be deployed. I forget, is global so there might be something to get down before something gets going for this next week, something maybe different and what we have seen in production will change.



Has been, let's just be, there are examples or you see or you read. Here's another example: the deploy failed and you can go ahead and read the deployed logs and then you realize what went wrong. The supplier and the Helix nine agents are not connected with them, right? That would be yet another example



And the final example, which is kind of the parallel of the original confirmation purpose, is a summary. Now, when I say summary, I mean something in particular. I don't mean it just makes it look at everything that's been done, writes a short summary, and puts it in the comments. No, that's not good enough. I'm going to a real summary, a summary of exactly what the user needs to see, which is not just the accumulation of the work.



The user should be able to put into the ticket, or at any point, say, "Oh, make sure to double-check this, make sure to think about the benefits and pros or cons of this and that." The help should be able to take into account all of the user's questions and things that needed verification, that needed double checking, that needed a report back. It should be able to, in a very brief comment-size summary, address all the user's fears and concerns about what could have gone wrong. That takes more than just a summary of the content. It takes being there the whole time, reading the original ticket, making sure the user's concerns got taken care of along the way. At the end, it ensures the user that, yes, indeed, all the concerns you mentioned were taken care of. This is how I handle A, and this is how I handle B. Everything you were worried about, I handled correctly. .

## Attachments
- (none)
