#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-}"
VERSION="${2:-}"
BASE_DIR="${BASE_DIR:-/opt/zalo-gateway}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/health}"

if [[ -z "${SOURCE_DIR}" || -z "${VERSION}" ]]; then
  echo "Usage: deploy-release.sh <gateway-source-directory> <version>" >&2
  exit 2
fi
if [[ ! "${VERSION}" =~ ^[A-Za-z0-9._-]{7,128}$ ]]; then
  echo "Version must be a safe commit SHA or release identifier." >&2
  exit 2
fi
if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root on the prepared VPS." >&2
  exit 1
fi
if [[ ! -f /etc/zalo-gateway/gateway.env ]]; then
  echo "Missing /etc/zalo-gateway/gateway.env" >&2
  exit 1
fi

release="${BASE_DIR}/releases/${VERSION}"
previous="$(readlink -f "${BASE_DIR}/current" 2>/dev/null || true)"
staging="$(mktemp -d "${BASE_DIR}/releases/.staging-${VERSION}-XXXXXX")"
trap 'rm -rf "${staging}"' EXIT

cd "${SOURCE_DIR}"
npm ci
npm run check
install -d "${staging}"
cp -a dist package.json package-lock.json "${staging}/"
(cd "${staging}" && npm ci --omit=dev --ignore-scripts && sha256sum package.json package-lock.json dist/src/server.js > SHA256SUMS)
chown -R root:root "${staging}"
chmod -R u=rwX,go=rX "${staging}"

if [[ -e "${release}" ]]; then
  echo "Release already exists: ${release}" >&2
  exit 1
fi
mv "${staging}" "${release}"
trap - EXIT
ln -sfn "${release}" "${BASE_DIR}/current.next"
mv -Tf "${BASE_DIR}/current.next" "${BASE_DIR}/current"

systemctl restart zalo-gateway
if ! curl --fail --silent --show-error --max-time 5 "${HEALTH_URL}" >/dev/null; then
  echo "Health check failed; rolling back." >&2
  if [[ -n "${previous}" && -d "${previous}" ]]; then
    ln -sfn "${previous}" "${BASE_DIR}/current.next"
    mv -Tf "${BASE_DIR}/current.next" "${BASE_DIR}/current"
    systemctl restart zalo-gateway
    curl --fail --silent --show-error --max-time 5 "${HEALTH_URL}" >/dev/null
  fi
  exit 1
fi

echo "Deployed ${VERSION}; previous release: ${previous:-none}"
