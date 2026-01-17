# Contributing to OpenCode Monitor

Thank you for your interest in contributing! This guide covers development setup, architecture, testing, and code standards.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) 1.0+ (runtime and test runner)
- Terminal with color support (256 colors recommended)
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/actualyze-ai/opencode-monitor.git
cd opencode-monitor

# Install dependencies
bun install

# Build
bun run build

# Run in development mode (with watch)
bun run dev

# Or run the built version
bun start
```

### Plugin Development

For active development, symlink the plugin so changes are reflected immediately:

```bash
# Symlink plugin (auto-updates on rebuild)
bun run link-plugin

# Or copy plugin (requires re-copy after changes)
bun run install-plugin

# Remove plugin
bun run uninstall-plugin
```

## Architecture

### Reverse Proxy Design

The monitor uses a reverse proxy architecture where OpenCode plugins connect **to** the TUI (not the other way around):

```
┌─────────────────┐                        ┌─────────────────┐
│  OpenCode       │     WebSocket          │  Session        │
│  Instance       │ ◀──────────────────▶   │  Monitor TUI    │
│                 │                        │                 │
│  Plugin:        │   TUI sends:           │  WebSocket      │
│  - SDK proxy    │   sdk.session.list()   │  Server         │
│  - Event push   │   ───────────────▶     │  (port 41235)   │
│                 │                        │                 │
│                 │   Plugin responds:     │                 │
│                 │   { sessions: [...] }  │                 │
│                 │   ◀───────────────     │                 │
└─────────────────┘                        └─────────────────┘
```

**Benefits:**
- Only TUI needs to be reachable (single ingress point)
- OpenCode instances only need egress (usually allowed by firewalls)
- Works naturally with containers/NAT/Docker

### Source Structure

```
src/
├── app.tsx              # Main React component (OpenTUI)
├── index.tsx            # Entry point with alternate screen handling
├── types.ts             # TypeScript interfaces
├── components/
│   ├── BrowserModal.tsx   # Browser URL confirmation dialog
│   ├── ErrorBoundary.tsx  # React error boundary wrapper
│   ├── primitives.tsx     # Layout primitives (Row, Col, Padding)
│   ├── SessionDetails.tsx # Session details panel
│   ├── SessionList.tsx    # Session list with server groups
│   └── Spinner.tsx        # Animated busy indicator
├── hooks/
│   ├── useKeyboardNavigation.ts # Keyboard input handling
│   ├── useSessionPolling.ts     # Two-tier polling (5s status, 10s details)
│   └── useWebSocket.ts          # WebSocket connection management
├── stores/
│   ├── connectionStore.ts # WebSocket client connections (Zustand)
│   ├── sessionStore.ts    # Server and session state (Zustand)
│   ├── uiStore.ts         # UI state: selection, modals (Zustand)
│   └── index.ts           # Barrel exports
└── lib/
    ├── browser.ts       # Browser URL utilities and launcher
    ├── cache.ts         # Session list caching for instant relaunch
    ├── config.ts        # Centralized configuration constants
    ├── debug.ts         # Debug logging
    ├── errors.ts        # Typed error classes
    ├── format.ts        # Display formatting utilities
    ├── http.ts          # OpenCode SDK client wrapper
    ├── keys.ts          # Composite key management (serverId:sessionId)
    ├── notify.ts        # Desktop notifications with clickable URLs
    ├── session-filter.ts # Current session tree filtering
    ├── session-utils.ts # Session manipulation utilities
    ├── status.ts        # SDK status type mapping
    ├── text.ts          # Text truncation
    ├── tree.ts          # Hierarchical node building
    ├── version.ts       # Build-time version string injection
    ├── ws-sdk.ts        # WebSocket RPC client
    ├── ws-server.ts     # WebSocket server
    └── ws-types.ts      # WebSocket protocol types

opencode/plugin/
└── opencode-monitor.js  # WebSocket client plugin
```

### Plugin Details

The plugin (`opencode/plugin/opencode-monitor.js`):

- Discovers its listening port via `lsof` (handles dynamic ports)
- Connects to monitor TUI via WebSocket
- Proxies SDK requests from TUI to local OpenCode instance
- Pushes real-time events (session.status, permission.updated, etc.)
- Sends shutdown notification on exit
- Supports multiple monitor hosts

### Key Design Decisions

| Decision              | Rationale                                                       |
| --------------------- | --------------------------------------------------------------- |
| Zustand state mgmt    | Eliminates stale closures, enables direct store access          |
| Composite session IDs | `serverId:sessionId` ensures uniqueness across multiple servers |
| Centralized config    | All magic numbers in one place for easy tuning                  |
| Typed error classes   | Consistent error handling with codes for programmatic checks    |
| Incremental rendering | Prevents terminal flicker on updates                            |
| Alternate screen mode | Clean terminal restoration on exit                              |
| Console redirection   | Prevents TUI corruption from stray output                       |

### Session States

| State                    | Indicator   | Description                    |
| ------------------------ | ----------- | ------------------------------ |
| `idle`                   | ● (green)   | Session loaded, not processing |
| `busy`                   | ◐ (spinner) | Actively executing             |
| `retry`                  | ◐ (magenta) | Retrying after error           |
| `waiting_for_permission` | ◉ (yellow)  | Needs user approval            |
| `completed`              | ○ (gray)    | Finished                       |
| `error` / `aborted`      | ✕ (red)     | Failed or cancelled            |

## Scripts

```bash
# Development
bun run dev          # Development with watch mode
bun run build        # Production build
bun start            # Run built application

# Testing
bun test             # Run tests
bun test --watch     # Tests in watch mode
bun test --coverage  # Coverage report

# Code quality
bun run lint         # Run ESLint
bun run lint:fix     # Fix ESLint issues
bun run format       # Format with Prettier
bun run format:check # Check formatting
bun run typecheck    # TypeScript type checking
bun run ci           # Run all checks (typecheck, lint, format, test)

# Utilities
bun run clean-logs   # Remove debug log files
```

## Testing

The project uses [Bun's built-in test runner](https://bun.sh/docs/cli/test) with [fast-check](https://fast-check.dev/) for property-based testing.

### Test Structure

```
src/
├── __tests__/
│   └── app.test.tsx         # App smoke tests
├── components/__tests__/
│   ├── BrowserModal.test.tsx  # Modal dialog tests
│   ├── ErrorBoundary.test.tsx # Error boundary tests
│   └── Spinner.test.tsx       # Spinner animation tests
├── hooks/__tests__/
│   └── useSessionPolling.test.tsx # Polling hook tests
├── stores/__tests__/
│   ├── sessionStore.test.ts   # Session store tests
│   └── uiStore.test.ts        # UI store tests
└── lib/__tests__/
    ├── fixtures.ts          # Shared test data factories
    ├── browser.test.ts      # URL encoding and browser utilities
    ├── cache.test.ts        # Session cache save/load
    ├── errors.test.ts       # Error types and utilities
    ├── format.test.ts       # Display formatting
    ├── http.test.ts         # SDK client wrapper tests
    ├── keys.test.ts         # Composite key utilities
    ├── session-filter.test.ts # Session tree filtering
    ├── session-utils.test.ts  # Session manipulation utilities
    ├── status.test.ts       # SDK status type mapping
    ├── text.test.ts         # Text truncation
    ├── tree.test.ts         # Hierarchical tree building
    ├── ws-server.test.ts    # WebSocket server integration
    └── ws-types.test.ts     # Protocol type guards
```

### Coverage Requirements

Coverage thresholds are enforced at **80%** for lines, functions, and statements, and **70%** for branches.

Files intentionally excluded from coverage:
- `debug.ts` - File I/O side effects
- `notify.ts` - External node-notifier dependency
- `ws-sdk.ts` - Thin wrapper, tested via ws-server
- `hooks/` - Complex React timer/effect testing
- `SessionDetails.tsx` - Complex rendering logic
- Entry points (`index.tsx`, `app.tsx`, `types.ts`)
- `SessionList.tsx` - UI rendering component

### Writing Tests

Use the fixtures in `src/lib/__tests__/fixtures.ts` for consistent test data:

```typescript
import { createMockSession, createMockServer } from "./fixtures";

describe("MyFeature", () => {
  it("should handle sessions", () => {
    const session = createMockSession({ status: "busy" });
    // ...
  });
});
```

For property-based testing with fast-check:

```typescript
import fc from "fast-check";

it("should handle any valid input", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const result = myFunction(input);
      expect(result).toBeDefined();
    })
  );
});
```

## Code Standards

### TypeScript

- **Strict mode** enabled
- **No `any`** types - use `unknown` and type guards
- **Path aliases** - use `@/*` for src imports (configured in tsconfig)

### Formatting

- **Prettier** for code formatting
- **ESLint** for linting
- Pre-commit hooks via **Husky** and **lint-staged**

Run before committing:

```bash
bun run ci  # Runs typecheck, lint, format:check, and tests
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

Examples:
- `feat(ui): add collapsible server groups`
- `fix(ws): handle reconnection on network change`
- `docs: update configuration reference`
- `chore: bump version to 1.2.1`

## Dependencies

### Runtime

| Package         | Purpose                    |
| --------------- | -------------------------- |
| `@opentui/core` | OpenTUI terminal framework |
| `@opentui/react`| React bindings for OpenTUI |
| `node-notifier` | Desktop notifications      |
| `react`         | UI framework               |
| `ws`            | WebSocket client/server    |
| `zustand`       | State management           |

### Development

| Package                  | Purpose                 |
| ------------------------ | ----------------------- |
| `@testing-library/react` | React component testing |
| `eslint`                 | Code linting            |
| `fast-check`             | Property-based testing  |
| `husky`                  | Git hooks               |
| `lint-staged`            | Pre-commit linting      |
| `prettier`               | Code formatting         |
| `tsup`                   | Bundler                 |
| `typescript`             | Type safety             |
| `typescript-eslint`      | TypeScript ESLint rules |

## Pull Request Process

1. **Fork** the repository
2. **Create a feature branch** from `main`
3. **Make your changes** with tests
4. **Run checks**: `bun run ci`
5. **Commit** with conventional commit message
6. **Push** and create a pull request

### PR Checklist

- [ ] Tests pass (`bun test`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Formatting is correct (`bun run format:check`)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional commits

## Debug Logging

Enable debug logging for development:

```bash
# Via CLI flag
bun start -- --debug

# Via environment variable
OPENCODE_MONITOR_DEBUG=1 bun start

# View logs
tail -f $TMPDIR/opencode-monitor-debug.log  # TUI logs
tail -f $TMPDIR/opencode-plugin.log         # Plugin logs
```

## Release Process

Releases are automated via GitHub Actions when a tag is pushed:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "chore: bump version to X.Y.Z"`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push origin main --tags`

The CI workflow will:
1. Run all checks (typecheck, lint, format, test)
2. Build the project
3. Create a GitHub release with tarball

## Questions?

- Open an [issue](https://github.com/actualyze-ai/opencode-monitor/issues) for bugs or feature requests
- Check existing issues before creating new ones
