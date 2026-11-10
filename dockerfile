# downloads node
FROM node:22-alpine

# means cd /app inside the container
# sets the working directory inside the container to /app
WORKDIR /app

# copies package.json and package-lock.json to the working directory (install dependancies)
COPY package*.json ./

# installs depndancies (not husky)
RUN npm ci --ignore-scripts

# copies rest of applications
COPY . .                                                                                                                                                              

RUN npm run build

EXPOSE 8000

CMD ["npm", "start"]
