# Production image of the front: the static client-side build of Angular served by unprivileged nginx.
#   docker build -t hermes-front .                                   (production build)
#   docker build --build-arg BUILD_CONFIGURATION=e2e -t hermes-front:e2e .   (e2e suite: allows the Auth emulator)
# runtime-config.json is mounted at run time (compose.yaml), never baked in. Settings of the server (environment):
#   API_UPSTREAM             backend API the /api/ proxy forwards to (default http://api:8000, the backend service)
#   CSP_CONNECT_EXTRA        extra origins for the CSP connect-src (default none)
#   HSTS_INCLUDE_SUBDOMAINS  true adds includeSubDomains to HSTS (default false, like the backend)

FROM node:22.23.4-bookworm-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Lifecycle scripts of dependencies are not run, as in CI (the build only needs the esbuild binary package).
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
ARG BUILD_CONFIGURATION=production
RUN npx ng build --configuration "$BUILD_CONFIGURATION" \
    && rm -f dist/hermes-front/browser/runtime-config.json

# Upstream publishes the unprivileged image as nginx/nginx-unprivileged since 1.30.6 (stable); the old nginxinc/
# repository gets no newer releases, so patched builds (1.30.7 and later fix Trivy CVEs of nginx) only exist here.
FROM nginx/nginx-unprivileged:1.30.8-alpine@sha256:637c35e46af7bc0dd3d3bcf7162e004e13ab3b370fde7cd416e2ac410b5a985a
# The entrypoint renders the template into /tmp/conf.d (the only writable place with a read-only root file system)
# and looks up Docker's DNS server for the /api/ proxy (NGINX_LOCAL_RESOLVERS).
ENV API_UPSTREAM=http://api:8000 \
    CSP_CONNECT_EXTRA="" \
    HSTS_INCLUDE_SUBDOMAINS=false \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_OUTPUT_DIR=/tmp
USER root
# libxml2 (a dependency of the bundled xslt module) carries HIGH CVEs fixed in Alpine after this base was built: only it
# is upgraded. A full `apk upgrade` could swap nginx.org's nginx for Alpine's own package when Alpine's is newer.
RUN apk upgrade --no-cache libxml2 \
    && rm -f /etc/nginx/conf.d/default.conf \
    && sed -i 's#include /etc/nginx/conf.d/\*.conf;#include /tmp/conf.d/*.conf;#' /etc/nginx/nginx.conf \
    && grep -q 'include /tmp/conf.d/\*.conf;' /etc/nginx/nginx.conf
COPY docker/nginx/security-headers.conf /etc/nginx/hermes/security-headers.conf
COPY docker/nginx/default.conf.template /etc/nginx/templates/conf.d/default.conf.template
COPY --from=build /app/dist/hermes-front/browser /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/index.html || exit 1
