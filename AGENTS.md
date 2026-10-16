# GitHub Publishing Rule

This repository belongs exclusively to this bot conversation.

Before every push, browser upload, or GitHub API write:

1. Verify the authenticated account is `Dogeeer` and the destination is exactly
   `https://github.com/Dogeeer/apple-cho-render-bots`.
   Stop if either cannot be verified or does not match. Never fall back to the
   user's work account, a default GitHub connector, or cached work credentials.
2. Keep Git identity and credential configuration local to this repository or
   isolated for this conversation. Never change global Git settings or switch
   the user's default GitHub CLI account. Browser login does not establish the
   identity used by Git, GitHub CLI, or a connector; verify the actual channel.
3. Inspect the exact outgoing files and commits. Exclude real `.env` files,
   passwords, tokens, webhooks, proxy credentials, private configuration, logs,
   backups, archives, and `node_modules`. Only placeholder `.env.example`
   content is allowed. Check new history as well as the current files.
4. Run `npm run check` and relevant checks for changed behavior. Resolve failures
   before publishing. Do not force-push, delete remote history, or publish other
   projects under this authorization.
5. After publishing, verify the destination and remote commit/files. Report the
   repository URL, commit, and any checks that could not be completed. Never
   claim a successful push based only on a local commit.

These checks apply on every publication, including browser uploads. If the
account or destination needs to change, obtain an explicit user instruction.
