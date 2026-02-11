#!/bin/bash
# ===========================================
# Generate Self-Signed SSL Certificate
# For development/testing purposes
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SSL_DIR="$PROJECT_DIR/nginx/ssl"

# Create SSL directory if not exists
mkdir -p "$SSL_DIR"

# Certificate details
DOMAIN="${1:-localhost}"
DAYS=365
COUNTRY="CO"
STATE="Bogota"
CITY="Bogota"
ORG="Printer Management"
OU="IT Department"

echo "🔐 Generating self-signed SSL certificate for: $DOMAIN"

# Generate private key
openssl genrsa -out "$SSL_DIR/privkey.pem" 2048

# Generate certificate signing request
openssl req -new -key "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/csr.pem" \
    -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$OU/CN=$DOMAIN"

# Generate self-signed certificate with SAN
cat > "$SSL_DIR/openssl.cnf" << EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $ORG
OU = $OU
CN = $DOMAIN

[v3_req]
keyUsage = critical, digitalSignature, keyAgreement
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# Generate self-signed certificate
openssl x509 -req -days $DAYS \
    -in "$SSL_DIR/csr.pem" \
    -signkey "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -extensions v3_req \
    -extfile "$SSL_DIR/openssl.cnf"

# Clean up temporary files
rm -f "$SSL_DIR/csr.pem" "$SSL_DIR/openssl.cnf"

# Set permissions
chmod 600 "$SSL_DIR/privkey.pem"
chmod 644 "$SSL_DIR/fullchain.pem"

echo ""
echo "✅ SSL certificate generated successfully!"
echo ""
echo "📁 Files created:"
echo "   - $SSL_DIR/fullchain.pem (certificate)"
echo "   - $SSL_DIR/privkey.pem (private key)"
echo ""
echo "⚠️  Note: This is a self-signed certificate for development."
echo "   Your browser will show a security warning."
echo "   For production, use Let's Encrypt or a commercial certificate."
echo ""
