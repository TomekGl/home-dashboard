# ── Stage 1: convert SVG icon → PNG sizes ─────────────────────────────────
FROM alpine:3.21 AS icons

RUN apk add --no-cache imagemagick

# Draw a house icon with ImageMagick primitives — no SVG delegate needed
RUN mkdir -p /tmp/icons && \
    magick -size 512x512 xc:'#1a1d23' \
      -fill '#58a6ff' \
      -draw "polygon 256,55 90,235 145,235 145,430 367,430 367,235 422,235" \
      -fill '#1a1d23' \
      -draw "rectangle 214,305 298,430" \
      -draw "rectangle 155,248 208,302" \
      -draw "rectangle 304,248 357,302" \
      /tmp/icons/icon-512.png && \
    magick /tmp/icons/icon-512.png -resize 192x192 /tmp/icons/icon-192.png && \
    magick /tmp/icons/icon-512.png -resize 180x180 /tmp/apple-touch-icon.png && \
    magick /tmp/icons/icon-512.png -resize 32x32  /tmp/favicon.png

# ── Stage 2: nginx serving static files ───────────────────────────────────
FROM nginx:1.27-alpine

# Use non-root port (8080) so we can run as non-root in Kubernetes
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf 2>/dev/null || true

COPY nginx.conf /etc/nginx/nginx.conf
COPY public/    /usr/share/nginx/html/

# Icons from build stage
COPY --from=icons /tmp/icons/           /usr/share/nginx/html/icons/
COPY --from=icons /tmp/apple-touch-icon.png /usr/share/nginx/html/apple-touch-icon.png
COPY --from=icons /tmp/favicon.png      /usr/share/nginx/html/favicon.png

# Create /conf mount point — config.json is injected at runtime (not baked in)
RUN mkdir -p /conf && chown nginx:nginx /conf

# Nginx writes tmp files; allow running as arbitrary UID
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx && \
    touch /tmp/nginx.pid && chown nginx:nginx /tmp/nginx.pid

EXPOSE 8080

USER nginx
