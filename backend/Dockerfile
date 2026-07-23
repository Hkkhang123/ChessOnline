# Sử dụng Python bản chính thức làm base image
FROM python:3.13-slim

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Ngăn Python tạo các file .pyc và bật chế độ không buffer để log in ra ngay lập tức
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Cài đặt các công cụ hệ thống cần thiết (nếu thư viện mã hóa yêu cầu)
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ libffi-dev && rm -rf /var/lib/apt/lists/*

# Sao chép file requirements và cài đặt thư viện
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Sao chép toàn bộ mã nguồn backend vào container
COPY . .

# Mở cổng 8000 của container
EXPOSE 8000

# Lệnh khởi chạy FastAPI bằng Uvicorn lắng nghe trên mọi dải IP (0.0.0.0)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]