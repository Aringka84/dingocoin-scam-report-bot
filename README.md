# Dingocoin Scam Report Bot

A comprehensive Discord bot for reporting and managing scam incidents with MariaDB storage, advanced image processing, and role-based moderation system.

## Features

### Report System
- **Comprehensive scam reporting** with evidence collection
- **Automatic screenshot processing** and WebP conversion
- **Malware scanning** for uploaded files
- **VPN detection** and IP logging
- **Link extraction** from report descriptions
- **Unique report IDs** for tracking

### Moderation Tools
- **Role-based permissions** (Verified, Guardian, Admin)
- **User timeout system** with logging
- **Kick and ban commands** with audit trails
- **Report viewing and filtering**
- **Database management tools**

### Security Features
- **File validation** and sanitization
- **Image processing** with size optimization
- **VPN detection** for report submissions
- **Audit logging** for all admin actions
- **Role hierarchy enforcement**

### Database Management
- **MariaDB integration** for reliable storage
- **CSV export functionality** for reports
- **Database statistics** and monitoring
- **Automated backup support**

##  Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dingocoin-scam-report-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up MariaDB database**
   ```bash
   # Create database and user in MariaDB
   # Copy env.example to .env and configure
   npm run setup
   ```

4. **Configure Discord bot**
   ```bash
   # Add bot token and IDs to .env
   node src/deploy-commands.js
   ```

5. **Start the bot**
   ```bash
   npm start
   ```

**For detailed setup instructions:**
- **Ubuntu 24.04**: See [UBUNTU-24.04-SETUP.md](UBUNTU-24.04-SETUP.md)
- **General setup**: See [SETUP_GUIDE.md](SETUP_GUIDE.md)

## 📋 Commands

### User Commands
- `/report` - Submit a scam report with evidence

### Moderator Commands (Guardian Role+)
- `/viewreports` - View and filter reports
- `/timeout` - Timeout a user

### Admin Commands
- `/kick` - Kick a user
- `/ban` - Ban a user  
- `/addadmin` - Add admin role to user
- `/settings` - View bot configuration
- `/clearreport` - Delete reports
- `/exportdb` - Export database to CSV

## Requirements

- **Node.js** v20.0.0+ (Latest LTS)
- **MariaDB** v11.4+ (Latest stable)
- **Ubuntu** 24.04 LTS (Recommended)
- **Discord Bot Token**
- **Server Admin Permissions**

## Project Structure

```
dingocoin-scam-report-bot/
├── src/
│   ├── commands/          # Slash commands
│   │   ├── user/         # User commands
│   │   ├── mod/          # Moderator commands
│   │   └── admin/        # Admin commands
│   ├── config/           # Configuration files
│   ├── events/           # Discord event handlers
│   ├── utils/            # Utility functions
│   └── setup/            # Setup scripts
├── uploads/              # Processed images
├── exports/              # CSV exports
└── docs/                 # Documentation
```

## Configuration

Key environment variables:

```env
# Discord
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_guild_id

# Database
DB_HOST=localhost
DB_USER=scambot
DB_PASSWORD=your_password
DB_NAME=scam_reports

# Roles
VERIFIED_ROLE_ID=role_id
GUARDIAN_ROLE_ID=role_id
ADMIN_ROLE_ID=role_id

# Security (Optional)
VIRUS_TOTAL_API_KEY=api_key
VPN_DETECTION_ENABLED=true
LOG_CHANNEL_ID=channel_id
```

##  Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request


##  Support

- Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions
- Review console logs for error messages
- Verify Discord permissions and role hierarchy
- Test database connection with `npm run setup`

---

** Important:** This bot handles sensitive data. Ensure proper security measures and comply with privacy regulations in your jurisdiction.
Dingocoin Bot for Reporting Scams
