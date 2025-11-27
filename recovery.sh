#!/bin/bash

# ButcApp VPS Recovery Script
# Use this script to fix the Node.js installation issue

set -e

echo "🔧 Starting ButcApp VPS recovery..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Force remove all Node.js packages
print_status "Force removing all Node.js packages..."
dpkg --remove --force-depends nodejs npm 2>/dev/null || true
apt remove -y nodejs npm libnode72 libnode-dev 2>/dev/null || true
apt autoremove -y
apt autoclean

# Remove Node.js repository
print_status "Removing Node.js repository..."
rm -f /etc/apt/sources.list.d/nodesource.list*
rm -rf /usr/share/keyrings/nodesource.gpg

# Update package lists
apt update

# Install NVM and Node.js 20.x
print_status "Installing Node.js 20.x via NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js
bash -c '. ~/.nvm/nvm.sh && nvm install 20 && nvm use 20 && nvm alias default 20'

# Create system-wide symlinks
print_status "Creating system-wide Node.js symlinks..."
NODE_VERSION=$(ls ~/.nvm/versions/node/ | grep v20 | head -1)
ln -sf ~/.nvm/versions/node/$NODE_VERSION/bin/node /usr/bin/node
ln -sf ~/.nvm/versions/node/$NODE_VERSION/bin/npm /usr/bin/npm
ln -sf ~/.nvm/versions/node/$NODE_VERSION/bin/npx /usr/bin/npx

# Verify installation
print_status "Verifying Node.js installation..."
node --version
npm --version

# Install PM2
print_status "Installing PM2..."
npm install -g pm2

# Continue with deployment
print_status "Continuing with deployment..."
cd /root/ButcApp

# Install dependencies
npm install

# Build application
npm run build

# Setup PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'butcapp',
    script: 'npm',
    args: 'start',
    cwd: '/root/ButcApp',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

print_status "✅ Recovery completed successfully!"
echo "Application is now running on port 3000"
echo "Check status with: pm2 status"
echo "View logs with: pm2 logs butcapp"