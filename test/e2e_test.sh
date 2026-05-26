#!/usr/bin/env bash
# ============================================================
# LocalAd – End-to-End Testskript
# Testet den vollständigen Flow gegen localhost:3000
# oder gegen eine Production-URL.
#
# Verwendung:
#   chmod +x test/e2e_test.sh
#   ./test/e2e_test.sh                  # gegen localhost:3000
#   BASE_URL=https://api.localad.de ./test/e2e_test.sh
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMESTAMP=$(date +%s)
USER_EMAIL="testuser_${TIMESTAMP}@example.com"
PUBLISHER_EMAIL="publisher_${TIMESTAMP}@example.com"
ADV_EMAIL="advertiser_${TIMESTAMP}@example.com"
PASSWORD="Test1234!"
PLZ="47051"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
step() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

# Hilfsfunktion: JSON-Wert extrahieren (ohne jq-Abhängigkeit)
extract() { echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }
extract_num() { echo "$1" | grep -o "\"$2\":[0-9]*" | head -1 | cut -d':' -f2; }

# ── 0. Health Check ──────────────────────────────────────────
step "0. Health Check"
HEALTH=$(curl -sf "${BASE_URL}/health") || fail "Backend nicht erreichbar: ${BASE_URL}"
STATUS=$(extract "$HEALTH" "status")
[ "$STATUS" = "ok" ] && pass "Backend läuft (${BASE_URL})" || fail "Health-Check fehlgeschlagen: $HEALTH"

# ── 1. Nutzer registrieren ───────────────────────────────────
step "1. Nutzer-Registrierung"
REG_RESP=$(curl -sf -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${USER_EMAIL}\",\"password\":\"${PASSWORD}\",\"role\":\"user\"}")
ACCESS_TOKEN=$(extract "$REG_RESP" "accessToken")
[ -n "$ACCESS_TOKEN" ] && pass "Nutzer registriert: ${USER_EMAIL}" || fail "Registrierung fehlgeschlagen: $REG_RESP"

# ── 2. Login ─────────────────────────────────────────────────
step "2. Login"
LOGIN_RESP=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -c /tmp/localad_cookies.txt \
  -d "{\"email\":\"${USER_EMAIL}\",\"password\":\"${PASSWORD}\"}")
ACCESS_TOKEN=$(extract "$LOGIN_RESP" "accessToken")
[ -n "$ACCESS_TOKEN" ] && pass "Login erfolgreich, Access-Token erhalten" || fail "Login fehlgeschlagen: $LOGIN_RESP"

# ── 3. Token-Refresh ─────────────────────────────────────────
step "3. Token-Refresh"
REFRESH_RESP=$(curl -sf -X POST "${BASE_URL}/api/auth/refresh" \
  -b /tmp/localad_cookies.txt \
  -c /tmp/localad_cookies.txt)
NEW_TOKEN=$(extract "$REFRESH_RESP" "accessToken")
[ -n "$NEW_TOKEN" ] && pass "Token-Refresh funktioniert" || fail "Token-Refresh fehlgeschlagen: $REFRESH_RESP"
ACCESS_TOKEN="$NEW_TOKEN"

# ── 4. Publisher registrieren ────────────────────────────────
step "4. Publisher-Registrierung"
PUB_REG=$(curl -sf -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${PUBLISHER_EMAIL}\",\"password\":\"${PASSWORD}\",\"role\":\"publisher\"}")
PUB_TOKEN=$(extract "$PUB_REG" "accessToken")
[ -n "$PUB_TOKEN" ] && pass "Publisher-Account registriert: ${PUBLISHER_EMAIL}" || fail "Publisher-Registrierung fehlgeschlagen: $PUB_REG"

# Publisher-Domain registrieren
PUB_DOMAIN_RESP=$(curl -sf -X POST "${BASE_URL}/api/publishers/register" \
  -H "Authorization: Bearer ${PUB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"domain":"test-publisher.localad.de","verificationMethod":"meta"}')
VERIFY_TOKEN=$(extract "$PUB_DOMAIN_RESP" "verificationToken")
[ -n "$VERIFY_TOKEN" ] && pass "Publisher-Domain registriert, Token: ${VERIFY_TOKEN:0:12}..." \
  || fail "Publisher-Domain-Registrierung fehlgeschlagen: $PUB_DOMAIN_RESP"

# Publisher-Status prüfen (sollte pending sein)
PUB_ME=$(curl -sf "${BASE_URL}/api/publishers/me" \
  -H "Authorization: Bearer ${PUB_TOKEN}")
IS_VERIFIED=$(echo "$PUB_ME" | grep -o '"is_verified":[^,}]*' | cut -d: -f2 | tr -d ' ')
[ "$IS_VERIFIED" = "false" ] && pass "Publisher-Status korrekt: unverified/pending" \
  || echo -e "${YELLOW}  ⚠ is_verified=${IS_VERIFIED} (möglicherweise schon verifiziert)${NC}"

# ── 5. Advertiser registrieren + Anzeige erstellen ───────────
step "5. Advertiser + Anzeige"
ADV_REG=$(curl -sf -X POST "${BASE_URL}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADV_EMAIL}\",\"password\":\"${PASSWORD}\",\"role\":\"advertiser\",\"companyName\":\"Testbäckerei Duisburg\",\"plan\":\"basic\"}")
ADV_TOKEN=$(extract "$ADV_REG" "accessToken")
[ -n "$ADV_TOKEN" ] && pass "Advertiser registriert: ${ADV_EMAIL}" || fail "Advertiser-Registrierung fehlgeschlagen: $ADV_REG"

# Anzeige anlegen
AD_RESP=$(curl -sf -X POST "${BASE_URL}/api/ads" \
  -H "Authorization: Bearer ${ADV_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Frische Brötchen täglich\",
    \"description\": \"Bäckerei Müller – Duisburg-Mitte, Mo–Sa ab 6 Uhr\",
    \"targetUrl\": \"https://test-baeckerei.example.de\",
    \"postal_codes\": [\"${PLZ}\", \"47053\"],
    \"validFrom\": \"$(date -u +%Y-%m-%d)\",
    \"validUntil\": \"$(date -u -d '+30 days' +%Y-%m-%d 2>/dev/null || date -u -v +30d +%Y-%m-%d)\"
  }")
AD_ID=$(extract "$AD_RESP" "id")
[ -n "$AD_ID" ] && pass "Anzeige erstellt (ID: ${AD_ID:0:8}...)" || fail "Anzeige-Erstellung fehlgeschlagen: $AD_RESP"

# Anzeigen abrufen
ADS_LIST=$(curl -sf "${BASE_URL}/api/ads" \
  -H "Authorization: Bearer ${ADV_TOKEN}")
AD_COUNT=$(echo "$ADS_LIST" | grep -o '"id"' | wc -l | tr -d ' ')
[ "$AD_COUNT" -ge 1 ] && pass "Anzeigen-Liste abrufbar (${AD_COUNT} Anzeige(n))" \
  || fail "Anzeigen-Liste fehlgeschlagen: $ADS_LIST"

# ── 6. Ad-Match ──────────────────────────────────────────────
step "6. Ad-Match (Kernfunktion)"
# Wichtig: Publisher muss verifiziert sein für echten Match.
# Im Test-Modus direkt mit bekannter Domain testen.
MATCH_RESP=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/ads/match" \
  -H "Content-Type: application/json" \
  -d "{\"domain\":\"test-publisher.localad.de\",\"postalCode\":\"${PLZ}\",\"slotId\":\"banner-top\"}")

if [ "$MATCH_RESP" = "200" ]; then
  pass "Ad-Match: 200 OK (Anzeige ausgeliefert)"
elif [ "$MATCH_RESP" = "204" ]; then
  pass "Ad-Match: 204 No Content (Publisher noch nicht verifiziert – erwartet für Test)"
else
  fail "Ad-Match unerwartet: HTTP ${MATCH_RESP}"
fi

# ── 7. Advertiser-Stats ──────────────────────────────────────
step "7. Statistiken"
ADV_STATS=$(curl -sf "${BASE_URL}/api/advertisers/me/stats?days=7" \
  -H "Authorization: Bearer ${ADV_TOKEN}")
echo "$ADV_STATS" | grep -q "totalImpressions" \
  && pass "Advertiser-Stats abrufbar" \
  || fail "Advertiser-Stats fehlgeschlagen: $ADV_STATS"

PUB_STATS=$(curl -sf "${BASE_URL}/api/publishers/me/stats?days=7" \
  -H "Authorization: Bearer ${PUB_TOKEN}")
echo "$PUB_STATS" | grep -q "totalImpressions" \
  && pass "Publisher-Stats abrufbar" \
  || fail "Publisher-Stats fehlgeschlagen: $PUB_STATS"

# ── 8. Logout ────────────────────────────────────────────────
step "8. Logout"
LOGOUT_RESP=$(curl -sf -X POST "${BASE_URL}/api/auth/logout" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -b /tmp/localad_cookies.txt \
  -c /tmp/localad_cookies.txt)
pass "Logout erfolgreich"

# ── Aufräumen ────────────────────────────────────────────────
rm -f /tmp/localad_cookies.txt

# ── Zusammenfassung ──────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Alle E2E-Tests bestanden!${NC}"
echo -e "${GREEN}  Getestete URL: ${BASE_URL}${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Hinweise für Production-Test:"
echo "  1. Stripe-Webhook prüfen: stripe listen"
echo "  2. Publisher manuell via DNS verifizieren lassen"
echo "  3. Extension im Browser installieren und PLZ-Flow testen"
