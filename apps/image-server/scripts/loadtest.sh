#!/usr/bin/env bash
# Fire parallel multipart uploads at the image-server and print per-request status.
# Usage: loadtest.sh <host:port> <token> <file> [concurrency=10] [route=/images]
# Works against localhost, docker or a port-forwarded pod (kubectl port-forward).
set -u

if [ $# -lt 3 ]; then
  echo "Usage: $0 <host:port> <token> <file> [concurrency=10] [route=/images]" >&2
  exit 1
fi

host=$1 token=$2 file=$3 concurrency=${4:-10} route=${5:-/images}
case $host in http://* | https://*) ;; *) host="http://$host" ;; esac

# Field name is the route without slash and plural "s": /images -> image.
field=${route#/}
field=${field%s}
case $route in /images | /documents) copies=3 ;; *) copies=1 ;; esac

form=()
for _ in $(seq "$copies"); do form+=(-F "$field=@$file"); done

for n in $(seq "$concurrency"); do
  curl -s -o /dev/null -H "image-token: $token" "${form[@]}" \
    -w "upload $n: HTTP %{http_code} in %{time_total}s\n" "$host$route" &
done
wait
