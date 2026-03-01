# Home Dashboard

A PWA home automation dashboard that reads live data from Victoria Metrics.
Works in any modern browser (desktop & mobile) on virtually any device and can be pinned as a native app on iOS.

☠️ Achtung! Vibe coding in JS here.

## Architecture

```
Browser (VPN) ──fetch──▶ Victoria Metrics HTTP API
     │
     └──▶ nginx (static files)
```

The browser queries Victoria Metrics directly — no backend proxy.
The dashboard is just static files served by nginx.

**No authentication** — neither the frontend nor the Victoria Metrics backend authenticate requests. Use only on secure, private networks.

## Project Structure

```
├── public/
│   ├── index.html       # PWA shell
│   ├── app.js           # Fetch / render / pause logic
│   ├── style.css        # Responsive, auto dark/light theme
│   ├── manifest.json    # Web App Manifest
│   └── sw.js            # Service worker
├── conf/
│   ├── config.json          # Dashboard configuration (mount at runtime)
│   └── config.example.json  # Annotated example to copy from
├── icon.svg             # Source icon (converted to PNGs during Docker build)
├── nginx.conf           # nginx config
├── Dockerfile
└── k8s/
    ├── kustomization.yaml   # Generates ConfigMap from conf/config.json
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml         # Optional, edit host/TLS
```

---

## Configuration

Copy `conf/config.example.json` to `conf/config.json` and edit it to customise the dashboard.

```jsonc
{
  "victoriaMetrics": {
    "baseUrl": "http://victoria-metrics:8428"  // VM endpoint reachable from browser
  },
  "refresh": {
    "interval": 1000  // milliseconds between refreshes
  },
  "boxes": [
    {
      "title": "Living Room",
      "metrics": [
        {
          "label": "Temperature",
          "query": "sensor_temperature_celsius{room=\"living_room\"}",
          "unit": "°C",
          "scale": 1        // multiply raw value by this before display
        }
      ]
    }
  ]
}
```

### `scale` field
Use `scale` to convert units. For example, if the metric is in bytes and you want KB/s:
```json
{ "label": "Download", "query": "network_rx_bytes_per_sec", "unit": "KB/s", "scale": 0.001 }
```

---

## Local Development

Open `public/index.html` in a browser. You need direct access to the Victoria Metrics URL configured in `config.json`.

Alternatively, serve locally with any static file server:
```bash
npx serve public
# or
python3 -m http.server 8080 --directory public
```

---

## Docker Build & Run

```bash
# Build
docker build -t home-dashboard:latest .

# Test locally
docker run --rm -p 8080:8080 home-dashboard:latest
# → open http://localhost:8080
```

### Push to a registry

```bash
docker tag home-dashboard:latest your-registry/home-dashboard:latest
docker push your-registry/home-dashboard:latest
```

---

## Kubernetes Deployment

The k8s manifests use **Kustomize** (built into kubectl ≥ 1.14).
The ConfigMap is generated from `public/config.json` — no duplicate content.

### 1. Create namespace

```bash
kubectl create namespace home-dashboard
```

### 2. Edit the dashboard config

Edit `conf/config.json` — this is the single source of truth for both
local development and the Kubernetes ConfigMap.

### 3. Edit the Deployment image

In `k8s/deployment.yaml`, update the image field:
```yaml
image: your-registry/home-dashboard:latest
```

### 4. (Optional) Edit the Ingress

In `k8s/ingress.yaml`, update the hostname and TLS secret / issuer.

### 5. Apply all manifests

```bash
kubectl apply -k k8s/
```

### 6. Verify

```bash
kubectl -n home-dashboard get pods
kubectl -n home-dashboard get svc
```

### Updating the dashboard config without rebuilding

Edit `conf/config.json`, then re-apply:

```bash
kubectl apply -k k8s/
```

Kustomize appends a content hash to the ConfigMap name (e.g. `home-dashboard-config-5f6b8d4`).
When `config.json` changes the hash changes, the Deployment reference is updated, and
Kubernetes triggers a rolling restart automatically — no manual restart needed.

---

## iOS "Add to Home Screen"

1. Open the dashboard URL in **Safari** on iPhone/iPad.
2. Tap the **Share** button (box with arrow up).
3. Tap **Add to Home Screen**.
4. The app opens full-screen without the Safari UI and uses the house icon.

---

## PWA Features

| Feature | Details |
|---|---|
| Offline shell | Service worker caches HTML/CSS/JS on first visit |
| Auto dark/light | Follows OS setting via `prefers-color-scheme` |
| iOS standalone | `apple-mobile-web-app-capable` + apple-touch-icon |
| Auto-refresh | Every 1 s (configurable), pause/refresh buttons |
| Responsive grid | 1 column on mobile → multiple columns on wide screens |

---

## Security Notes

- The Victoria Metrics URL is embedded in `config.json` and fetched by the browser.
  Ensure the dashboard is only accessible over VPN.
- The nginx container runs as a non-root user (`nginx`, UID 101).
- `readOnlyRootFilesystem` is disabled because nginx writes PID and temporary files to `/tmp` — this is standard behaviour for the official nginx image.
