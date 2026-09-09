#!/bin/sh
set -e
# Railway mounts /data root-owned at runtime; fix before dropping to node
chown -R node:node /data || chmod 777 /data
exec su-exec node node server/index.mjs
