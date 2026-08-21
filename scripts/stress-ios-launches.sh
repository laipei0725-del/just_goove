#!/bin/zsh

set -u

stress_device_id="${1:?usage: stress-ios-launches.sh DEVICE_ID [COUNT]}"
stress_count="${2:-20}"
stress_bundle_id="${3:-com.peipei.justgroove}"
stress_failures=0

for stress_iteration in $(seq 1 "$stress_count"); do
  if xcrun devicectl device process launch \
    --device "$stress_device_id" \
    --terminate-existing \
    --quiet \
    "$stress_bundle_id" >/dev/null 2>&1; then
    print "PASS launch $stress_iteration/$stress_count"
  else
    print "FAIL launch $stress_iteration/$stress_count"
    stress_failures=$((stress_failures + 1))
  fi
  sleep 1
done

if (( stress_failures > 0 )); then
  print "Launch stress failed: $stress_failures/$stress_count"
  exit 1
fi

print "Launch stress passed: $stress_count/$stress_count"
