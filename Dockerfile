# Multi-stage build mirroring Replit deployment.
# Stage 1: build frontend + install Python deps
# Stage 2: lean production image with built assets

# ---- Builder ----
FROM python:3.11-bookworm AS builder

WORKDIR /app

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Frontend build
COPY frontend/ ./frontend/
RUN cd frontend && npm ci --silent && npm run build

# ---- Production ----
FROM python:3.11-slim AS production

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist/

# Default env vars (override at runtime)
ENV PORT=8000
ENV APP_PASSWORD=""

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:8000/api/health || exit 1

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
