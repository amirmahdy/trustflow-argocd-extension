# TrustFlow Argo CD UI extension

This folder contains a minimal Argo CD UI extension that renders TrustFlow security status (signature, SBOM, and vulnerability summary) inside Argo CD.

## Build

```bash
cd trustflow-argocd-extension
npm run build
```

This writes `dist/extension-trustflow.js`.

## Package for argocd-extension-installer

```bash
cd trustflow-argocd-extension
chmod +x scripts/package.sh
npm run package
```

This writes `dist/extension-trustflow.tar` with the required `resources/` structure.

Upload the tarball to a GitHub release or any URL reachable from the `argocd-server` pod, and set `EXTENSION_URL` accordingly.
