# Ticket Context

- ticket_id: cmns6lb7j003pjt0to9sz85ut
- short_id: BLD-194
- run_id: cmnsxsjax002oi50uuucru7h2
- run_branch: helix/build/BLD-194-ticket
- repo_key: helix-cli
- repo_url: https://github.com/Project-X-Innovation/helix-cli

## Title
#ticket

## Description
You should be able to hashtag a ticket to include everything about the ticket in the context for Helix. When I put #a ticket in the prompt, every artifact and everything known about this ticket should be included in the information sent by the orchestrator to every agent. In particular, when it is a research ticket or report ticket, the final product, which is the report, should also be of course included in the information passed to the agents. 

The UX can be similar to the slash after command, where when I put a hashtag, I see a list of tickets and I can filter by the new cute number and the name. Make it slick and make it cool.

Think about all the things that can go wrong. Think about all the things that can go wrong if you're trying to pass the information from the orchestrator down to the agents. Think about all the different ways the agents would struggle to get the context. Think about all the different artifacts that might be missed, that might be overlooked.

Take a step back, think about the whole thing, relax, come up with something beautiful, and let's make it happen.

## Attachments
- (none)

## Continuation Context
## ROLE
This is a CONFLICT RESOLUTION run. Your only job is to resolve git merge conflicts.
Do NOT re-implement the original ticket. Do NOT add new features or refactor code.

## TASK
Read `.helix/merge-conflicts.json` in each repo for the list of conflicted files.
Each entry includes `ticketCommits` and `stagingCommits` context explaining what each side changed.
You MUST resolve conflicts in EVERY file listed in merge-conflicts.json. Do not stop until all files are clean.

## RESOLUTION STRATEGY
Process files one at a time. Read the file, resolve all markers, write it back, then move to the next file.
1. For each conflicted file, understand the intent of both the ticket changes and the staging changes.
2. Remove all `<<<<<<<`, `=======`, and `>>>>>>>` conflict markers.
3. Reconcile both sets of changes so both intents are preserved.
4. When both intents cannot coexist, favor the staging version and re-implement the ticket's intent on top.

## FILE-TYPE GUIDANCE
- **JSON files**: Carefully parse the structure around conflict markers. Merge array items and object keys from both sides. Ensure valid JSON after resolution.
- **Test files**: Include all test cases from both sides. Do not drop tests from either branch.
- **TypeScript/JavaScript source**: Merge imports from both sides. Ensure no duplicate imports or missing references.

## VERIFICATION
After resolving ALL files, verify no conflict markers remain by searching every resolved file for `<<<<<<<`, `=======`, and `>>>>>>>`. If any remain, fix them before finishing.

## CONSTRAINTS
- Do NOT modify files that are not listed in merge-conflicts.json.
- Do NOT re-implement the original ticket description — only resolve merge conflicts.
- Do NOT run scout, diagnosis, or planning steps — go straight to resolving conflicts in the source files.
- Only touch files with conflict markers or files listed in merge-conflicts.json.

## FALLBACK
If no `.helix/merge-conflicts.json` exists in a repo, the merge was clean for that repo — no changes needed.
