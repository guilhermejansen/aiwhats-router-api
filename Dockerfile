# Use an official Node runtime as the base image
FROM node:21.6.2-alpine3.17

# Set the working directory in the container
WORKDIR /app

# Copy the package.json and package-lock.json to the container
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Expose the port that the application listens on
EXPOSE 5000

# Set the entrypoint script
ENTRYPOINT ["node", "app.js"]