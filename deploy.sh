#!/bin/bash

# ButcApp Debian VPS Deployment Script
# This script deploys the ButcApp project on a Debian VPS with permanent 3000 port

set -e

echo "🚀 Starting ButcApp deployment on Debian VPS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx

# Install Node.js 18.x
print_status "Installing Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 globally
print_status "Installing PM2 process manager..."
npm install -g pm2

# Create application directory
APP_DIR="/var/www/butcapp"
print_status "Creating application directory at $APP_DIR..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull the repository
if [ -d ".git" ]; then
    print_status "Pulling latest changes..."
    git pull origin main
else
    print_status "Cloning ButcApp repository..."
    # Note: Replace this URL with your actual ButcApp repo URL
    git clone https://github.com/ButcApp/ButcApp.git .
fi

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Build the application
print_status "Building Next.js application..."
npm run build

# Setup environment variables
if [ ! -f ".env.production" ]; then
    print_warning "Creating .env.production file. Please update it with your actual values."
    cat > .env.production << EOF
NODE_ENV=production
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-nextauth-secret-here
DATABASE_URL="file:./db/production.db"
# Add other environment variables as needed
EOF
fi

# Create database directory
mkdir -p db

# Setup database
print_status "Setting up database..."
if [ -f "prisma/schema.prisma" ]; then
    npx prisma generate
    npx prisma db push
fi

# Setup PM2 ecosystem file
print_status "Setting up PM2 ecosystem..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'butcapp',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/butcapp',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Setup Nginx configuration
print_status "Setting up Nginx configuration..."
cat > /etc/nginx/sites-available/butcapp << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/butcapp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx

# Setup SSL certificate with Let's Encrypt (optional)
read -p "Do you want to setup SSL certificate? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Setting up SSL certificate..."
    certbot --nginx -d yourdomain.com -d www.yourdomain.com
fi

# Setup firewall
print_status "Setting up firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Create update script
print_status "Creating update script..."
cat > /var/www/butcapp/update.sh << EOF
#!/bin/bash
cd /var/www/butcapp
git pull origin main
npm install
npm run build
if [ -f "prisma/schema.prisma" ]; then
    npx prisma generate
    npx prisma db push
fi
pm2 restart butcapp
echo "✅ ButcApp updated successfully!"
EOF

chmod +x /var/www/butcapp/update.sh

# Display status
print_status "Deployment completed successfully!"
echo ""
echo "🎉 ButcApp is now running on port 3000"
echo "📝 Application URL: http://yourdomain.com"
echo "🔧 PM2 status: pm2 status"
echo "📊 PM2 logs: pm2 logs butcapp"
echo "🔄 To update: /var/www/butcapp/update.sh"
echo ""
echo "⚠️  IMPORTANT: Don't forget to:"
echo "   1. Update 'yourdomain.com' in Nginx configuration"
echo "   2. Update .env.production with your actual values"
echo "   3. Setup SSL certificate for production"
echo ""

# Show PM2 status
pm2 status