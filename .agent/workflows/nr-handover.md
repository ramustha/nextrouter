---
description: Generate NextRouter context handover packet and copy it to target folder
---

1. Ask the user for:
   - The target directory path (e.g., sibling project folder) if not already specified.
   - Whether they want to export the **summarized briefing** (default) or the **original raw context** (logs).
2. Run the appropriate command to write the packet:
   - For **summarized briefing**: `nextrouter handover antigravity claude-code --out [targetPath]` or `npm run cli handover antigravity claude-code --out [targetPath]`
   - For **original raw context**: `nextrouter handover antigravity claude-code --out [targetPath] --original` or `npm run cli handover antigravity claude-code --out [targetPath] --original`
3. Confirm to the user that the packet has been generated and copied successfully.
