FROM node:22.20.0

WORKDIR /app

# copy package first to install dependencies and leverage Docker cache
COPY package.json .
RUN npm install --production

# copy app sources
COPY server.js .
COPY controllers/ ./controllers/
COPY data/ ./data/

EXPOSE 3001 3002 3003

CMD [ "node", "server.js" ]
