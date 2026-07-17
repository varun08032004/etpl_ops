#!/usr/bin/env bash
# Sets your company_profile (letterhead details + logo/seal/signature URLs).
# Fill in ADMIN_TOKEN and API_BASE, then run:
#   ADMIN_TOKEN=... API_BASE=https://your-api ./set-company-profile.sh

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000}"
ADMIN_TOKEN="${ADMIN_TOKEN:?Set ADMIN_TOKEN env var to an admin staff account's JWT — see previous message for how to get one via /api/auth/login}"

curl -sS -X PUT "$API_BASE/api/document-engine/company-profile" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "EtherTrack Technologies Private Limited",
    "cin": "U62090PN2026PTC257708",
    "gstin": null,
    "registered_address": "Flat No 306, Truspace Prima Angulus , Patil wasti , Baner Gaon , Balewadi , Pune , Maharashtra , India",
    "email": "contact@ethertrack.in",
    "website": "www.ethertrack.in",
    "phone": "9022477340",
    "default_signatory_name": "Varun Girish Deshmukh",
    "default_signatory_title": "Managing Director",
    "logo_url": "https://hybufntjrxikcpkwonei.supabase.co/storage/v1/object/public/branding/Ethertrack_Logo.png",
    "seal_image_url": "https://hybufntjrxikcpkwonei.supabase.co/storage/v1/object/public/branding/ETPL_SEAL.png",
    "signature_image_url": "https://hybufntjrxikcpkwonei.supabase.co/storage/v1/object/public/branding/varun%20sign.png",
    "verification_base_url": "https://ops.ethertrack.in/verify"
  }' | python3 -m json.tool