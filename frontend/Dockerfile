FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 1. Khai báo ARG để nhận biến môi trường từ Render truyền vào lúc build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

# 2. Chuyển ARG thành ENV cho Next.js đọc được lúc "npm run build"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

# 3. Tiến hành build
RUN npm run build

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]