#!/bin/bash

# Generate self-signed SSL certificates for local development
# These certificates allow HTTPS access from your phone on the local network

set -e

CERT_DIR=".dev-certs"
CERT_FILE="$CERT_DIR/cert.pem"
KEY_FILE="$CERT_DIR/key.pem"

# Create cert directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  echo "✅ SSL certificates already exist at $CERT_DIR/"
  echo "   To regenerate, delete the directory first: rm -rf $CERT_DIR"
  exit 0
fi

# Get local IP address
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo "🔐 Generating self-signed SSL certificates..."
echo "   This will allow HTTPS access from your phone on the local network"
echo ""

# Generate certificate with Subject Alternative Names (SAN) for local network access
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days 365 \
  -subj "/C=US/ST=State/L=City/O=Development/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:*.local,IP:127.0.0.1,IP:$LOCAL_IP" \
  2>/dev/null || {
  # Fallback for older OpenSSL versions
  openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days 365 \
    -subj "/C=US/ST=State/L=City/O=Development/CN=localhost"
}

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "✅ SSL certificates generated successfully!"
echo ""
echo "📱 To access from your phone:"
echo "   1. Find your computer's local IP address:"
echo "      macOS: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
echo "      Linux: ip addr show | grep 'inet ' | grep -v 127.0.0.1"
echo ""
echo "   2. Start the dev server with HTTPS:"
echo "      VITE_HTTPS=true make dev"
echo ""
echo "   3. On your phone, open:"
echo "      https://YOUR_LOCAL_IP:5173"
echo ""
echo "   4. Accept the security warning (self-signed certificate)"
echo ""
echo "   5. Grant camera permissions when prompted"
echo ""
echo "⚠️  Note: You'll need to accept the security warning on your phone"
echo "   because this is a self-signed certificate (safe for development)."

