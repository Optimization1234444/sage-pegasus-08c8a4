# 阶段 1: 构建依赖
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# 阶段 2: 运行环境
FROM node:18-alpine

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 从 builder 复制 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 更改所有权
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
