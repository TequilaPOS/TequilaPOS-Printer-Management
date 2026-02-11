# 🖨️ Printer Management System - Installation Guide

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Installation with Docker (Recommended)](#installation-with-docker)
3. [Manual Installation](#manual-installation)
4. [SSL/HTTPS Configuration](#ssl-configuration)
5. [Firewall Configuration](#firewall-configuration)
6. [Backup and Restore](#backup-and-restore)
7. [Troubleshooting](#troubleshooting)
8. [DHCP Server Configuration](#dhcp-server-configuration)

---

## System Requirements

### Minimum Hardware
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB | 50 GB |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements
| Software | Version |
|----------|---------|
| Operating System | Ubuntu 22.04 LTS / Debian 12 |
| Docker | 24.0+ (for Docker installation) |
| Node.js | 18.x LTS (for manual installation) |
| MySQL | 8.0+ |
| CUPS | 2.4+ |
| Nginx | 1.18+ |

---

## Installation with Docker

### Step 1: Install Docker and Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### Step 2: Clone and Configure the Project

```bash
# Create application directory
sudo mkdir -p /opt/printer-management
cd /opt/printer-management

# Clone or copy project files
# Option A: From Git
git clone https://github.com/your-repo/printer-management.git .

# Option B: Copy from local
# scp -r /path/to/printer_management/* user@server:/opt/printer-management/

# Set permissions
sudo chown -R $USER:$USER /opt/printer-management
```

### Step 3: Configure Environment Variables

```bash
# Create production environment file
cat > .env << 'EOF'
# ===========================================
# Production Environment Configuration
# ===========================================

# MySQL Database
MYSQL_ROOT_PASSWORD=YourSecureRootPassword123!
MYSQL_DATABASE=printer_management
MYSQL_USER=printer_admin
MYSQL_PASSWORD=YourSecurePassword123!

# Backend
NODE_ENV=production
JWT_SECRET=your-very-long-and-secure-jwt-secret-key-change-this
JWT_EXPIRES_IN=24h
PORT=3000

# Backend Driver Pack:
# - lite (default, ~500MB): HP, Kyocera, Epson, Brother (IPP Everywhere)
# - common (~1.5GB): + Canon, Ricoh, Lexmark, Samsung drivers
# - full (~3GB): All CUPS drivers for legacy printers
DRIVER_SET=lite

# Frontend
VITE_API_URL=/api

# Timezone
TZ=America/Bogota
EOF

# Secure the file
chmod 600 .env
```

> **Note about DRIVER_SET:** Start with `lite` - it works with 90% of modern network printers. 
> Only change to `common` or `full` if specific printers don't work.

### Step 4: Build and Start Containers

```bash
# Build images
docker compose build

# Start services in detached mode
docker compose up -d

# Verify containers are running
docker compose ps

# Check logs
docker compose logs -f
```

### Step 5: Verify Installation

```bash
# Test backend health
curl http://localhost:3000/api/system/health

# Test frontend
curl -I http://localhost:80

# Check CUPS
docker exec printer-backend lpstat -r
```

### Step 6: Initial Setup

1. Open browser: `http://YOUR_SERVER_IP`
2. Login with default credentials:
   - **Username:** `admin`
   - **Password:** `admin123`
3. **IMPORTANT:** Change the admin password immediately in Settings

### Docker Management Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Update and rebuild
git pull
docker compose build
docker compose up -d

# Backup database
docker exec printer-mysql mysqldump -u root -p'YourRootPassword' printer_management > backup.sql

# Access MySQL shell
docker exec -it printer-mysql mysql -u printer_admin -p printer_management

# Access backend shell
docker exec -it printer-backend /bin/bash
```

---

## Manual Installation

### Step 1: System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release
```

### Step 2: Install Node.js 18 LTS

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version
```

### Step 3: Install MySQL 8

```bash
# Install MySQL Server
sudo apt install -y mysql-server

# Secure MySQL installation
sudo mysql_secure_installation
# Answer: Y, set root password, Y, Y, Y, Y

# Start and enable MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Create database and user
sudo mysql -u root -p << 'EOF'
CREATE DATABASE printer_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'printer_admin'@'localhost' IDENTIFIED BY 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON printer_management.* TO 'printer_admin'@'localhost';
FLUSH PRIVILEGES;
EOF

# Import initial schema
mysql -u printer_admin -p'YourSecurePassword123!' printer_management < /opt/printer-management/init.sql
```

### Step 4: Install and Configure CUPS

```bash
# Install CUPS and related packages
sudo apt install -y \
    cups \
    cups-bsd \
    cups-client \
    cups-filters \
    ghostscript \
    poppler-utils \
    avahi-daemon \
    avahi-utils \
    libnss-mdns \
    snmp

# Optional: Install additional drivers
# For common printers (Brother, Epson, Samsung):
sudo apt install -y \
    printer-driver-brlaser \
    printer-driver-escpr \
    printer-driver-splix

# For HP printers (large package):
# sudo apt install -y hplip

# Enable and start CUPS
sudo systemctl enable cups
sudo systemctl start cups

# Configure CUPS for network access
sudo cupsctl --remote-any --share-printers

# Add www-data user to lpadmin group (for printer management)
sudo usermod -aG lpadmin www-data

# Edit CUPS configuration
sudo nano /etc/cups/cupsd.conf
```

**CUPS Configuration (/etc/cups/cupsd.conf):**
```apache
# Listen on all interfaces
Listen *:631
Listen /run/cups/cups.sock

# Allow remote administration
<Location />
  Order allow,deny
  Allow @LOCAL
  Allow from 192.168.0.0/16
  Allow from 172.16.0.0/12
  Allow from 10.0.0.0/8
</Location>

<Location /admin>
  Order allow,deny
  Allow @LOCAL
</Location>

<Location /admin/conf>
  AuthType Default
  Require user @SYSTEM
  Order allow,deny
  Allow @LOCAL
</Location>

# Web interface
WebInterface Yes
```

```bash
# Restart CUPS
sudo systemctl restart cups

# Verify CUPS is running
sudo systemctl status cups
lpstat -r

# Test CUPS web interface
curl -I http://localhost:631
```

### Step 5: Install Backend

```bash
# Create application directories
sudo mkdir -p /var/www/printer-management/backend
sudo mkdir -p /var/www/printer-management/frontend
sudo mkdir -p /var/log/printer-management

# Copy backend files
sudo cp -r /opt/printer-management/backend/* /var/www/printer-management/backend/

# Set ownership
sudo chown -R www-data:www-data /var/www/printer-management
sudo chown -R www-data:www-data /var/log/printer-management

# Navigate to backend directory
cd /var/www/printer-management/backend

# Install dependencies
sudo -u www-data npm ci --production

# Create environment file
sudo -u www-data cat > .env << 'EOF'
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=printer_management
DB_USER=printer_admin
DB_PASSWORD=YourSecurePassword123!

# JWT
JWT_SECRET=your-very-long-and-secure-jwt-secret-key-minimum-32-characters
JWT_EXPIRES_IN=24h

# Timezone
TZ=America/Bogota
EOF

# Secure environment file
sudo chmod 600 .env
sudo chown www-data:www-data .env

# Test backend manually
sudo -u www-data node src/index.js
# Press Ctrl+C after verifying it starts
```

### Step 6: Create Backend Systemd Service

```bash
# Create systemd service file
sudo cat > /etc/systemd/system/printer-backend.service << 'EOF'
[Unit]
Description=Printer Management Backend API
Documentation=https://github.com/your-repo/printer-management
After=network.target mysql.service cups.service
Wants=mysql.service cups.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/printer-management/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/printer-management/backend.log
StandardError=append:/var/log/printer-management/backend-error.log

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/printer-management/backend
ReadWritePaths=/var/log/printer-management
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable printer-backend
sudo systemctl start printer-backend

# Check status
sudo systemctl status printer-backend

# View logs
sudo journalctl -u printer-backend -f
```

### Step 7: Build and Install Frontend

```bash
# Navigate to frontend source
cd /opt/printer-management/frontend

# Install dependencies
npm ci

# Build for production
VITE_API_URL=/api npm run build

# Copy built files
sudo cp -r dist/* /var/www/printer-management/frontend/

# Set permissions
sudo chown -R www-data:www-data /var/www/printer-management/frontend
```

### Step 8: Install and Configure Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Create site configuration
sudo cat > /etc/nginx/sites-available/printer-management << 'EOF'
# Printer Management System - Nginx Configuration
# HTTP to HTTPS redirect (uncomment after SSL setup)
# server {
#     listen 80;
#     server_name your-domain.com;
#     return 301 https://$server_name$request_uri;
# }

server {
    listen 80;
    # listen 443 ssl http2;  # Uncomment after SSL setup
    server_name _;  # Replace with your domain

    # SSL Configuration (uncomment after obtaining certificates)
    # ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    # ssl_prefer_server_ciphers off;

    # Frontend root
    root /var/www/printer-management/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;
    gzip_comp_level 6;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }

    # Logging
    access_log /var/log/nginx/printer-management-access.log;
    error_log /var/log/nginx/printer-management-error.log;
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/printer-management /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 9: Create Log Rotation

```bash
# Create logrotate configuration
sudo cat > /etc/logrotate.d/printer-management << 'EOF'
/var/log/printer-management/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload printer-backend > /dev/null 2>&1 || true
    endscript
}
EOF
```

---

## SSL Configuration

### Option A: Let's Encrypt (Free SSL)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Certificates are stored at:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### Option B: Self-Signed Certificate (Internal Use)

```bash
# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/printer-management.key \
    -out /etc/nginx/ssl/printer-management.crt \
    -subj "/C=CO/ST=State/L=City/O=Organization/CN=printer-management.local"

# Set permissions
sudo chmod 600 /etc/nginx/ssl/printer-management.key
sudo chmod 644 /etc/nginx/ssl/printer-management.crt

# Update Nginx configuration to use these certificates
# ssl_certificate /etc/nginx/ssl/printer-management.crt;
# ssl_certificate_key /etc/nginx/ssl/printer-management.key;
```

---

## Firewall Configuration

### Using UFW (Recommended for Ubuntu)

```bash
# Install UFW if not present
sudo apt install -y ufw

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow CUPS (for local printer management)
sudo ufw allow 631/tcp comment 'CUPS Web Interface'

# Allow IPP for printers
sudo ufw allow 631/udp comment 'IPP Discovery'

# Allow mDNS/Avahi for printer discovery
sudo ufw allow 5353/udp comment 'mDNS/Avahi'

# Allow SNMP for printer monitoring (optional, restrict to local network)
sudo ufw allow from 192.168.0.0/16 to any port 161 proto udp comment 'SNMP'
sudo ufw allow from 172.16.0.0/12 to any port 161 proto udp comment 'SNMP'
sudo ufw allow from 10.0.0.0/8 to any port 161 proto udp comment 'SNMP'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose

# Show numbered rules
sudo ufw status numbered
```

### Using iptables (Alternative)

```bash
# Flush existing rules
sudo iptables -F

# Set default policies
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow CUPS
sudo iptables -A INPUT -p tcp --dport 631 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 631 -j ACCEPT

# Allow mDNS
sudo iptables -A INPUT -p udp --dport 5353 -j ACCEPT

# Allow SNMP from local networks
sudo iptables -A INPUT -p udp --dport 161 -s 192.168.0.0/16 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 161 -s 172.16.0.0/12 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 161 -s 10.0.0.0/8 -j ACCEPT

# Save rules (Ubuntu/Debian)
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## Backup and Restore

### Automated Backup Script

```bash
# Create backup script
sudo cat > /opt/printer-management/backup.sh << 'EOF'
#!/bin/bash
# Printer Management System - Backup Script

BACKUP_DIR="/var/backups/printer-management"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u printer_admin -p'YourSecurePassword123!' printer_management | gzip > $BACKUP_DIR/database_$DATE.sql.gz

# Backup configuration files
tar -czf $BACKUP_DIR/config_$DATE.tar.gz \
    /var/www/printer-management/backend/.env \
    /etc/nginx/sites-available/printer-management \
    /etc/cups/cupsd.conf \
    /etc/cups/printers.conf \
    2>/dev/null

# Remove old backups
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
EOF

# Make executable
sudo chmod +x /opt/printer-management/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/printer-management/backup.sh >> /var/log/printer-management/backup.log 2>&1") | crontab -
```

### Restore from Backup

```bash
# Restore database
gunzip < /var/backups/printer-management/database_YYYYMMDD_HHMMSS.sql.gz | mysql -u printer_admin -p printer_management

# Restore configuration
sudo tar -xzf /var/backups/printer-management/config_YYYYMMDD_HHMMSS.tar.gz -C /

# Restart services
sudo systemctl restart printer-backend
sudo systemctl restart nginx
sudo systemctl restart cups
```

---

## Troubleshooting

### Common Issues

#### Backend won't start
```bash
# Check logs
sudo journalctl -u printer-backend -n 50

# Check if port is in use
sudo lsof -i :3000

# Verify database connection
mysql -u printer_admin -p -e "SELECT 1" printer_management

# Check Node.js version
node --version
```

#### CUPS issues
```bash
# Check CUPS status
sudo systemctl status cups

# View CUPS error log
sudo tail -100 /var/log/cups/error_log

# List printers
lpstat -p -d

# Restart CUPS
sudo systemctl restart cups
```

#### Nginx 502 Bad Gateway
```bash
# Check if backend is running
sudo systemctl status printer-backend

# Check Nginx error log
sudo tail -100 /var/log/nginx/printer-management-error.log

# Test backend directly
curl http://localhost:3000/api/system/health
```

#### Permission issues
```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/printer-management

# Fix log permissions
sudo chown -R www-data:www-data /var/log/printer-management
```

---

## DHCP Server Configuration

This section covers setting up and managing a DHCP server for automatic IP assignment to printers.

### Step 1: Install ISC DHCP Server

```bash
# Install DHCP server
sudo apt install -y isc-dhcp-server

# Check installation
dhcpd --version
```

### Step 2: Configure Network Interface

```bash
# Identify network interface
ip link show
# Common names: eth0, ens18, ens192, enp0s3

# Edit DHCP server defaults
sudo nano /etc/default/isc-dhcp-server
```

**/etc/default/isc-dhcp-server:**
```bash
# Specify the interfaces DHCP should listen on
INTERFACESv4="eth0"  # Replace with your interface name
INTERFACESv6=""
```

### Step 3: Configure DHCP Server

```bash
# Backup original configuration
sudo cp /etc/dhcp/dhcpd.conf /etc/dhcp/dhcpd.conf.backup

# Create new configuration
sudo nano /etc/dhcp/dhcpd.conf
```

**/etc/dhcp/dhcpd.conf:**
```bash
# ===========================================
# ISC DHCP Server Configuration
# ===========================================

# Global options
option domain-name "local.network";
option domain-name-servers 8.8.8.8, 8.8.4.4;  # Or your DNS servers

# Default lease time (seconds)
default-lease-time 86400;      # 24 hours
max-lease-time 604800;         # 7 days

# Use this to enable/disable dynamic DNS updates globally
ddns-update-style none;

# This server is authoritative for the local network
authoritative;

# Logging
log-facility local7;

# ===========================================
# Network Subnet Configuration
# ===========================================
subnet 192.168.1.0 netmask 255.255.255.0 {
    # IP range for dynamic assignment
    range 192.168.1.100 192.168.1.200;
    
    # Gateway
    option routers 192.168.1.1;
    
    # DNS servers
    option domain-name-servers 192.168.1.1, 8.8.8.8;
    
    # Broadcast address
    option broadcast-address 192.168.1.255;
    
    # Lease times for this subnet
    default-lease-time 43200;  # 12 hours
    max-lease-time 86400;      # 24 hours
}

# ===========================================
# Printer IP Reservations (Static DHCP)
# ===========================================
# Use MAC address to always assign the same IP

# HP LaserJet M402n - Floor 1
host printer-hp-m402n-f1 {
    hardware ethernet 00:1E:0B:XX:XX:XX;  # Replace with actual MAC
    fixed-address 192.168.1.10;
    option host-name "HP_LaserJet_M402n_F1";
}

# Kyocera ECOSYS M2640idw - Floor 1
host printer-kyocera-m2640-f1 {
    hardware ethernet 00:C0:EE:XX:XX:XX;  # Replace with actual MAC
    fixed-address 192.168.1.11;
    option host-name "ECOSYS_M2640idw_F1";
}

# HP Color LaserJet Pro - Floor 2
host printer-hp-color-f2 {
    hardware ethernet 00:1E:0B:YY:YY:YY;  # Replace with actual MAC
    fixed-address 192.168.1.20;
    option host-name "HP_Color_LaserJet_F2";
}

# Brother Printer - Reception
host printer-brother-reception {
    hardware ethernet 00:80:77:ZZ:ZZ:ZZ;  # Replace with actual MAC
    fixed-address 192.168.1.30;
    option host-name "Brother_Reception";
}

# ===========================================
# VLAN/Subnet for Printers Only (Optional)
# ===========================================
# Separate network for printers
#subnet 192.168.10.0 netmask 255.255.255.0 {
#    range 192.168.10.50 192.168.10.150;
#    option routers 192.168.10.1;
#    option domain-name-servers 192.168.1.1;
#    option broadcast-address 192.168.10.255;
#    default-lease-time 604800;  # 7 days for printers
#}
```

### Step 4: Start DHCP Service

```bash
# Validate configuration
sudo dhcpd -t -cf /etc/dhcp/dhcpd.conf

# Enable service to start on boot
sudo systemctl enable isc-dhcp-server

# Start the service
sudo systemctl start isc-dhcp-server

# Check status
sudo systemctl status isc-dhcp-server

# View logs
sudo journalctl -u isc-dhcp-server -f
```

### Step 5: Firewall Configuration for DHCP

```bash
# Allow DHCP ports (server)
sudo ufw allow 67/udp comment 'DHCP Server'
sudo ufw allow 68/udp comment 'DHCP Client'

# Reload firewall
sudo ufw reload
```

### DHCP Management Commands

#### View Active Leases
```bash
# View all current leases
sudo cat /var/lib/dhcp/dhcpd.leases

# Parse and display active leases in readable format
sudo dhcp-lease-list

# Or use awk to extract important info
sudo awk '/lease/{ip=$2} /hardware ethernet/{mac=$3} /client-hostname/{print ip, mac, $2}' /var/lib/dhcp/dhcpd.leases
```

#### Add a New Printer Reservation

```bash
# Edit configuration
sudo nano /etc/dhcp/dhcpd.conf

# Add new host entry:
# host printer-new-device {
#     hardware ethernet AA:BB:CC:DD:EE:FF;
#     fixed-address 192.168.1.XX;
#     option host-name "New_Printer_Name";
# }

# Validate configuration
sudo dhcpd -t -cf /etc/dhcp/dhcpd.conf

# Restart service to apply changes
sudo systemctl restart isc-dhcp-server
```

#### Change an Existing Reservation

```bash
# 1. Edit configuration file
sudo nano /etc/dhcp/dhcpd.conf

# 2. Find the host entry and modify:
#    - Change fixed-address for new IP
#    - Change hardware ethernet for new MAC
#    - Change host-name if needed

# 3. Validate
sudo dhcpd -t -cf /etc/dhcp/dhcpd.conf

# 4. Restart service
sudo systemctl restart isc-dhcp-server

# 5. Force release on client (if needed)
# On the printer, disconnect and reconnect network
# Or restart the printer
```

#### Remove a Reservation

```bash
# Edit configuration
sudo nano /etc/dhcp/dhcpd.conf

# Delete or comment out the host block:
# #host printer-old {
# #    hardware ethernet XX:XX:XX:XX:XX:XX;
# #    fixed-address 192.168.1.XX;
# #}

# Restart service
sudo systemctl restart isc-dhcp-server
```

#### Release/Clear a Lease Manually

```bash
# Stop DHCP server
sudo systemctl stop isc-dhcp-server

# Clear all leases (caution!)
sudo rm /var/lib/dhcp/dhcpd.leases
sudo touch /var/lib/dhcp/dhcpd.leases

# Start DHCP server
sudo systemctl start isc-dhcp-server
```

### DHCP Service Management

```bash
# Start DHCP server
sudo systemctl start isc-dhcp-server

# Stop DHCP server
sudo systemctl stop isc-dhcp-server

# Restart DHCP server
sudo systemctl restart isc-dhcp-server

# Reload configuration without full restart
sudo systemctl reload isc-dhcp-server

# Check service status
sudo systemctl status isc-dhcp-server

# Enable on boot
sudo systemctl enable isc-dhcp-server

# Disable on boot
sudo systemctl disable isc-dhcp-server

# View logs
sudo journalctl -u isc-dhcp-server -f

# View last 100 log entries
sudo journalctl -u isc-dhcp-server -n 100
```

### Finding Printer MAC Addresses

```bash
# Method 1: From printer display/settings
# Most printers show MAC in Network Settings menu

# Method 2: ARP scan (requires nmap)
sudo apt install -y nmap
sudo nmap -sn 192.168.1.0/24

# Method 3: Check ARP table after printer connects
arp -a | grep -i "printer-ip"

# Method 4: From DHCP leases (if printer already got IP)
grep -A 5 "192.168.1.XX" /var/lib/dhcp/dhcpd.leases

# Method 5: Network scan with arp-scan
sudo apt install -y arp-scan
sudo arp-scan --localnet
```

### DHCP Best Practices for Printers

1. **Always use reservations for printers** - Printers should have static IPs via DHCP reservations
2. **Document all reservations** - Keep a spreadsheet or database of printer MACs and IPs
3. **Use descriptive hostnames** - Include location and model in the hostname
4. **Set longer lease times for printers** - 7 days minimum, or even infinite
5. **Separate VLAN** - Consider putting printers on their own VLAN/subnet
6. **Backup DHCP config** - Include dhcpd.conf in your backup routine

### Complete Printer Registration Script

```bash
#!/bin/bash
# add-printer-dhcp.sh - Add printer reservation to DHCP

read -p "Printer name (e.g., HP_LaserJet_F1): " PRINTER_NAME
read -p "MAC address (e.g., 00:1E:0B:AA:BB:CC): " MAC_ADDRESS
read -p "IP address (e.g., 192.168.1.50): " IP_ADDRESS

# Convert name to valid hostname
HOST_NAME=$(echo "$PRINTER_NAME" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')

# Add to dhcpd.conf
sudo cat >> /etc/dhcp/dhcpd.conf << EOF

# $PRINTER_NAME - Added $(date)
host $HOST_NAME {
    hardware ethernet $MAC_ADDRESS;
    fixed-address $IP_ADDRESS;
    option host-name "$PRINTER_NAME";
}
EOF

# Validate and restart
if sudo dhcpd -t -cf /etc/dhcp/dhcpd.conf; then
    sudo systemctl restart isc-dhcp-server
    echo "✅ Printer '$PRINTER_NAME' registered with IP $IP_ADDRESS"
else
    echo "❌ Configuration error. Please check dhcpd.conf"
fi
```

Save as `/opt/printer-management/add-printer-dhcp.sh` and make executable:
```bash
sudo chmod +x /opt/printer-management/add-printer-dhcp.sh
```

---

## Quick Reference Card

### Service Commands
| Service | Start | Stop | Restart | Status |
|---------|-------|------|---------|--------|
| Backend | `systemctl start printer-backend` | `systemctl stop printer-backend` | `systemctl restart printer-backend` | `systemctl status printer-backend` |
| Nginx | `systemctl start nginx` | `systemctl stop nginx` | `systemctl restart nginx` | `systemctl status nginx` |
| CUPS | `systemctl start cups` | `systemctl stop cups` | `systemctl restart cups` | `systemctl status cups` |
| MySQL | `systemctl start mysql` | `systemctl stop mysql` | `systemctl restart mysql` | `systemctl status mysql` |
| DHCP | `systemctl start isc-dhcp-server` | `systemctl stop isc-dhcp-server` | `systemctl restart isc-dhcp-server` | `systemctl status isc-dhcp-server` |

### Important Paths
| Item | Path |
|------|------|
| Backend | `/var/www/printer-management/backend` |
| Frontend | `/var/www/printer-management/frontend` |
| Backend logs | `/var/log/printer-management/` |
| Nginx config | `/etc/nginx/sites-available/printer-management` |
| CUPS config | `/etc/cups/cupsd.conf` |
| DHCP config | `/etc/dhcp/dhcpd.conf` |
| DHCP leases | `/var/lib/dhcp/dhcpd.leases` |
| Backups | `/var/backups/printer-management/` |

### Default Ports
| Service | Port | Protocol |
|---------|------|----------|
| HTTP | 80 | TCP |
| HTTPS | 443 | TCP |
| Backend API | 3000 | TCP |
| MySQL | 3306 | TCP |
| CUPS | 631 | TCP/UDP |
| DHCP Server | 67 | UDP |
| DHCP Client | 68 | UDP |
| mDNS | 5353 | UDP |
| SNMP | 161 | UDP |

---

## Support

For issues or questions:
- Check logs first: `journalctl -u printer-backend -n 100`
- Review this guide's troubleshooting section
- Ensure all services are running: `systemctl status printer-backend nginx cups mysql`

---

*Document Version: 1.0*  
*Last Updated: February 2026*  
*Printer Management System by Saloaun*
