# Changelog

All notable changes to the OpenCode Session Monitor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features

- Session history and search
- Custom themes and color schemes
- Performance metrics and analytics
- Configuration UI

---

## [1.2.1] - 2026-01-14

### Changed

- **Consolidated CI/release workflow**: Release job now depends on CI passing (`needs: [ci]`)
- **Single workflow file**: Merged `release.yml` into `ci.yml` for simpler maintenance

### Fixed

- **Release race condition**: Releases now wait for CI to pass before creating artifacts

---

## [1.2.0] - 2026-01-14

### Added

- **Collapsible server groups**: Press Space to collapse/expand server sections
- **Server details panel**: View server info when server header is selected
- **Scroll indicators**: Shows count of items above/below visible area
- **Selectable server headers**: Navigate to server rows (no longer skipped)
- **Terminal tab title**: Shows "oc-mon" in terminal tab instead of "bun"
- **Centralized APP_NAME**: Single source of truth for application name

### Changed

- **Parallel server polling**: Status and details refresh now fetch from all servers concurrently
- **Memoized SessionDetails**: Expensive calculations (age, context, cost, childCount) now use useMemo
- **Event handler map**: WebSocket event dispatch uses handler map instead of if-else chain
- **ModalContainer component**: Extracted common modal styling for consistency
- **checkServerAndExecute helper**: Consolidated server availability check patterns

### Fixed

- **Unhandled promise rejection**: Added catch handler for session details fetch
- **Silent cache errors**: Cache save/load now logs errors in debug mode

### Improved

- **State architecture**: Moved pendingLaunchRequest from global variable to Zustand store
- **Function stability**: Added useCallback for exit function
- **Debug logging**: Cache operations now log errors when debug mode is enabled

---

## [1.1.1] - 2026-01-13

### Fixed

- Footer now renders with bottom border correctly

---

## [1.1.0] - 2026-01-13

### Added

- Collapsible server groups (Space key to toggle)
- Server details panel when server header is selected
- Scroll indicators showing items above/below visible area

### Changed

- Server headers are now selectable during navigation

---

## [1.0.0] - 2025-01-04

First stable release with WebSocket reverse proxy architecture and OpenTUI framework.

### Core Features

- **Terminal User Interface (TUI)**: Full-screen React-based interface for monitoring OpenCode sessions
- **OpenCode Plugin**: WebSocket client plugin for reverse proxy architecture
- **Automatic Instance Discovery**: Plugin connects to TUI via WebSocket, enabling remote monitoring
- **Session Details Panel**: Rich session information including tokens, cost, context, model, and hierarchy

### Architecture

- **WebSocket Reverse Proxy**: Plugin connects to TUI (outbound-only from OpenCode instances)
  - TUI sends RPC-style requests to plugin over WebSocket
  - Plugin proxies SDK calls to local OpenCode instance
  - Immediate disconnect detection (no heartbeat needed)
  - Better firewall compatibility (only TUI needs to be reachable)
- **Controller/Inner Process Model**: Clean session attach/return without port conflicts
  - Controller process manages TUI lifecycle
  - Inner process runs the actual TUI
  - Respawns on exit code 42 for seamless relaunch after `opencode attach`
- **OpenTUI Framework**: Migrated from Ink to OpenTUI for better performance
  - Stable memory usage (~52-100MB with healthy GC)
  - Runtime: Bun
  - Testing: Bun's built-in test runner with fast-check

### Session Monitoring

- Real-time session list with status indicators (idle/busy/retry/error)
- Hierarchical parent-child session tree display
- Smart filtering to show current session tree only
- Live status updates via WebSocket events
- Two-tier polling: 5-second status updates, 10-second detail refresh

### Session Details

- Token breakdown (input, output, reasoning, cache read/write)
- Context usage with percentage and color-coded warnings
- Cost tracking (cumulative across all messages)
- Model/provider information
- Message count
- Session hierarchy (parent/children)
- Project, branch, and directory information

### User Interface

- Full-screen terminal UI with responsive two-pane layout
- Keyboard navigation (arrows, j/k, page up/down, G)
- Visual status indicators with spinner animation for busy sessions
- Grouped sessions by server with visual headers
- Subagent label formatting (`@agent-type` suffix)
- Version string in footer (`oc-mon v1.0.0` or `oc-mon v1.0.0-abc123` for dev builds)

### Session Actions

- Attach to session (launches `opencode attach`)
- Open session in web browser
- Auto-return to monitor after OpenCode exits

### Desktop Notifications

- Notifies when sessions complete (busy → idle)
- Notifies when sessions need permission approval
- Batches multiple notifications within 500ms window
- Enabled by default, disable with `--no-notify`

### Configuration

- `OPENCODE_MONITOR_HOST` - Monitor host(s), comma-separated
- `OPENCODE_MONITOR_PORT` - WebSocket port (default: 41235)
- `OPENCODE_MONITOR_TOKEN` - Shared token for authentication
- `OPENCODE_SERVER_URL` - Full URL override for OpenCode server (HTTPS, custom domains)
- `OPENCODE_SERVER_HOST` - Server IP to advertise (default: auto-detect)
- `OPENCODE_SERVER_PORT` - Server port override (NAT/port forwarding)
- `--ws-port` CLI option for configurable WebSocket port
- `--no-notify` CLI option to disable desktop notifications
- `--debug` CLI option for debug logging
- `--memory-debug` CLI option for memory leak investigation

### Technical Implementation

- Composite session IDs (`serverId:sessionId`) for multi-server uniqueness
- Refs for polling to avoid React dependency array issues
- Incremental rendering to prevent terminal flicker
- Alternate screen mode for clean terminal restoration
- Console output redirected to log file to prevent TUI corruption
- Build-time version injection via tsup

### Dependencies

- `@opentui/core` ^0.1.68 - Terminal UI framework
- `@opentui/react` ^0.1.68 - React bindings
- `react` ^19.2.3 - UI framework
- `node-notifier` ^10.0.1 - Desktop notifications
- `ws` ^8.18.3 - WebSocket client/server
- `zustand` ^5.0.9 - State management
- `typescript` ^5.0 - Type safety
- `tsup` ^8.0 - Bundler
