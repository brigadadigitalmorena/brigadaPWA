FROM node:20-slim

# Install system dependencies that some native Node packages may need
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Expose Next.js dev server port
EXPOSE 3000

# Bind to all interfaces so the host can reach the dev server
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Start the Next.js development server
CMD ["npm", "run", "dev"]
