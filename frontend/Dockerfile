# Sử dụng Node.js bản chính thức
FROM node:20-alpine

# Thiết lập thư mục làm việc trong container
WORKDIR /app

# Sao chép các file cấu hình package trước để tối ưu hóa cache của Docker
COPY package*.json ./

# Cài đặt các dependencies
RUN npm install --legacy-peer-deps

# Sao chép toàn bộ mã nguồn frontend vào container
COPY . .

# Mở cổng 3000 cho Next.js
EXPOSE 3000

# Chạy Next.js ở chế độ phát triển (Development) để bạn vừa code vừa hot-reload được
CMD ["npm", "run", "dev"]