# Dingocoin Scam Report Bot - Setup Guide

A comprehensive Discord bot for reporting and managing scam incidents with MariaDB storage, image processing, and advanced moderation features.

##  Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Database Setup](#database-setup)
4. [Discord Bot Setup](#discord-bot-setup)
5. [Configuration](#configuration)
6. [Role Configuration](#role-configuration)
7. [Running the Bot](#running-the-bot)
8. [Commands Overview](#commands-overview)
9. [Security Features](#security-features)
10. [Troubleshooting](#troubleshooting)

##  Prerequisites

Before setting up the bot, ensure you have:

- **Ubuntu 24.04 LTS** (Noble Numbat) or newer
- **Node.js** (v20.0.0 or higher - Latest LTS)
- **npm** (v10.0.0 or higher)
- **MariaDB** (v11.4 or higher)
- **Discord Developer Account**
- **Basic knowledge of Discord server administration**
- **sudo privileges** on your Ubuntu system

##  Installation

### Step 1: Update Ubuntu System

```bash
sudo apt update && sudo apt upgrade -y
```

### Step 2: Install Node.js 20 LTS using NodeSource Repository

```bash
# Install curl if not already installed
sudo apt install -y curl

# Add NodeSource repository for Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

### Step 3: Install Git and Essential Build Tools

```bash
sudo apt install -y git build-essential python3-dev
```

### Step 4: Clone and Set Up Project

1. **Clone the project**
   ```bash
   git clone <repository-url>
   cd dingocoin-scam-report-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp env.example .env
   ```

##  Database Setup

### Step 1: Install MariaDB 11.4+ on Ubuntu 24.04

**Install MariaDB from Official Repository:**

```bash
# Install software-properties-common if not already installed
sudo apt install -y software-properties-common

# Import MariaDB signing key
curl -LsS https://r.mariadb.com/downloads/mariadb_repo_setup | sudo bash

# Update package list
sudo apt update

# Install MariaDB server (latest stable version)
sudo apt install -y mariadb-server mariadb-client

# Start and enable MariaDB service
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Verify MariaDB is running
sudo systemctl status mariadb
```

**Secure MariaDB Installation:**

```bash
sudo mysql_secure_installation
```

Follow the prompts:
- Set root password (choose a strong password)
- Remove anonymous users: **Y**
- Disallow root login remotely: **Y** 
- Remove test database: **Y**
- Reload privilege tables: **Y**

**Verify MariaDB Version:**

```bash
mariadb --version
# Should show MariaDB 11.4.x or higher
```


### Step 2: Create Database and User

1. **Login to MariaDB as root**
   ```bash
   sudo mariadb -u root -p
   ```

2. **Create database and user with enhanced security**
   ```sql
   -- Create the database
   CREATE DATABASE scam_reports CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   -- Create user with strong password (replace with your own secure password)
   CREATE USER 'scambot'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';
   
   -- Grant necessary privileges
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON scam_reports.* TO 'scambot'@'localhost';
   
   -- Apply changes
   FLUSH PRIVILEGES;
   
   -- Verify user creation
   SELECT User, Host FROM mysql.user WHERE User = 'scambot';
   
   -- Exit MariaDB
   EXIT;
   ```

3. **Test the new user connection**
   ```bash
   mariadb -u scambot -p scam_reports
   # Enter the password you set above
   # If successful, you should see the MariaDB prompt
   EXIT;
   ```

### Step 3: Initialize Database Tables

```bash
# Test database connection first
npm run test-db

# If connection is successful, initialize tables
npm run setup
```

This will create all necessary tables automatically with proper indexes and constraints for optimal performance on MariaDB 11.4+.

##  Discord Bot Setup

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name your application (e.g., "Scam Report Bot")
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the bot token (you'll need this later)

### Step 2: Set Bot Permissions

In the "Bot" section, enable these **Privileged Gateway Intents**:
-  Server Members Intent
-  Message Content Intent

### Step 3: Bot Permissions

Your bot needs these permissions:
-  Send Messages
-  Use Slash Commands
-  Embed Links
-  Attach Files
-  Read Message History
-  Manage Messages
-  Timeout Members
-  Kick Members
-  Ban Members
-  Manage Roles (for admin commands)

### Step 4: Invite Bot to Server

1. Go to "OAuth2" > "URL Generator"
2. Select "bot" and "applications.commands" scopes
3. Select the permissions listed above
4. Copy the generated URL and open it
5. Select your server and authorize

## Configuration

Edit your `.env` file with the following information:

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=scambot
DB_PASSWORD=your_secure_password
DB_NAME=scam_reports

# Security Configuration (Optional)
VIRUS_TOTAL_API_KEY=your_virustotal_api_key
MAX_FILE_SIZE=8388608
ALLOWED_FILE_TYPES=png,jpg,jpeg,gif,webp

# Role Configuration
VERIFIED_ROLE_ID=your_verified_role_id
GUARDIAN_ROLE_ID=your_guardian_role_id
ADMIN_ROLE_ID=your_admin_role_id

# Features
VPN_DETECTION_ENABLED=true
LOG_CHANNEL_ID=your_log_channel_id
```

### Finding Discord IDs

To get Discord IDs:
1. Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
2. Right-click on roles/channels/users and select "Copy ID"

##  Role Configuration

### Required Roles

Create these roles in your Discord server:

1. **Verified Role** - Users who can submit reports
   - Basic permission level
   - Can use `/report` command

2. **Guardian Role** - Basic moderators
   - Can view reports
   - Can timeout users
   - Requires "dingo.role" or similar

3. **Admin Role** - Full administrators
   - All Guardian permissions
   - Can kick/ban users
   - Can manage database
   - Can add other admins

### Setting Up Roles

1. Go to Server Settings > Roles
2. Create the three roles mentioned above
3. Copy their IDs and add to `.env` file
4. Assign roles to appropriate users

##  Running the Bot

### Step 1: Deploy Commands

```bash
node src/deploy-commands.js
```

This registers all slash commands with Discord.

### Step 2: Start the Bot

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### Step 3: Verify Setup

1. Check console for "✅ Bot is ready!" message
2. Test `/report` command in your Discord server
3. Verify database connection in console

##  Commands Overview

### User Commands
- `/report` - Submit a scam report with evidence (requires verified role)

### Moderator Commands (Guardian Role+)
- `/viewreports` - View and filter scam reports
- `/timeout` - Timeout a user for specified duration

### Advanced Moderator Commands (Admin Role+)
- `/kick` - Kick a user from the server
- `/ban` - Ban a user from the server

### Admin Commands
- `/addadmin` - Add admin role to a user
- `/settings` - View bot configuration and statistics
- `/clearreport single` - Delete a specific report
- `/clearreport database` - Clear entire database (DANGEROUS)
- `/exportdb` - Export database to CSV format

##  Security Features

### Image Processing
- **Automatic WebP conversion** for storage optimization
- **Malware scanning** using VirusTotal API (optional)
- **File size and type validation**
- **Image dimension validation**

### VPN Detection
- **IP logging** for report submissions
- **VPN detection** using multiple methods (configurable)
- **Confidence scoring** for VPN detection

### Data Protection
- **Sanitized input** to prevent injection attacks
- **Secure file handling** with validation
- **Audit logging** for all admin actions
- **Role-based access control**

##  Troubleshooting

### Common Issues

**Bot doesn't respond to commands:**
- Check bot permissions in Discord server
- Verify bot token in `.env` file
- Run `node src/deploy-commands.js` to update commands

**Database connection failed:**
- Verify MariaDB is running
- Check database credentials in `.env`
- Ensure database exists and user has permissions

**Image processing errors:**
- Install Sharp dependencies: `npm install sharp`
- Check file permissions in uploads directory
- Verify supported file types

**Permission errors:**
- Check bot role hierarchy in Discord
- Ensure bot has required permissions
- Verify role IDs in configuration

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

### Getting Help

1. Check console logs for error messages
2. Verify all configuration values
3. Test database connection: `npm run setup`
4. Check Discord bot permissions

## Database Schema

The bot creates these tables automatically:

- **reports** - Main scam reports storage
- **admin_actions** - Audit log for admin actions
- **user_timeouts** - Timeout history

##  Updates and Maintenance

### Regular Maintenance
- Monitor database size and clean old reports if needed
- Review admin action logs periodically
- Update dependencies: `npm update`
- Backup database regularly

### Updating the Bot
1. Stop the bot
2. Pull latest changes
3. Run `npm install` for new dependencies
4. Run `npm run setup` if database changes
5. Deploy commands: `node src/deploy-commands.js`
6. Restart the bot

##  Production Deployment

For production deployment:

1. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name "scam-report-bot"
   ```

2. **Set up reverse proxy (nginx)** if needed
3. **Configure firewall** to allow only necessary ports
4. **Set up automated backups** for database
5. **Monitor logs** and set up alerts


---

**Need help?** Check the troubleshooting section or review the console logs for specific error messages.
