#!/usr/bin/env bash
# Golden Path smoke test (spec §20). Runs the production server and verifies:
# auth gate, login, dashboard data, withheld scenario, RBAC rejection,
# intervention review (no side effects), CSV export, audit verify.
set -u
cd "$(dirname "$0")/.."

PASS=0; FAIL=0
check() {
  local result="${2:-bad}"
  if [ "$result" = "ok" ]; then echo "  ✓ $1"; PASS=$((PASS+1)); else echo "  ✕ $1"; FAIL=$((FAIL+1)); fi
}

# 1. Database
./scripts/db.sh start >/dev/null 2>&1
sleep 2
if (echo > /dev/tcp/127.0.0.1/5432) 2>/dev/null; then check "database reachable" ok; else check "database reachable" bad; fi

# 2. Production server
env NEXT_TELEMETRY_DISABLED=1 ./node_modules/.bin/next start -p 3000 >/tmp/smx-server.log 2>&1 &
SERVER_PID=$!
for i in $(seq 1 20); do
  if curl -s -o /dev/null http://127.0.0.1:3000/login; then break; fi
  sleep 0.5
done
check "server responds on :3000" "$([ -d /proc/$SERVER_PID ] && echo ok)"

# 3. Unauthenticated /team-command redirects to /login
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" http://127.0.0.1:3000/team-command)
check "unauthenticated access redirects to /login ($LOC)" "$([[ "$LOC" == *"/login"* ]] && echo ok)"

# 4. Protected API rejects anonymous caller
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/audit)
check "anonymous /api/audit rejected (401: $CODE)" "$([ "$CODE" = "401" ] && echo ok)"

# 5. Login (demo PERFORMANCE account)
CODE=$(curl -s -o /tmp/login.json -w "%{http_code}" -c /tmp/cj -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"performance@demo.sportmetryx.dev","password":"Demo-SMX-2024!"}')
check "login accepts demo credentials (200: $CODE)" "$([ "$CODE" = "200" ] && echo ok)"

# 6. Bad password rejected with uniform error
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"performance@demo.sportmetryx.dev","password":"wrong"}')
check "wrong password rejected (401: $CODE)" "$([ "$CODE" = "401" ] && echo ok)"

# 7. Authenticated dashboard renders persisted data
BODY=$(curl -s -b /tmp/cj http://127.0.0.1:3000/team-command)
check "team-command renders with seeded roster" "$(echo "$BODY" | grep -q "Ironmark Stallions" && echo ok)"
check "readiness counts present" "$(echo "$BODY" | grep -q "Active exceptions" && echo ok)"

# 8. Roster page renders withheld rows
BODY=$(curl -s -b /tmp/cj http://127.0.0.1:3000/roster?view=WITHHELD)
check "roster withheld view shows WITHHELD stamps" "$(echo "$BODY" | grep -qi "withheld" && echo ok)"

# 9. Player 360 for EC-10 (valid) renders index + components
AID=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.athlete.findUnique({where:{externalId:'EC-10'},select:{id:true}}).then(a=>{console.log(a.id);return p.\$disconnect();})")
BODY=$(curl -s -b /tmp/cj http://127.0.0.1:3000/player/$AID)
check "player 360 shows READY band" "$(echo "$BODY" | grep -q "READY" && echo ok)"
check "player 360 shows component breakdown" "$(echo "$BODY" | grep -q "Respiratory Efficiency" && echo ok)"

# 10. Player 360 for EC-11 shows withheld/retest
AID11=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.athlete.findUnique({where:{externalId:'EC-11'},select:{id:true}}).then(a=>{console.log(a.id);return p.\$disconnect();})")
BODY=$(curl -s -b /tmp/cj http://127.0.0.1:3000/player/$AID11)
check "EC-11 withheld composite (no number)" "$(echo "$BODY" | grep -q "WITHHELD\|Withheld" && echo ok)"

# 11. RBAC: COACH cannot review interventions.
# Use a dedicated scratch intervention so the test is repeatable regardless of
# seed state (repeated runs may have already approved every OPEN seed item).
SCRATCH=$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const a=await p.athlete.findFirst({where:{externalId:'EC-10'}});const t=await p.team.findFirst();const i=await p.intervention.create({data:{teamId:t.id,athleteId:a.id,exceptionKey:'SMOKE_SCRATCH',description:'Repeatable smoke-test intervention.',recommendation:'None.',priority:'LOW',status:'OPEN'},select:{id:true}});console.log(i.id);await p.\$disconnect();})()")
IID=$SCRATCH
curl -s -o /dev/null -c /tmp/cj-coach -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"coach@demo.sportmetryx.dev","password":"Demo-SMX-2024!"}'
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/cj-coach -X POST http://127.0.0.1:3000/api/interventions/$IID/approve -H "Content-Type: application/json" -d '{}')
check "coach approve rejected server-side (403: $CODE)" "$([ "$CODE" = "403" ] && echo ok)"

# 12. PERFORMANCE approve records a review only
CODE=$(curl -s -o /tmp/appr.json -w "%{http_code}" -b /tmp/cj -X POST http://127.0.0.1:3000/api/interventions/$IID/approve -H "Content-Type: application/json" -d '{}')
STATUS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/appr.json')).status)")
check "performance approve succeeds (200: $CODE → $STATUS)" "$([ "$CODE" = "200" ] && echo ok)"
check "approve created audit record" "$(node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.auditLog.count({where:{action:'INTERVENTION_APPROVE',entityId:'$IID'}}).then(n=>{console.log(n>0?'ok':'bad');return p.\$disconnect();})")"

# 13. CSV export authorized + de-identified
CSV=$(curl -s -b /tmp/cj "http://127.0.0.1:3000/api/export?scope=roster&days=28&deidentified=1")
check "export returns CSV header with subjectRef" "$(echo "$CSV" | head -1 | grep -q "subjectRef" && echo ok)"
check "export contains data rows" "$(echo "$CSV" | wc -l | awk '{exit ($1>3)?0:1}' && echo ok)"

# 14. Audit chain verifies (MEDICAL holds audit.read; PERFORMANCE deliberately does not)
curl -s -o /dev/null -c /tmp/cj-med -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"medical@demo.sportmetryx.dev","password":"Demo-SMX-2024!"}'
V=$(curl -s -b /tmp/cj-med http://127.0.0.1:3000/api/audit/verify)
check "hash chain verifies" "$(echo "$V" | grep -q '"ok":true' && echo ok)"

# 15. Import rejects garbage (unauthorized role: COACH)
echo "externalId,timestamp,type,value" > /tmp/t.csv
echo "EC-10,2025-10-10T06:00:00Z,RESP_RATE,16" >> /tmp/t.csv
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b /tmp/cj-coach -F file=@/tmp/t.csv http://127.0.0.1:3000/api/import)
check "coach import rejected (403: $CODE)" "$([ "$CODE" = "403" ] && echo ok)"

# 16. Import accepts valid file for PERFORMANCE (with the bad row rejected)
printf "externalId,timestamp,type,value,unit\nEC-10,2025-10-10T06:00:00Z,RESP_RATE,16,brpm\nEC-10,2025-10-10T06:00:00Z,RESP_RATE,15,bpm\n" > /tmp/t2.csv
RES=$(curl -s -b /tmp/cj -F file=@/tmp/t2.csv http://127.0.0.1:3000/api/import)
check "import summary: PARTIAL_SUCCESS with unit mismatch rejected" "$(echo "$RES" | grep -q "UNIT_MISMATCH" && echo ok)"

kill $SERVER_PID 2>/dev/null
# Remove the scratch intervention so repeated smoke runs stay repeatable.
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.intervention.deleteMany({where:{exceptionKey:'SMOKE_SCRATCH'}}).then(()=>p.\$disconnect());" 2>/dev/null
./scripts/db.sh stop >/dev/null 2>&1
echo ""
echo "SMOKE RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
