#!/usr/bin/env bash

set -e

echo "checking inkogether backend stack"

services=(
  "app1:http://localhost:3001/health"
  "app2:http://localhost:3002/health"
  "app3:http://localhost:3003/health"
  "nginx:http://localhost:3000/health"
)

echo "- checking redis container"
if docker compose -f server/docker-compose.yml exec -T redis redis-cli ping | grep -q "PONG"; then
  echo "redis is healthy"
else
  echo "redis is not healthy"
  exit 1
fi

for service in "${services[@]}"; do
  name="${service%%:*}"
  url="${service#*:}"

  echo "- checking $name at $url"

  if curl -fsS "$url" > /tmp/inkogether_${name}.json; then
    echo "$name is reachable"
    cat /tmp/inkogether_${name}.json
    echo ""
  else
    echo "$name is not reachable"
    exit 1
  fi
done

echo "all checked services are reachable."