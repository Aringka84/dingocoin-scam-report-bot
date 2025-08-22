#!/bin/bash

# Dingocoin Scam Report Bot - Ubuntu 24.04 Installation Script
# This script installs all dependencies and sets up the bot environment

set -e  # Exit on any error

echo "🚀 Installing Dingocoin Scam Report Bot on Ubuntu 24.04"
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   exit 1
fi

# Check Ubuntu version
if ! grep -q "24.04" /etc/os-release; then
    print_warning "This script is optimized for Ubuntu 24.04. Your version might work but is not tested."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

print_status "Installing essential packages..."
sudo apt install -y curl wget gnupg2 software-properties-common build-essential python3-dev git

# Install Node.js 20.x
print_status "Installing Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_success "Node.js installed: $NODE_VERSION"
print_success "npm installed: $NPM_VERSION"

# Check Node.js version
if ! node -e "process.exit(process.version.match(/^v(\d+)/)[1] >= 20 ? 0 : 1)"; then
    print_error "Node.js version 20 or higher is required"
    exit 1
fi

# Install MariaDB
print_status "Installing MariaDB 11.4+..."
curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | sudo bash
sudo apt update
sudo apt install -y mariadb-server mariadb-client

# Start and enable MariaDB
print_status "Starting MariaDB service..."
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Check MariaDB status
if sudo systemctl is-active --quiet mariadb; then
    MARIADB_VERSION=$(mariadb --version | awk '{print $5}' | sed 's/,//')
    print_success "MariaDB installed and running: $MARIADB_VERSION"
else
    print_error "MariaDB failed to start"
    exit 1
fi

# Install project dependencies if package.json exists
if [ -f "package.json" ]; then
    print_status "Installing Node.js dependencies..."
    npm install
    print_success "Dependencies installed successfully"
else
    print_warning "package.json not found. Make sure you're in the project directory."
fi

# Create necessary directories
print_status "Creating project directories..."
mkdir -p uploads exports logs

# Set up environment file
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        cp env.example .env
        print_success "Environment file created from example"
        print_warning "Please edit .env file with your configuration before running the bot"
    else
        print_warning "env.example not found. You'll need to create .env manually"
    fi
else
    print_success "Environment file already exists"
fi

# Create systemd service file
print_status "Creating systemd service file..."
sudo tee /etc/systemd/system/scambot.service > /dev/null <<EOF
[Unit]
Description=Dingocoin Scam Report Bot
After=network.target mariadb.service
Requires=mariadb.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scambot

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
print_success "Systemd service created: scambot.service"

# Create log rotation config
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/scambot > /dev/null <<EOF
/var/log/scambot/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    create 644 $USER $USER
}
EOF

# Create log directory
sudo mkdir -p /var/log/scambot
sudo chown $USER:$USER /var/log/scambot

print_success "Log rotation configured"

# Create backup script
print_status "Creating database backup script..."
tee backup-db.sh > /dev/null <<'EOF'
#!/bin/bash
# Database backup script for Scam Report Bot

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
DB_NAME="scam_reports"
DB_USER="scambot"

mkdir -p $BACKUP_DIR

echo "Creating database backup..."
mariadb-dump -u $DB_USER -p $DB_NAME > $BACKUP_DIR/scam_reports_backup_$DATE.sql

if [ $? -eq 0 ]; then
    echo "Backup created successfully: $BACKUP_DIR/scam_reports_backup_$DATE.sql"
    
    # Keep only last 7 backups
    ls -t $BACKUP_DIR/scam_reports_backup_*.sql | tail -n +8 | xargs -r rm
    echo "Old backups cleaned up"
else
    echo "Backup failed!"
    exit 1
fi
EOF

chmod +x backup-db.sh
print_success "Database backup script created: backup-db.sh"

# Final instructions
echo
echo "=============================================="
print_success "Installation completed successfully!"
echo "=============================================="
echo
print_status "Next steps:"
echo "1. Secure MariaDB installation:"
echo "   sudo mysql_secure_installation"
echo
echo "2. Create database and user:"
echo "   sudo mariadb -u root -p"
echo "   CREATE DATABASE scam_reports CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "   CREATE USER 'scambot'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';"
echo "   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON scam_reports.* TO 'scambot'@'localhost';"
echo "   FLUSH PRIVILEGES;"
echo "   EXIT;"
echo
echo "3. Configure the bot:"
echo "   nano .env"
echo
echo "4. Test database connection:"
echo "   npm run test-db"
echo
echo "5. Initialize database tables:"
echo "   npm run setup"
echo
echo "6. Deploy Discord commands:"
echo "   npm run deploy"
echo
echo "7. Start the bot:"
echo "   npm start"
echo
echo "8. Or enable as system service:"
echo "   sudo systemctl enable scambot"
echo "   sudo systemctl start scambot"
echo
print_status "For detailed setup instructions, see SETUP_GUIDE.md"
print_warning "Remember to configure your Discord bot token and role IDs in .env!"

# System information
echo
print_status "System Information:"
echo "OS: $(lsb_release -d | cut -f2)"
echo "Node.js: $NODE_VERSION"
echo "npm: $NPM_VERSION"
echo "MariaDB: $MARIADB_VERSION"
echo "Architecture: $(uname -m)"
echo "Memory: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Storage: $(df -h / | awk 'NR==2 {print $4 " available"}')"
