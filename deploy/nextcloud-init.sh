# SPDX-License-Identifier: AGPL-3.0-or-later
# Runs once, after Nextcloud's own installer, via docker-entrypoint-hooks.d/post-installation/
# (the official nextcloud image's entrypoint sources every file placed there — no shebang or +x
# bit required, and it only runs on the container's first successful install).
#
# Installs groupfolders (the storage.tree/storage.acl adapters in
# packages/providers/oss/src/nextcloud.ts require it) and creates the "staff.test" account the
# contract suite uses to probe ACLs as a non-admin user: storage.acl's verify step expects a staff
# write into "3. [R] RESOURCES" to be refused (403) and a write into their own
# "2. [A] AREAS/<dept>" to be accepted (201).
set -eu

occ() {
  su -s /bin/bash www-data -c "php /var/www/html/occ $*"
}

if ! occ app:list | grep -q "groupfolders"; then
  occ app:install groupfolders
fi
occ app:enable groupfolders

if ! occ user:list | grep -q "staff.test"; then
  OC_PASS="${NC_STAFF_PASSWORD:?NC_STAFF_PASSWORD not set}" occ user:add --password-from-env staff.test
fi
