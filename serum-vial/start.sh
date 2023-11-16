docker run -d \
  -p 8000:8000 \
  -e SV_LOG_LEVEL=debug \
  -e "SV_ENDPOINT=http://185.209.177.4:8899" \
  -e "SV_WS_ENDPOINT_PORT=8900" \
  tardisdev/serum-vial:latest
