# NotebookLM Local

A production-grade, 100% private local NotebookLM clone powered by Electron, Vite, FastAPI, and ChromaDB.

## Installation Guide

Since this is an unsigned open-source application, your operating system may show security warnings during installation.

### 🍏 macOS Installation
If macOS says the application is **"damaged and can't be opened"**, it's because Apple's Gatekeeper blocked the unsigned app. To fix this:
1. Drag `NotebookLM Local.app` to your **Applications** folder.
2. Open the **Terminal** app.
3. Run this exact command to remove the quarantine flag:
   ```bash
   sudo xattr -cr "/Applications/NotebookLM Local.app"
   ```
4. Double click the app in your Applications folder to run it!

### 🪟 Windows Installation
If Microsoft Defender SmartScreen prevents the app from starting:
1. On the blue warning screen, click **"More Info"**.
2. Click the **"Run Anyway"** button that appears at the bottom.

## Development

```bash
# Install dependencies
npm install
cd backend && uv venv && uv pip install -r requirements.txt && cd ..

# Run dev environment (Vite frontend + Python backend + Electron)
npm run electron:dev

# Build for production
npm run package
```
