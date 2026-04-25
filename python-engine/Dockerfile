FROM python:3.12-slim

WORKDIR /app

# Install build deps for asyncpg/numpy + protobuf compiler
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev protobuf-compiler && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Compile Upstox protobuf schema (generates proto/MarketDataFeed_pb2.py)
RUN protoc -I=proto --python_out=proto proto/MarketDataFeed.proto || true

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
