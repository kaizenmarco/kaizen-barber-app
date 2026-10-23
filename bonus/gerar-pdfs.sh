#!/bin/sh
# Gera os PDFs dos bônus a partir dos .html desta pasta, com o Chrome
# headless. Os PDFs saem em bonus/pdf/ — depois é só subir no bucket
# "bonus" do Supabase (kaizen-saas) com os mesmos nomes.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p pdf
for arquivo in bonus-*.html; do
  nome="${arquivo%.html}"
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --virtual-time-budget=10000 \
    --print-to-pdf="pdf/$nome.pdf" "file://$PWD/$arquivo" 2>/dev/null
  echo "ok pdf/$nome.pdf"
done
