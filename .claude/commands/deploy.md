Deploy the current working tree to the production server defined in `.claude/deploy.json`.

Execution rules:
- Run from the repository root.
- Use `npm run deploy`.
- This command must deploy the current uncommitted working tree, not just committed Git history.
- After deployment, report whether sync, build, and `pm2 restart` all succeeded.

If deployment fails:
- Show the failing step.
- Do not silently retry destructive actions.
