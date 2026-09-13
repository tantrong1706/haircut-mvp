#!/usr/bin/env bash
set -euo pipefail

NODE_VERSION="${NODE_VERSION:-22.23.0}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root on Ubuntu 22.04." >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl debian-keyring debian-archive-keyring apt-transport-https \
  gnupg xz-utils sqlite3 ufw

if ! id -u zalo-gateway >/dev/null 2>&1; then
  useradd --system --home /var/lib/zalo-gateway --shell /usr/sbin/nologin zalo-gateway
fi

architecture="$(dpkg --print-architecture)"
case "${architecture}" in
  amd64) node_arch="x64" ;;
  arm64) node_arch="arm64" ;;
  *) echo "Unsupported architecture: ${architecture}" >&2; exit 1 ;;
esac

if ! command -v node >/dev/null 2>&1 || [[ "$(node --version)" != v22.* ]]; then
  temporary="$(mktemp -d)"
  trap 'rm -rf "${temporary}"' EXIT
  node_file="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
  base_url="https://nodejs.org/dist/v${NODE_VERSION}"
  curl --fail --silent --show-error --location "${base_url}/${node_file}" -o "${temporary}/${node_file}"
  curl --fail --silent --show-error --location "${base_url}/SHASUMS256.txt" -o "${temporary}/SHASUMS256.txt"
  (cd "${temporary}" && grep " ${node_file}$" SHASUMS256.txt | sha256sum --check --strict)
  rm -rf "/opt/node-v${NODE_VERSION}"
  mkdir -p "/opt/node-v${NODE_VERSION}"
  tar --extract --xz --file "${temporary}/${node_file}" --strip-components=1 --directory "/opt/node-v${NODE_VERSION}"
  ln -sfn "/opt/node-v${NODE_VERSION}/bin/node" /usr/local/bin/node
  ln -sfn "/opt/node-v${NODE_VERSION}/bin/npm" /usr/local/bin/npm
fi

if ! command -v caddy >/dev/null 2>&1; then
  temporary_key="$(mktemp)"
  curl --fail --silent --show-error --location \
    https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o "${temporary_key}"
  gpg --dearmor --yes --output /usr/share/keyrings/caddy-stable-archive-keyring.gpg "${temporary_key}"
  rm -f "${temporary_key}"
  curl --fail --silent --show-error --location \
    https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    -o /etc/apt/sources.list.d/caddy-stable.list
  chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
fi

install -d -o root -g root -m 0755 /opt/zalo-gateway /opt/zalo-gateway/releases
install -d -o zalo-gateway -g zalo-gateway -m 0700 /var/lib/zalo-gateway
install -d -o root -g zalo-gateway -m 0750 /etc/zalo-gateway
install -m 0644 "${REPO_ROOT}/deploy/zalo-gateway/zalo-gateway.service" /etc/systemd/system/zalo-gateway.service
install -m 0644 "${REPO_ROOT}/deploy/zalo-gateway/Caddyfile" /etc/caddy/Caddyfile.haircut-template
systemctl daemon-reload

echo "Bootstrap complete. Create /etc/zalo-gateway/gateway.env with mode 0640, replace GATEWAY_FQDN, then deploy a release."
echo "No service, firewall rule, credential, or production switch was enabled automatically."
