#!/bin/bash
set -e

# Install Python deps
pip install -r requirements.txt --quiet

# Build frontend (skip if dist already exists to speed up restarts)
if [ ! -d "frontend/dist" ]; then
  cd frontend
  npm install --silent
  npm run build
  cd ..
fi

# Start backend — serves the built frontend as static files
# Replit sets $PORT for deployments; fall back to 8000 for local dev
cd backend
uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
