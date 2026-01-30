#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist_dir="${root_dir}/dist"
bundle="${dist_dir}/extension-trustflow.tar"
resources_dir="${dist_dir}/resources/trustflow"

mkdir -p "${resources_dir}"
cp "${dist_dir}/extension-trustflow.js" "${resources_dir}/extension-trustflow.js"

tar -C "${dist_dir}" -cf "${bundle}" resources
rm -rf "${dist_dir}/resources"

echo "Wrote ${bundle}"
