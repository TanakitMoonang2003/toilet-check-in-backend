FROM node:23-alpine

WORKDIR /app

COPY package*.json .

RUN npm install --frozen-lockfile

COPY . .

EXPOSE 5000

CMD ["node", "app.js"]
