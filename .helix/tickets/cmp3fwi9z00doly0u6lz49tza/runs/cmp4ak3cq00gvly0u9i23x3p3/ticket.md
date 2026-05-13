# Ticket Context

- ticket_id: cmp3fwi9z00doly0u6lz49tza
- short_id: RSH-445
- run_id: cmp4ak3cq00gvly0u9i23x3p3
- run_branch: helix/auto/HLX-445-verification-elephant
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Verification Elephant In The Room

## Description
Besides the fact that Helix NetSuite, our core product, doesn't have UI verification, there are some substantial theoretical and philosophical topics that need to be dealt with. 



Currently the Verifier has multiple jobs that we title as verification:

1. One job is to just ensure the basic quality.

2. Another job is to bring screenshots to the user, which we can call demoing.

3. A third job is that, assuming if you actually walk through the code in real life, if you walk through the user interface in real life, you'll pick up a bunch of missing pieces that just writing code would not do. Like any human developer, they always have the UI open in front of them.

 

Now the truth is this is really several different jobs. What we currently call verification is mainly checks that the implementation agent can do and probably is already doing. There is no reason why I would be disappointed to find out that the implementation agent is not already doing these kinds of checks, is not already adding data to the development database and walking through it as it goes. In terms of these basic verifications they're not very creative currently. I would say that's already the job of the implementation agent. How to enforce that is a different question. 



Then there's the demo aspect and right now it doesn't really do a good job at that either. The pictures are random. Most of them don't show any point at all and they're certainly not extensive. They certainly do not get across all the features and all of the paths and all the scenarios that we want to show have been implemented. For the most part now they're useless. Sometimes we get very lucky and there's a screenshot of exactly the thing I want to see but in terms of demoing it doesn't actually show me what functionality was provided. It's not clear to me exactly how it shows me anything. Yes it may be that sometimes things get picked up just from showing opening the UI but that's not really a major thing.



That's the third thing and okay, it's better to have some verification than no verification. Better to at least try to get in but it's not really going through the scenarios. It's not really verifying that what the user asked to build or the problem that the user has was solved. It's certainly not demonstrating that to me so I would like to maybe come up with a new theory of how to do this. 



So before I continue, you can pause for a minute and brainstorm this problem. Think about it in a bigger theory of how things should work. Think of maybe two, three, four different options and then you can continue with my suggestions. 



I think all of the steps are really a sandwich. I think that each one has an implementation, a doing layer, and then a verification layer after the planning/doing layer. 



So for example what we now call verifications, those should somehow be implemented by the corresponding tests. Those tests should be verified by the corresponding aspect of the implementation agent. The implementation agent goes and implements and those verifications should be done.



Now to some extent the implementation agent is the verification agent of the implementation plan. Or at least when he goes and checks the plan, he's playing that role. Even in the implementation agent there are maybe a few roles. In the theory we can brainstorm where they belong, right? Is that implementation? First of all it has to be that an implementation has to verify the information as a verified implementation plan. It's doing all this in real time so we can even pause on that part for a minute. 



But whatever we come up with that the verification that we now call verification is really the verification aspect of the implementation. It is doing basic checks to see that the implementation, "works". Now really it should go all the way back up the stack and we should always verify that the implementation matched every layer of this stack. Why shouldn't we go back up to the tech research and say that the implementation matches what was outlined, described, required in the tech research? That it actually implements the decisions made in the tech research. The tech research would then have to come up with its own list of "verifications" or its own list of checks that it is going to do. Technical checks, right? We need maybe a good word for each one.



After the implementation is done, the implementation shows that the implementation plan was followed and marks it along the way. That's an important part of following the plan. Then after that's done it goes back to the tech research agent. The tech research agent, maybe first you go back to the implementation plan agent. The implementation plan agent can say, "Yes my plan was carried out successfully. It can be graded." Then it goes back to the research agent and the research agent looks at its previously outlined requirements and says, "Check, check, check, check, check." Then it goes back up to the product agent and the product agent says, "Oh here for the product agent some people call scenarios." The product agent would say, "OK here are the seven or eight or 15 scenarios that a user or an agent, the general user, should be able to accomplish after this implementation." Then the product agent should fire up, perhaps, a browser or use the preview environment, maybe even use the preview environment. That could be good if he uses the preview environment and fires it up. It says, "OK here are the ten scenarios I said must be possible. I'm going to go through all ten: one, check, two, check, three, check." That would let you know that the product that you actually wanted to build was built and that it can do all the things that it needs to be done. Each plan took a certain level of abstraction. The verifications should go back up that chain and measure as well. 



And then finally you can have a demo agent that takes a video or maybe a specific set of pictures. We can maybe figure out what the right thing is. The whole purpose of that is to demonstrate to the user (the one who put in the ticket or the one who made the ask) that it has actually been done. We can separate that from verification.



Verification is an internal process of making sure that we have hit our mark. That we have met the requirements for whatever level of planning, whatever level of direction, that those have been met. The capabilities have been met. The technicalities have been met. The protocol's been met. The user can do everything the user needs to do, right? These are all on different levels.



Then there's a final demo agent and the final demo agent is just for one purpose. It's not a verification agent. It just makes a demo for the user that walks them through. That's the only video the user really needs, video/pictures if, for whatever reason, a video is not the right thing. 



So I don't need to talk about the implementation of how this is going to be done. Right now I'm working on the theory, I'm working on the concepts. Let's stay on that level of abstraction of concepts and theory. Of course you can look at the code to familiarize yourself but in the report you don't have to bring actual code examples. Let's talk about the theory, how it should play out. You can look at the code for your own information but let's talk about concepts on a conceptual level and how it plays out in Helix

## Attachments
- (none)
