# 阶段1：构建依赖
FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* ./

# 安装所有依赖（包括 devDependencies，如果 server.js 需要它们的话）
# 如果 server.js 只依赖 production 包，可以使用 npm ci --omit=dev
RUN npm install

# 阶段2：运行环境
FROM node:22-alpine

WORKDIR /app

# 1. 提前创建非root用户和组 (UID/GID 固定为 1001，便于权限管理)
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 2. 从构建阶段复制 node_modules，并直接设置所有权为 appuser
# 注意：这里使用 --chown 避免后续额外的 RUN chown 层
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# 3. 复制源代码，并直接设置所有权
# 确保你的项目根目录有 .dockerignore 文件，排除 node_modules, .git 等
COPY --chown=appuser:appgroup . .

# 4. 切换到普通用户
USER appuser

# 5. 暴露端口
EXPOSE 3000/tcp

# 6. 设置环境变量
ENV NODE_ENV=production

# 7. 启动命令
CMD ["node", "server.js"]
# 阶段1：构建依赖，使用完全匹配要求的Node 22版本
FROM node:22-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用Docker缓存层
COPY package.json package-lock.json* ./

# 安装所有依赖，跳过严格的生产模式限制
RUN npm install

# 阶段2：运行环境
FROM node:22-alpine

WORKDIR /app

# 创建非root安全用户
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# 从构建阶段复制已安装好的依赖
COPY --from=builder /app/node_modules ./node_modules

# 复制项目所有源代码
COPY . .

# 修正文件所有权，避免权限问题
RUN chown -R appuser:appgroup /app

# 切换到普通用户运行，提升容器安全性
USER appuser

# 暴露服务端口
EXPOSE 3000

ENV NODE_ENV=production

# 启动入口命令，对应你之前创建的server.js
CMD ["node", "server.js"]
