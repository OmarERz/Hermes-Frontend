#!/usr/bin/env bash
# Semgrep CE in Docker (pinned image, the same as the backend Makefile): registry packs for TypeScript and
# JavaScript (p/typescript, which has the same rules as p/javascript, Angular's bypassSecurityTrust included), XSS
# (p/xss), the OWASP Top 10 (p/owasp-top-ten) and secrets (p/secrets), the container files (p/dockerfile, p/nginx)
# and the project rules in .semgrep/ (Angular templates). Fails on WARNING or ERROR findings.
# Scans the tracked and untracked files that git does not ignore, minus generated or vendored files.
# Usage: npm run semgrep (needs Docker; the rule packs are downloaded from the Semgrep registry).
set -euo pipefail

SEMGREP_IMAGE="semgrep/semgrep:1.185.0@sha256:67518c174185a2043fdbed16c70631b79209499b3671178e7194379b48295a0d"

cd "$(git rev-parse --show-toplevel)"

git ls-files -z --cached --others --exclude-standard -- \
  ':!package-lock.json' ':!openapi/openapi.json' ':!src/app/core/api/schema.d.ts' ':!public/**' |
  xargs -0 -r docker run --rm -v "$PWD:/src:ro" -w /src "$SEMGREP_IMAGE" semgrep scan \
    --config p/typescript --config p/xss --config p/owasp-top-ten --config p/secrets \
    --config p/dockerfile --config p/nginx --config /src/.semgrep/ \
    --metrics=off --no-git-ignore --error --severity WARNING --severity ERROR --
