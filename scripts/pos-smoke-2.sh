#!/bin/bash
# POS portals smoke test PHASE 2 — full flows: registrar registers patient with
# charges → cashier collects payment (checkout) → receipt; attendance check-in/out
# (after FK fix); cashier-sales history (after receivedById fix). IDs captured to
# /tmp/pos-smoke-ids.json for cleanup in phase 3.
cd /home/z/my-project
rm -f /tmp/devserver2.log /tmp/pos-smoke-ids.json
bunx next dev -p 3000 > /tmp/devserver2.log 2>&1 &
SERVER_PID=$!

jsonval() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1',''))" 2>/dev/null; }

# ── wait for readiness ──
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 http://127.0.0.1:3000/login 2>/dev/null)
  if [ "$code" = "200" ]; then break; fi
  sleep 2
done
echo "GET /login → $code"

# ── registrar: register patient with initial lab tests (billed to visit) ──
RG=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"registrar","password":"Reception123!"}')
RG_TOKEN=$(echo "$RG" | jsonval token)
echo "registrar login: $( [ -n "$RG_TOKEN" ] && echo OK || echo FAIL )"

SERVICE_ID=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/services?category=LABORATORY&perPage=1" -H "Authorization: Bearer $RG_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);s=d.get('services') or d.get('items') or [];print(s[0]['id'] if s else '')" 2>/dev/null)
echo "lab service: $SERVICE_ID"

REG=$(curl -s --max-time 30 -X POST http://127.0.0.1:3000/api/patients -H "Authorization: Bearer $RG_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"firstName\":\"Smoke\",\"lastName\":\"CashierPOS\",\"phone\":\"0701112223\",\"gender\":\"FEMALE\",\"paymentMode\":\"CASH\",\"openVisit\":true,\"initialTests\":[\"$SERVICE_ID\"]}")
PATIENT_ID=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('patient',{}).get('id',''))" 2>/dev/null)
VISIT_ID=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('visit',{}).get('id',''))" 2>/dev/null)
PATIENT_NO=$(echo "$REG" | python3 -c "import sys,json;print(json.load(sys.stdin).get('patient',{}).get('patientNo',''))" 2>/dev/null)
echo "registered: $PATIENT_NO (patient=$PATIENT_ID visit=$VISIT_ID) charges: $(echo "$REG" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('initialCharges',[])))" 2>/dev/null)"

# ── cashier: pending bills should now carry charges ──
CA=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"cashier","password":"Cashier123!"}')
CA_TOKEN=$(echo "$CA" | jsonval token)
echo "cashier login: $( [ -n "$CA_TOKEN" ] && echo OK || echo FAIL )"

PENDING=$(curl -s --max-time 30 "http://127.0.0.1:3000/api/pos?tab=pending-bills" -H "Authorization: Bearer $CA_TOKEN")
echo "pending-bills: $(echo "$PENDING" | python3 -c "
import sys,json
d=json.load(sys.stdin)
p=d.get('pending',[])
mine=[v for v in p if v['visitId']=='$VISIT_ID']
if mine:
    v=mine[0]
    print('found visit',v['visitNo'],'| charges',len(v['charges']),'| total',v['totalCharges'],'| sha',v['shaTotal'],'| cash',v['cashTotal'])
else:
    print('VISIT NOT FOUND in pending')" 2>/dev/null)"

CHARGES_JSON=$(echo "$PENDING" | python3 -c "
import sys,json
d=json.load(sys.stdin)
p=[v for v in d.get('pending',[]) if v['visitId']=='$VISIT_ID']
if p:
    ch=p[0]['charges']
    out=[]
    for c in ch:
        qty=c.get('quantity') or 1
        price=c['price']/qty if (c.get('quantity') or 1)>1 else c['price']
        out.append({'name':c['name'],'price':round(price,2),'quantity':qty,'department':c['department'],'shaCovered':c['shaCovered']})
    print(json.dumps(out))
else:
    print('[]')" 2>/dev/null)

if [ "$CHARGES_JSON" != "[]" ] && [ -n "$CHARGES_JSON" ] && [ "$CHARGES_JSON" != "" ]; then
  CHECKOUT=$(curl -s --max-time 30 -X POST http://127.0.0.1:3000/api/pos -H "Authorization: Bearer $CA_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"visitId\":\"$VISIT_ID\",\"patientId\":\"$PATIENT_ID\",\"paymentMode\":\"CASH\",\"discountAmount\":0,\"charges\":$CHARGES_JSON}")
  BILL_ID=$(echo "$CHECKOUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('bill',{}).get('id',''))" 2>/dev/null)
  echo "POST checkout: $(echo "$CHECKOUT" | python3 -c "import sys,json;d=json.load(sys.stdin);b=d.get('bill',{});print(d.get('message'),'|',b.get('billNo'),'|',b.get('receiptNo'),'| total',b.get('totalAmount'),'|',len(b.get('items',[])),'items')" 2>/dev/null)"
  # receipt tab
  echo "receipt fetch: $(curl -s --max-time 20 "http://127.0.0.1:3000/api/pos?tab=receipt&billId=$BILL_ID" -H "Authorization: Bearer $CA_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);b=d.get('bill') or {};print(b.get('billNo'),'items',len(b.get('items',[])),'patient',bool(b.get('patient')))" 2>/dev/null)"
  # cashier-sales after fix (receivedById)
  echo "cashier-sales: $(curl -s --max-time 20 "http://127.0.0.1:3000/api/pos?tab=cashier-sales" -H "Authorization: Bearer $CA_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('payments',[])),'payments | summary',d.get('summary'))" 2>/dev/null)"
else
  echo "POST checkout: SKIPPED (no charges on visit)"
  BILL_ID=""
fi

# ── attendance: admin check-in / check-out (FK fix verification) ──
AD=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin123!"}')
AD_TOKEN=$(echo "$AD" | jsonval token)
echo "admin login: $( [ -n "$AD_TOKEN" ] && echo OK || echo FAIL )"

ATT_IN=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $AD_TOKEN" -H 'Content-Type: application/json' -d '{"action":"check-in","device":"smoke-test-2"}')
echo "check-in: $(echo "$ATT_IN" | jsonval message)$(echo "$ATT_IN" | jsonval error)"
# double check-in must be rejected
echo "check-in again (expect Already checked in): $(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $AD_TOKEN" -H 'Content-Type: application/json' -d '{"action":"check-in","device":"smoke-test-2"}' | jsonval error)"
# out-of-zone GPS rejected
echo "check-out GPS far away (expect distance error): $(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $AD_TOKEN" -H 'Content-Type: application/json' -d '{"action":"check-out","latitude":-1.5,"longitude":37.0,"device":"smoke-test-2"}' | jsonval error)"
ATT_OUT=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $AD_TOKEN" -H 'Content-Type: application/json' -d '{"action":"check-out","device":"smoke-test-2"}')
echo "check-out: $(echo "$ATT_OUT" | jsonval message)$(echo "$ATT_OUT" | jsonval error)"
ATT_REC_ID=$(echo "$ATT_OUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('record',{}).get('id',''))" 2>/dev/null)
echo "my-tab today: $(curl -s --max-time 20 "http://127.0.0.1:3000/api/attendance?tab=my&specificDate=$(date +%F)" -H "Authorization: Bearer $AD_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);r=(d.get('records') or [{}])[0];print(r.get('status'),'in',r.get('checkIn'),'out',r.get('checkOut'),'hours',r.get('workHours'))" 2>/dev/null)"
echo "my month records: $(curl -s --max-time 20 "http://127.0.0.1:3000/api/attendance?tab=my&month=$(date +%Y-%m)" -H "Authorization: Bearer $AD_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('total'),'records')" 2>/dev/null)"

# ── capture IDs for cleanup ──
SALE_ID=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pharmacy-pos?section=sales" -H "Authorization: Bearer $AD_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);s=[x for x in d.get('sales',[]) if x.get('patientName')=='Smoke Walk-in'];print(s[0]['id'] if s else '')" 2>/dev/null)
echo "phase-1 sale to clean: $SALE_ID"
python3 - "$PATIENT_ID" "$VISIT_ID" "$BILL_ID" "$SALE_ID" "$ATT_REC_ID" <<'EOF'
import json, sys
ids = {
  'patientId': sys.argv[1] or None,
  'visitId': sys.argv[2] or None,
  'billId': sys.argv[3] or None,
  'saleId': sys.argv[4] or None,
  'attendanceId': sys.argv[5] or None,
}
json.dump(ids, open('/tmp/pos-smoke-ids.json', 'w'))
EOF

kill $SERVER_PID 2>/dev/null
sleep 1
echo "=== dev.log errors ==="
rg -i "error|failed" /tmp/devserver2.log | rg -v "error TS" | head -12 || echo "(none)"
echo "=== phase 2 complete ==="
