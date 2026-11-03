import { readFileSync } from "fs";
import path from "path";
import show from "@/data/show.json";
export const SITE = "https://bev-station-studio.vercel.app";
export const mcpUrl = (t: string) => `${SITE}/m/${t}/mcp`;
export const guide = () => readFileSync(path.join(process.cwd(), "data", "agent-manual.md"), "utf8").replaceAll("{{SITE}}", SITE);
export const agentDoc = (t: string) => `# Install the ${show.title} studio

You are an AI agent working with ${show.author}. Connect yourself to the studio, confirm it works, then read the manual below and work from it.

Connection URL (private, treat it like a password; don't post it anywhere public or commit it to a repo):
${mcpUrl(t)}

It is a remote MCP server over streamable HTTP. It needs no login, key or header. The secret is in the URL.

## Step 1: install it

Claude Code:
    claude mcp add --transport http --scope user bev-station ${mcpUrl(t)}

Codex CLI:
    codex mcp add bev-station --url ${mcpUrl(t)}

Any other MCP client, as JSON:
    {"mcpServers":{"bev-station":{"type":"http","url":"${mcpUrl(t)}"}}}

Claude Code and Codex read their server list when a session starts, so a new session is needed after adding it.

So you aren't stopping to ask permission on every save:
- Claude Code: add "mcp__bev-station" to permissions.allow in your settings.
- Codex: in config.toml, under [mcp_servers.bev-station], add: default_tools_approval_mode = "approve"

If you can't change your own settings, walk her through her app, one step at a time:
- Claude, at claude.ai on a computer: Customize, Connectors, Add, Add custom connector. Name: Bev Station. URL: the one above. Continue, leave No sign-in selected, Add, Connect. Under Tool permissions, set the tools to always allow so it doesn't ask every time.
- ChatGPT, at chatgpt.com on a computer: Plugins, Add, Add custom MCP server. Name: Bev Station. URL: the one above. Authentication: No authentication. Tick I understand, Create as a plugin, Connect. In a new chat, type @Bev and pick it.

## Step 2: confirm it

Call list_episodes. You should get the list of episodes. Tell the writer it worked. If you can't save instructions anywhere permanent, call start_here at the start of each session; it returns the manual below.

## Step 3: if it doesn't work

Check that you copied the whole URL, that it ends in /mcp, and that you started a new session. If it still fails, tell her to press "Something's not working" at the bottom of ${SITE}/connect and paste the error. Luna picks it up.

${guide()}
`;
