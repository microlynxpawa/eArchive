FROM node:18

WORKDIR /e-archive

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4500

CMD ["npm", "start"]
