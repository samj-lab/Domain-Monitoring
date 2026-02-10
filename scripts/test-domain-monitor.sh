#!/bin/bash
#
# Test script for Domain Monitor API
# Tests both success and failure scenarios
#
# New payload format:
# {
#   "isp": "FPT",
#   "timestamp": "DD/MM/YYYY HH:mm:ss" (Vietnam timezone UTC+7),
#   "results": [{ "url": "...", "error": null | object, "status": "..." }]
# }
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-test-api-key-12345}"

# Get current timestamp in Vietnam format (DD/MM/YYYY HH:mm:ss)
# Note: The API expects Vietnam timezone (UTC+7)
TIMESTAMP=$(TZ='Asia/Ho_Chi_Minh' date +"%d/%m/%Y %H:%M:%S")

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Domain Monitor API Test Script             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo
echo -e "API URL: ${YELLOW}${API_URL}${NC}"
echo -e "API Key: ${YELLOW}${API_KEY:0:10}...${NC}"
echo -e "Timestamp: ${YELLOW}${TIMESTAMP}${NC}"
echo

# Test 1: Success logs (no notification should be sent)
echo -e "${YELLOW}Test 1: Sending SUCCESS logs (no notification expected)${NC}"
echo -e "─────────────────────────────────────────────────────"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/domain-monitoring" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "isp": "Viettel",
    "timestamp": "'"${TIMESTAMP}"'",
    "results": [
      {
        "url": "google.com",
        "error": null,
        "status": "Access thành công"
      },
      {
        "url": "facebook.com",
        "error": null,
        "status": "Access thành công"
      }
    ]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Request successful (HTTP $HTTP_CODE)${NC}"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}✗ Request failed (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi
echo

# Test 2: Failed logs (notification SHOULD be sent)
echo -e "${YELLOW}Test 2: Sending FAILED logs (notification expected)${NC}"
echo -e "─────────────────────────────────────────────────────"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/domain-monitoring" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "isp": "FPT",
    "timestamp": "'"${TIMESTAMP}"'",
    "results": [
      {
        "url": "blocked-site-1.com",
        "error": {"code": "BLOCKED", "message": "Site is blocked by ISP"},
        "status": "Access thất bại"
      },
      {
        "url": "redirect-site.com",
        "error": {"code": "REDIRECT", "target": "https://warning.isp.com"},
        "status": "Bị chuyển hướng"
      },
      {
        "url": "dns-error-site.com",
        "error": {"code": "DNS_ERROR", "message": "NXDOMAIN"},
        "status": "Lỗi DNS"
      }
    ]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Request successful (HTTP $HTTP_CODE)${NC}"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  
  # Check if notification was sent
  if echo "$BODY" | grep -q '"notificationSent":true'; then
    echo -e "${GREEN}✓ Notification was sent successfully!${NC}"
  else
    echo -e "${YELLOW}⚠ Notification was NOT sent (check Signal CLI)${NC}"
  fi
else
  echo -e "${RED}✗ Request failed (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi
echo

# Test 3: Mixed logs (SUCCESS + FAILED from same ISP)
echo -e "${YELLOW}Test 3: Sending MIXED logs (SUCCESS + FAILED)${NC}"
echo -e "─────────────────────────────────────────────────────"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/domain-monitoring" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "isp": "VNPT",
    "timestamp": "'"${TIMESTAMP}"'",
    "results": [
      {
        "url": "working-site.com",
        "error": null,
        "status": "Access thành công"
      },
      {
        "url": "connection-error-site.com",
        "error": {"code": "CONNECTION_ERROR", "message": "ETIMEDOUT"},
        "status": "Lỗi kết nối"
      }
    ]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Request successful (HTTP $HTTP_CODE)${NC}"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}✗ Request failed (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi
echo

# Test 4: Invalid API key
echo -e "${YELLOW}Test 4: Testing invalid API key (should fail)${NC}"
echo -e "─────────────────────────────────────────────────────"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/domain-monitoring" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: invalid-key" \
  -d '{"isp": "Test", "timestamp": "01/01/2026 00:00:00", "results": []}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "${GREEN}✓ Correctly rejected (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${RED}✗ Expected 401, got $HTTP_CODE${NC}"
fi
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo

# Test 5: Empty results array (should fail validation)
echo -e "${YELLOW}Test 5: Testing empty results array (should fail validation)${NC}"
echo -e "─────────────────────────────────────────────────────"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/domain-monitoring" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"isp": "Test", "timestamp": "01/01/2026 00:00:00", "results": []}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "400" ]; then
  echo -e "${GREEN}✓ Correctly rejected (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${YELLOW}⚠ Expected 400, got $HTTP_CODE${NC}"
fi
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo

# Test 6: Sample payload (exact format from user)
echo -e "${YELLOW}Test 6: Sample payload with 10 domains${NC}"
echo -e "─────────────────────────────────────────────────────"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/domain-monitoring" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "isp": "FPT",
    "timestamp": "'"${TIMESTAMP}"'",
    "results": [
      {"url": "789club.vg", "error": null, "status": "Access thành công"},
      {"url": "play.789club.vg", "error": null, "status": "Access thành công"},
      {"url": "hbet.in", "error": null, "status": "Access thành công"},
      {"url": "xibet.fun", "error": null, "status": "Access thành công"},
      {"url": "lu88.gdn", "error": null, "status": "Access thành công"},
      {"url": "man88.pw", "error": null, "status": "Access thành công"},
      {"url": "k88.mobi", "error": null, "status": "Access thành công"},
      {"url": "vu88.de", "error": null, "status": "Access thành công"},
      {"url": "usbet.cc", "error": null, "status": "Access thành công"},
      {"url": "gbong.info", "error": null, "status": "Access thành công"}
    ]
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Request successful (HTTP $HTTP_CODE)${NC}"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}✗ Request failed (HTTP $HTTP_CODE)${NC}"
  echo "$BODY"
fi
echo

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All tests completed!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
