# Ticket Context

- ticket_id: cmpbtkv9h0001ml0u7uuf1hij
- short_id: RSH-495
- run_id: cmpbtkv9x0007ml0uj9zq5e38
- run_branch: helix/research/RSH-495-helix-for-smb-basic-infra-utility-historical
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
Helix for SMB - Basic Infra & Utility - Historical

## Description
Okay so here's the premise: Helix builds itself and so when you start, you have Helix but your operational pain is zero. As you build, you build your operational pain. Before I even get into the building blocks, let me start with some basic building blocks. What do we need to provision?

1. They need a database. In the case of Breaderie we set that up manually. We don't want to do that. They will need a database we can provision for them.
2. They need some way of managing the code that is eventually going to be their operational plane. Obviously it can't be in the Helix repo so it has to be another repo. In the case of Breaderie we provisioned it but we don't need to do that in this case with Helix for SMB. It should just automatically be provisioned.
3. Next we need a way to actually run their operational plan in Helix. In the case of the Breaderie we deployed it to Vercel and they needed a separate login and a separate everything. They needed to connect the database and the backend and the frontend and deploy it manually and their error is deploying it. This is all unnecessary. We know that this is going to be a staple:
  - We know there's going to be a database
  - We know there's going to be a code repo
  - We know there's going to be an operations plan
  - We know it needs to be deployed

   Let's all get this done out of the box.

 Alright so that's a question: how do we run their code in Helix, right? An iFrame is fishy. There should be a way of just kind of clicking a link and getting there, right? There should be a way that one application can run code in two code bases without doing some kind of iFrame stuff.

Maybe they click a link and they get taken to a different site. That's not the end of the world. Maybe it looks like, I don't know, I'm not sure you can brainstorm some of the different ways but it should be legit. It shouldn't be an iFrame. 



So this is the most basic infrastructure. At this point you would be on par with the Breaderie but the Breaderie was done manually by me. I had to manage customer support and setup.

If we would automatically provision a database, automatically provision a code repo, and figure out a way to run that and have them automatically log in through Helix, they shouldn't need a separate login and they shouldn't need to automatically deploy their code as part of the application of Helix or in some way. There are things where you have a storefront and a backend that exist but the more seamless it can be the better. Right obviously you want them in Helix ideally. 

And at that point we now have feature parity with the Breaderie. You can put in a ticket. It writes the code in your code space, it deploys it, and has a database already attached, and you have a functioning operations plane that you can go and build. That is the basic. Now you have feature parity with Breaderie. 

Customers don't have to worry about provisioning code or deploying code or setting up a DV. That's all taken care of. They just have to put in tickets and things get built and they don't have to figure out how to access it. It's all right there in their Helix.

Helix would have an operational pane the same way. It has all sorts of menu items. One of them would be your operations and of course they can go nuts with that.

## Attachments
- (none)
