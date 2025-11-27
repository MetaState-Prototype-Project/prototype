#!/bin/bash

# Get the registry URL from environment or use default
REGISTRY_URL="${PUBLIC_REGISTRY_URL:-http://localhost:4321}"

# Request platform token for eid-wallet
echo "Requesting platform token from registry at $REGISTRY_URL..."
echo ""

RESPONSE=$(curl -s -X POST "$REGISTRY_URL/platforms/certification" \
  -H "Content-Type: application/json" \
  -d '{"platform": "eid-wallet"}')

# Check if curl was successful
if [ $? -ne 0 ]; then
  echo "Error: Failed to connect to registry at $REGISTRY_URL"
  exit 1
fi

# Extract token using jq if available, otherwise use grep/sed
if command -v jq &> /dev/null; then
  TOKEN=$(echo "$RESPONSE" | jq -r '.token')
  if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "Error: Failed to get token from response:"
    echo "$RESPONSE"
    exit 1
  fi
else
  # Fallback: extract token manually
  TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$TOKEN" ]; then
    echo "Error: Failed to parse token from response:"
    echo "$RESPONSE"
    exit 1
  fi
fi

echo "Token obtained successfully!"
echo ""
echo "Add this to your .env file:"
echo "PUBLIC_EID_WALLET_TOKEN=\"$TOKEN\""
echo ""
echo "Or use it directly:"
echo "$TOKEN"





