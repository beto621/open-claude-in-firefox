#!/bin/bash
set -e

# Install script for Open Claude in Firefox extension.
# Registers the native messaging host for Firefox.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_DIR="$SCRIPT_DIR/host"
NATIVE_HOST_PATH="$HOST_DIR/native-host-wrapper.sh"
HOST_NAME="com.anthropic.open_claude_in_firefox"
EXTENSION_ID="open-claude-in-firefox@anthropic"

# Verify node is available
if ! command -v node &> /dev/null; then
  echo "Error: node is not installed. Install Node.js first."
  exit 1
fi

# Install npm dependencies
if [ ! -d "$HOST_DIR/node_modules" ]; then
  echo "Installing npm dependencies..."
  cd "$HOST_DIR" && npm install
  cd "$SCRIPT_DIR"
fi

# Create the native host wrapper script
cat > "$NATIVE_HOST_PATH" << WRAPPER
#!/bin/sh
exec "$(which node)" "$HOST_DIR/native-host.js"
WRAPPER
chmod +x "$NATIVE_HOST_PATH"

echo "Created native host wrapper: $NATIVE_HOST_PATH"

# Firefox native messaging manifest uses allowed_extensions (not allowed_origins)
generate_manifest() {
  cat << EOF
{
  "name": "$HOST_NAME",
  "description": "Open Claude in Firefox Native Messaging Host",
  "path": "$NATIVE_HOST_PATH",
  "type": "stdio",
  "allowed_extensions": ["$EXTENSION_ID"]
}
EOF
}

install_host() {
  local browser_name="$1"
  local host_dir="$2"

  if [ ! -d "$(dirname "$host_dir")" ]; then
    echo "  Skipping $browser_name (not installed)"
    return
  fi

  mkdir -p "$host_dir"
  generate_manifest > "$host_dir/$HOST_NAME.json"
  echo "  Installed for $browser_name: $host_dir/$HOST_NAME.json"
}

echo ""
echo "Installing native messaging host..."
echo ""

case "$(uname)" in
  Darwin)
    install_host "Firefox" \
      "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
    ;;
  Linux)
    install_host "Firefox" \
      "$HOME/.mozilla/native-messaging-hosts"
    ;;
  *)
    echo "Error: Unsupported platform $(uname). This script supports macOS and Linux."
    echo ""
    echo "For Windows, manually create a registry key:"
    echo "  Key:   HKEY_CURRENT_USER\\SOFTWARE\\Mozilla\\NativeMessagingHosts\\$HOST_NAME"
    echo "  Value: (Default) = path to the manifest JSON file"
    echo ""
    echo "Manifest contents (save as $HOST_NAME.json):"
    generate_manifest
    exit 1
    ;;
esac

echo ""
echo "Done! Next steps:"
echo ""
echo "  1. Load the extension in Firefox:"
echo "     a. Open about:debugging"
echo "     b. Click 'This Firefox'"
echo "     c. Click 'Load Temporary Add-on...'"
echo "     d. Select the extension/manifest.json file"
echo "     (For a permanent install, use about:addons > Install Add-on From File)"
echo ""
echo "  2. Restart Firefox (required for native messaging to take effect)"
echo ""
echo "  3. Add the MCP server to Claude Code:"
echo ""
echo "     claude mcp add open-claude-in-firefox -- node $HOST_DIR/mcp-server.js"
echo ""
echo "  4. Start a new Claude Code session and test:"
echo ""
echo '     Ask Claude: "Navigate to example.com and take a screenshot"'
echo ""
