# Installation Guide

For complete installation instructions, see [README.md](README.md).

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/actualyze-ai/opencode-monitor.git
cd opencode-monitor
bun install

# 2. Build
bun run build

# 3. Install the OpenCode plugin (REQUIRED)
bun run install-plugin

# 4. Start monitoring
bun start
```

## OpenCode Server Mode (Required for Attach/Browser)

**Important**: OpenCode now defaults to running without an HTTP server. To use the `t` (attach) and `b` (browser) features, you must enable the HTTP server.

Add this to your OpenCode configuration (`~/.config/opencode/config.json`):

```json
{
  "server": {
    "hostname": "localhost"
  }
}
```

> **Why `localhost`?** OpenCode only starts the HTTP server when the hostname differs from the default (`127.0.0.1`). See [anomalyco/opencode#8562](https://github.com/anomalyco/opencode/pull/8562) for a cleaner `server.enabled` option (pending merge).

Or via environment variable:

```bash
export OPENCODE_HTTP_ENABLED=true
opencode
```

## Plugin Configuration

Set these environment variables where OpenCode runs:

```bash
# Monitor host(s) - comma-separated for multiple
export OPENCODE_MONITOR_HOST=127.0.0.1

# WebSocket port (default: 41235)
export OPENCODE_MONITOR_PORT=41235

# Shared token for monitor authentication (optional)
export OPENCODE_MONITOR_TOKEN=your-shared-token

# Full URL override for this OpenCode server (optional)
# Use for HTTPS, custom domains, or complex routing
export OPENCODE_SERVER_URL=https://myserver.com:8443

# Server host to advertise (default: auto-detect from WebSocket connection)
# Set this when the TUI runs on a different machine
export OPENCODE_SERVER_HOST=192.168.1.100

# Server port override (default: auto-detect via lsof)
# Use when behind NAT/port forwarding where external port differs from internal
export OPENCODE_SERVER_PORT=8080

# Enable debug logging
export OPENCODE_MONITOR_DEBUG=1
```

## Security

Set `OPENCODE_MONITOR_TOKEN` in both the monitor TUI environment and the OpenCode plugin environment (the value must match).

Generate a token once (on any machine), then copy the value:

```bash
OPENCODE_MONITOR_TOKEN="$(openssl rand -hex 32)"
echo "$OPENCODE_MONITOR_TOKEN"
```

Set the same value for the TUI and each OpenCode plugin environment:

```bash
export OPENCODE_MONITOR_TOKEN="<paste-token-here>"
```

Security considerations:
- WebSocket traffic is plaintext (no TLS).
- Do not expose the WebSocket port publicly; use a firewall or SSH tunnel if remote.
- Treat the OpenCode host as trusted, since the plugin runs with OpenCode permissions.

## Requirements

- Bun 1.0+ (runtime and test runner)
- Terminal with color support
- OpenCode instances with the monitor plugin installed

See [README.md](README.md) for detailed documentation.
