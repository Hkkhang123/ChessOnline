# Sử dụng Python 3.10-slim (bản cực kỳ ổn định cho FastAPI + WebSocket trên Linux)
FROM python:3.10-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Ngăn Python tạo các file .pyc và bật chế độ không buffer để log in ra ngay lập tức
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Cài đặt các công cụ hệ thống cần thiết cho các thư viện mã hóa
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Sao chép file requirements và cài đặt thư viện
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Sao chép toàn bộ mã nguồn backend vào container
COPY . .

# Khai báo cổng (Render sẽ dùng $PORT)
EXPOSE 8000

# Lệnh khởi chạy Uvicorn với WebSocket websockets protocol
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --ws websockets --loop asyncio"]