#!/bin/bash
# ===========================================
# Let's Encrypt SSL Certificate Setup
# For production use
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/nginx/ssl"

# Check if domain is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <domain> [email]"
    echo "Example: $0 printers.mycompany.com admin@mycompany.com"
    exit 1
fi

DOMAIN="$1"
EMAIL="${2:-admin@$DOMAIN}"

echo "🔐 Setting up Let's Encrypt SSL for: $DOMAIN"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y certbot
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y certbot
    else
        echo "❌ Please install certbot manually"
        exit 1
    fi
fi

# Create webroot directory for ACME challenge
sudo mkdir -p /var/www/certbot

# Request certificate
echo "Requesting certificate..."
sudo certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# Create SSL directory if not exists
mkdir -p "$SSL_DIR"

# Copy certificates
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"
if [ -d "$CERT_PATH" ]; then
    sudo cp "$CERT_PATH/fullchain.pem" "$SSL_DIR/fullchain.pem"
    sudo cp "$CERT_PATH/privkey.pem" "$SSL_DIR/privkey.pem"
    sudo chown $(whoami):$(whoami) "$SSL_DIR/"*.pem
    chmod 600 "$SSL_DIR/privkey.pem"
    chmod 644 "$SSL_DIR/fullchain.pem"
    
    echo ""
    echo "✅ Let's Encrypt certificate installed successfully!"
    echo ""
    echo "📁 Certificates copied to: $SSL_DIR"
    echo ""
    
    # Setup auto-renewal cron job
    echo "Setting up auto-renewal..."
    CRON_CMD="0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem $SSL_DIR/ && docker restart printer-nginx"
    (crontab -l 2>/dev/null | grep -v "$DOMAIN"; echo "$CRON_CMD") | crontab -
    
    echo "✅ Auto-renewal cron job added (runs daily at 3 AM)"
else
    echo "❌ Certificate generation failed"
    exit 1
fi
