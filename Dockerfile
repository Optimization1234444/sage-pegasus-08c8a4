FROM node:lts-slim

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

RUN useradd -m appuser
USER appuser

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "index.js"]
