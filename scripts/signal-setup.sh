#!/bin/bash
#
# Signal CLI Setup Script
# This script performs a clean restart of the Signal container,
# displays QR code for linking, and lists available groups.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

COMPOSE_FILE="docker-compose.yaml"
SIGNAL_CONTAINER="domain-monitor-signal"
SIGNAL_VOLUME="domain-monitor_signal_data"
SIGNAL_API="http://localhost:8080"

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Signal CLI Setup Script              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo

# Function to wait for Signal CLI to be ready
wait_for_signal() {
    echo -e "${YELLOW}⏳ Waiting for Signal CLI to be ready...${NC}"
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "${SIGNAL_API}/v1/about" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Signal CLI is ready!${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo -e "${RED}✗ Signal CLI failed to start after ${max_attempts} attempts${NC}"
    exit 1
}

# Step 1: Clean restart of Signal container
echo -e "${YELLOW}Step 1: Clean restart of Signal container${NC}"
echo -e "─────────────────────────────────────────────"

echo -e "${YELLOW}⏹ Stopping Signal container...${NC}"
docker compose -f "${COMPOSE_FILE}" stop signal-cli 2>/dev/null || true

echo -e "${YELLOW}🗑 Removing Signal container...${NC}"
docker rm -f "${SIGNAL_CONTAINER}" 2>/dev/null || true

echo -e "${YELLOW}🗑 Removing Signal data volume (fresh start)...${NC}"
docker volume rm "${SIGNAL_VOLUME}" 2>/dev/null || true

echo -e "${YELLOW}▶ Starting Signal container with fresh data...${NC}"
docker compose -f "${COMPOSE_FILE}" up -d signal-cli

wait_for_signal

echo -e "${GREEN}✓ Signal container restarted with fresh data!${NC}"
echo

# Step 2: Display QR code for linking
echo -e "${YELLOW}Step 2: Link your Signal mobile app${NC}"
echo -e "─────────────────────────────────────────────"
echo -e "${BLUE}Open Signal on your phone:${NC}"
echo -e "  1. Go to Settings → Linked Devices"
echo -e "  2. Tap 'Link New Device'"
echo -e "  3. Scan the QR code below"
echo

# Generate QR code - try ASCII first, fallback to URL
echo -e "${YELLOW}📱 Generating QR code...${NC}"
echo

# Get the QR code link info
QR_RESPONSE=$(curl -s "${SIGNAL_API}/v1/qrcodelink?device_name=domain-monitor")

# Check if qrencode is available for terminal display
if command -v qrencode &> /dev/null; then
    # Extract the URI and display as ASCII QR
    QR_URI=$(echo "${QR_RESPONSE}" | grep -o 'sgnl://[^"]*' 2>/dev/null || echo "")
    if [ -n "$QR_URI" ]; then
        echo "$QR_URI" | qrencode -t ANSIUTF8
    else
        # Try to get the PNG
        echo -e "${YELLOW}Opening QR code in browser...${NC}"
        echo -e "QR Code URL: ${SIGNAL_API}/v1/qrcodelink?device_name=domain-monitor"
    fi
else
    echo -e "${YELLOW}ℹ For best experience, install qrencode: apt-get install qrencode${NC}"
    echo
    echo -e "View QR code at: ${BLUE}${SIGNAL_API}/v1/qrcodelink?device_name=domain-monitor${NC}"
    echo
    echo -e "Or open this URL in your browser to see the QR code image."
fi

echo
echo -e "${YELLOW}⏳ Waiting for device to be linked...${NC}"
echo -e "${BLUE}Please scan the QR code with your Signal app now.${NC}"
echo

# Wait for the device to be linked (check for registered accounts)
MAX_WAIT=120
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    ACCOUNTS=$(curl -s "${SIGNAL_API}/v1/accounts" 2>/dev/null)
    if echo "$ACCOUNTS" | grep -q "+"; then
        echo -e "${GREEN}✓ Device linked successfully!${NC}"
        PHONE=$(echo "$ACCOUNTS" | grep -o '+[0-9]*' | head -1)
        echo -e "  Registered account: ${GREEN}${PHONE}${NC}"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    echo -ne "\r${YELLOW}⏳ Waiting... (${WAITED}s/${MAX_WAIT}s)${NC}   "
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "\n${RED}✗ Timeout waiting for device link. Please try again.${NC}"
    exit 1
fi

echo

# Step 3: Display available groups
echo -e "${YELLOW}Step 3: Available Signal Groups${NC}"
echo -e "─────────────────────────────────────────────"

# Get the registered phone number
PHONE=$(curl -s "${SIGNAL_API}/v1/accounts" | grep -o '+[0-9]*' | head -1)

if [ -z "$PHONE" ]; then
    echo -e "${RED}✗ No registered account found. Please link a device first.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Fetching groups for ${PHONE}...${NC}"
echo

GROUPS=$(curl -s "${SIGNAL_API}/v1/groups/${PHONE}")

if echo "$GROUPS" | grep -q "error"; then
    echo -e "${RED}✗ Error fetching groups: ${GROUPS}${NC}"
    exit 1
fi

if [ "$GROUPS" = "[]" ] || [ -z "$GROUPS" ]; then
    echo -e "${YELLOW}ℹ No groups found. Create a group in Signal first, then run:${NC}"
    echo -e "  curl ${SIGNAL_API}/v1/groups/${PHONE}"
    exit 0
fi

echo -e "${GREEN}Found groups:${NC}"
echo
echo "$GROUPS" | python3 -c "
import sys
import json

try:
    groups = json.load(sys.stdin)
    for i, group in enumerate(groups, 1):
        name = group.get('name', 'Unnamed')
        group_id = group.get('id', 'N/A')
        internal_id = group.get('internal_id', 'N/A')
        members = len(group.get('members', []))
        
        print(f'  {i}. {name}')
        print(f'     ID: {group_id}')
        print(f'     Internal ID: {internal_id}')
        print(f'     Members: {members}')
        print()
except Exception as e:
    print(f'Error parsing groups: {e}', file=sys.stderr)
    print(sys.stdin.read())
"

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup complete!${NC}"
echo
echo -e "Update your ${YELLOW}.env${NC} file with:"
echo -e "  SIGNAL_ACCOUNT=${PHONE}"
echo -e "  SIGNAL_GROUP_ID=<group_id from above>"
echo
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
