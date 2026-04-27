# Rechats

Search, browse, and resume Claude Code chat sessions.

## Features

- **Search across all chat sessions**: Find conversations by content, working directory, or fuzzy matching
- **Dual navigation**: Navigate between search results and use Cmd+F for in-content search
- **Session preview**: View full conversation history with syntax highlighting
- **Quick resume**: Copy resume commands to continue sessions
- **Filter by directory**: Include/exclude sessions by working directory

## Installation

Download the latest release from [GitHub Releases](https://github.com/lhead/rechats/releases).

For macOS:
1. Download `Rechats-darwin-x64.zip`
2. Extract the zip file
3. Right-click `Rechats.app` and select "Open"
4. Confirm to open the app

## Usage

Launch the Rechats app to:

1. Browse recent Claude Code chat sessions
2. Search by keywords (press Enter to search)
3. Toggle fuzzy matching
4. Filter by working directory
5. Use Cmd+F for in-content search
6. Click "Copy Resume Command" to get the command to resume a session

## Search Features

- **Exact match**: Find exact phrases in conversations
- **Fuzzy match**: Find approximate matches (toggle with checkbox)
- **Directory filters**: Include/exclude sessions by working directory (comma-separated)
- **Dual highlighting**: Yellow for main search results, green for Cmd+F matches

## Requirements

- macOS (x64)
- Claude Code sessions stored in `~/.claude/projects/`

## Development

```bash
git clone https://github.com/lhead/rechats.git
cd rechats
npm install
npm run build
npm start
```

## License

MIT
