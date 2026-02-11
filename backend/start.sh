#!/bin/bash
# ===========================================
# Startup script - CUPS + Node.js
# ===========================================

set -e

echo "============================================"
echo "🖨️  Printer Management System Starting..."
echo "============================================"

# If /etc/cups is persisted via a Docker volume, it may contain config from a previous
# image/distro. Some directives are version-specific and can prevent CUPS from starting.
# Example: 'PeerCred' is not recognized by Debian bookworm's CUPS.
if [ -f /etc/cups/cups-files.conf ] && grep -qE '^[[:space:]]*PeerCred\b' /etc/cups/cups-files.conf; then
    echo "🛠️  Patching legacy CUPS config (PeerCred) for compatibility..."
    sed -i 's/^[[:space:]]*PeerCred\b/# PeerCred/' /etc/cups/cups-files.conf || true
fi

# Create necessary directories
mkdir -p /run/cups /var/spool/cups /var/log/cups

# Start CUPS daemon
echo "🖨️  Starting CUPS daemon..."
/usr/sbin/cupsd -f &
CUPS_PID=$!

# Wait for CUPS to be ready
echo "⏳ Waiting for CUPS to start..."
for i in {1..30}; do
    if lpstat -r 2>/dev/null | grep -q "scheduler is running"; then
        echo "✅ CUPS is running (PID: $CUPS_PID)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  CUPS startup timeout, continuing anyway..."
    fi
    sleep 1
done

# Show CUPS info
echo ""
echo "📊 CUPS Status:"
lpstat -r 2>/dev/null || echo "   Checking..."
echo ""
echo "🌐 CUPS Web Interface: http://localhost:631"
echo ""

# List available printer drivers
echo "📦 Available printer models:"
lpinfo -m 2>/dev/null | head -5 || echo "   (loading...)"
echo "   ... and more (use 'lpinfo -m' for full list)"
echo ""

echo "============================================"
echo "🚀 Starting Node.js API Server..."
echo "============================================"

# Start Node.js (exec replaces the shell, keeping PID 1)
exec node src/index.js

