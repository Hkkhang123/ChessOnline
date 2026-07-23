FROM node:18-alpine

WORKDIR /app

# 1. Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install

# 2. Copy toàn bộ mã nguồn Frontend
COPY . .

# 3. Khai báo biến môi trường Build (nếu cần) và Build ứng dụng cho Production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 4. CẤU HÌNH QUAN TRỌNG: Mở mạng cho Render truy cập (Bắt buộc dùng 0.0.0.0)
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

# 5. Chạy ứng dụng ở chế độ Production (KHÔNG dùng next dev)
CMD ["npm", "start"]