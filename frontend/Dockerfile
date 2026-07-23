# 1. Nâng cấp lên Node.js 20 (hoặc 22) để đáp ứng yêu cầu của Next.js & Tailwind CSS v4
FROM node:20-alpine

WORKDIR /app

# 2. Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 3. Copy toàn bộ mã nguồn Frontend
COPY . .

# 4. Biến môi trường Build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

# 5. Giới hạn RAM giúp tránh tràn bộ nhớ khi build trên Render Free
ENV NODE_OPTIONS="--max-old-space-size=2048"

# 6. Build dự án
RUN npm run build

# 7. Cấu hình mở mạng cho Render
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]