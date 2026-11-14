#!/bin/bash
# POS portals smoke test — starts dev server, curls pages, exercises authed APIs, kills server.
cd /home/z/my-project
rm -f /tmp/devserver.log
bunx next dev -p 3000 > /tmp/devserver.log 2>&1 &
SERVER_PID=$!

# ── wait for readiness (max ~90s) ──
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 4 http://127.0.0.1:3000/login 2>/dev/null)
  if [ "$code" = "200" ]; then break; fi
  sleep 2
done
echo "GET /login → $code"

# ── page smoke tests (SSR 200) ──
for p in /attendance /pharmacy /pharmacy/prescriptions /pharmacy/sales /cashier /cashier/history /manifest.json /sw.js; do
  c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 80 "http://127.0.0.1:3000$p")
  echo "GET $p → $c"
done

jsonval() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1',''))" 2>/dev/null; }

# ── authenticated API smoke tests ──
PH=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"pharmacist","password":"Pharma123!"}')
PH_TOKEN=$(echo "$PH" | jsonval token)
echo "pharmacist login: $( [ -n "$PH_TOKEN" ] && echo OK || echo FAIL )"

if [ -n "$PH_TOKEN" ]; then
  echo "--- pharmacy-pos (pharmacist) ---"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pharmacy-pos?section=today-sales" -H "Authorization: Bearer $PH_TOKEN")
  echo "today-sales: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('totalSales'),d.get('scope'))" 2>/dev/null)"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pharmacy-pos?section=drugs&perPage=3" -H "Authorization: Bearer $PH_TOKEN")
  echo "drugs: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('drugs',[])),'drugs,',len(d.get('categories',[])),'categories')" 2>/dev/null)"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pharmacy-pos?section=sales" -H "Authorization: Bearer $PH_TOKEN")
  echo "sales scope: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('scope'))" 2>/dev/null)"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pharmacy-pos?section=prescriptions" -H "Authorization: Bearer $PH_TOKEN")
  echo "prescriptions: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('prescriptions',[])),'pending')" 2>/dev/null)"
  # minimal sale POST (walk-in, 1 unit of first in-stock drug)
  echo "$r" > /dev/null
  DRUG_ID=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pharmacy-pos?section=drugs" -H "Authorization: Bearer $PH_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['drugs'][0]['id'] if d.get('drugs') else '')" 2>/dev/null)
  if [ -n "$DRUG_ID" ]; then
    r=$(curl -s --max-time 30 -X POST http://127.0.0.1:3000/api/pharmacy-pos -H "Authorization: Bearer $PH_TOKEN" -H 'Content-Type: application/json' \
      -d "{\"items\":[{\"drugId\":\"$DRUG_ID\",\"quantity\":1}],\"patientName\":\"Smoke Walk-in\",\"patientPhone\":\"0700000000\",\"paymentMethod\":\"CASH\",\"discount\":0,\"billToVisit\":false}")
    echo "POST sale: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);s=d.get('sale',{});print(d.get('success'),s.get('saleNo'),s.get('totalAmount'),len(s.get('items',[])),'items')" 2>/dev/null)"
    SALE_ID=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin).get('sale',{}).get('id',''))" 2>/dev/null)
  fi
fi

CA=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"cashier","password":"Cashier123!"}')
CA_TOKEN=$(echo "$CA" | jsonval token)
echo "cashier login: $( [ -n "$CA_TOKEN" ] && echo OK || echo FAIL )"

if [ -n "$CA_TOKEN" ]; then
  echo "--- pos (cashier) ---"
  r=$(curl -s --max-time 30 "http://127.0.0.1:3000/api/pos?tab=pending-bills" -H "Authorization: Bearer $CA_TOKEN")
  echo "pending-bills: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);p=d.get('pending',[]);print(len(p),'visits;',sum(len(v.get('charges',[])) for v in p),'charge lines')" 2>/dev/null)"
  VISIT=$(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);p=d.get('pending',[]);print(p[0]['visitId']+'|'+p[0]['patient']['patientNo']+'|'+str(len(p[0]['charges'])) if p else '')" 2>/dev/null)
  echo "first pending: $VISIT"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/dashboard?portal=cashier" -H "Authorization: Bearer $CA_TOKEN")
  echo "cashier kpis: $(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin).get('kpis'))" 2>/dev/null)"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pos?tab=cashier-sales" -H "Authorization: Bearer $CA_TOKEN")
  echo "cashier-sales: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('payments',[])),'payments; summary',d.get('summary'))" 2>/dev/null)"
fi

AD=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin123!"}')
AD_TOKEN=$(echo "$AD" | jsonval token)
echo "admin login: $( [ -n "$AD_TOKEN" ] && echo OK || echo FAIL )"

if [ -n "$AD_TOKEN" ]; then
  echo "--- attendance (admin) ---"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/attendance" -H "Authorization: Bearer $AD_TOKEN")
  echo "all records: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('total'),'total')" 2>/dev/null)"
  # check-in without GPS (desktop pattern) then check-out — cleans up after itself
  r=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $AD_TOKEN" -H 'Content-Type: application/json' -d '{"action":"check-in","device":"smoke-test"}')
  echo "check-in: $(echo "$r" | jsonval message)$(echo "$r" | jsonval error)"
  # out-of-zone GPS must be rejected
  r=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $AD_TOKEN" -H 'Content-Type: application/json' -d '{"action":"check-out","latitude":-1.5,"longitude":37.0,"device":"smoke-test"}')
  echo "check-out (GPS out of zone, expect distance error): $(echo "$r" | jsonval error)"
  r=$(curl -s --max-time 20 -X POST http://127.0.0.1:3000/api/attendance -H "Authorization: Bearer $AD_TOKEN" -H 'Content-Type: application/json' -d '{"action":"check-out","device":"smoke-test"}')
  echo "check-out (no GPS): $(echo "$r" | jsonval message)$(echo "$r" | jsonval error)"
  echo "--- attendance-config (admin) ---"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/attendance-config" -H "Authorization: Bearer $AD_TOKEN")
  echo "config: $(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin).get('configs'))" 2>/dev/null)"
  echo "--- company + printer-settings (public print deps) ---"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/company")
  echo "company: $(echo "$r" | python3 -c "import sys,json;c=json.load(sys.stdin).get('config',{});print(c.get('companyName'),'|',c.get('receiptPaperSize'),'|',c.get('currencySymbol'))" 2>/dev/null)"
  r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/printer-settings")
  echo "printer: $(echo "$r" | python3 -c "import sys,json;c=json.load(sys.stdin).get('config',{});print(c.get('paperSize'),'copies',c.get('copies'))" 2>/dev/null)"
fi

# ── checkout POST smoke (cashier) using first pending visit with charges ──
if [ -n "$CA_TOKEN" ] && [ -n "$VISIT" ]; then
  VID=$(echo "$VISIT" | cut -d'|' -f1); PNO=$(echo "$VISIT" | cut -d'|' -f2); NCH=$(echo "$VISIT" | cut -d'|' -f3)
  if [ "$NCH" -gt 0 ] 2>/dev/null; then
    PID=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/patients?search=$PNO&perPage=5" -H "Authorization: Bearer $CA_TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);ps=d.get('patients',[]);print(ps[0]['id'] if ps else '')" 2>/dev/null)
    CHARGES=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pos?tab=pending-bills" -H "Authorization: Bearer $CA_TOKEN" | python3 -c "
import sys,json
d=json.load(sys.stdin)
p=[v for v in d.get('pending',[]) if v['visitId']=='$VID']
if p:
    ch=p[0]['charges'][0]
    qty=ch.get('quantity') or 1
    price=ch['price']/qty if (ch.get('quantity') or 1)>1 else ch['price']
    print(json.dumps([{'name':ch['name'],'price':round(price,2),'quantity':qty,'department':ch['department'],'shaCovered':ch['shaCovered']}]))
else:
    print('[]')" 2>/dev/null)
    if [ -n "$PID" ] && [ "$CHARGES" != "[]" ] && [ -n "$CHARGES" ]; then
      r=$(curl -s --max-time 30 -X POST http://127.0.0.1:3000/api/pos -H "Authorization: Bearer $CA_TOKEN" -H 'Content-Type: application/json' \
        -d "{\"visitId\":\"$VID\",\"patientId\":\"$PID\",\"paymentMode\":\"CASH\",\"discountAmount\":0,\"charges\":$CHARGES}")
      echo "POST checkout: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);b=d.get('bill',{});print(d.get('message'),b.get('billNo'),b.get('receiptNo'),b.get('totalAmount'),len(b.get('items',[])),'items')" 2>/dev/null)"
      BILL_ID=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin).get('bill',{}).get('id',''))" 2>/dev/null)
      if [ -n "$BILL_ID" ]; then
        r=$(curl -s --max-time 20 "http://127.0.0.1:3000/api/pos?tab=receipt&billId=$BILL_ID" -H "Authorization: Bearer $CA_TOKEN")
        echo "receipt fetch: $(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);b=d.get('bill') or {};print(b.get('billNo'),'items',len(b.get('items',[])),'patient',bool(b.get('patient')))" 2>/dev/null)"
      fi
    else
      echo "POST checkout: SKIPPED (patient or charges unresolved: pid=$PID charges=$CHARGES)"
    fi
  else
    echo "POST checkout: SKIPPED (no pending visit with charges)"
  fi
fi

kill $SERVER_PID 2>/dev/null
sleep 1
echo "=== dev.log errors ==="
rg -i "error|failed" /tmp/devserver.log | rg -v "error TS" | head -15 || echo "(none)"
echo "=== smoke test complete ==="
