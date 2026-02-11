# 🖨️ Printer Server Manager - Installation Guide

Complete step-by-step guide to deploy the Printer Management System on a clean server.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Requirements](#server-requirements)
3. [Quick Installation](#quick-installation)
4. [Manual Installation](#manual-installation)
5. [Configuration](#configuration)
6. [SSL Certificates](#ssl-certificates)
7. [First Login](#first-login)
8. [Adding Printers](#adding-printers)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Docker | 20.10+ | Container runtime |
| Docker Compose | 2.0+ | Container orchestration |
| Git | 2.0+ | Clone repository |

### Check Installation

```bash
# Check Docker
docker --version
# Docker version 24.0.0 or higher

# Check Docker Compose
docker compose version
# Docker Compose version v2.20.0 or higher

# Check Git
git --version
```

### Install Docker (if not installed)

**Ubuntu/Debian:**
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (logout/login required)
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y
```

**macOS:**
```bash
# Install Docker Desktop from https://docker.com/products/docker-desktop
# Or using Homebrew:
brew install --cask docker
```

**Windows:**
- Download and install [Docker Desktop](https://docker.com/products/docker-desktop)
- Enable WSL2 backend

---

## Server Requirements

### Minimum Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB | 50 GB |
| Network | 100 Mbps | 1 Gbps |

### Network Requirements

| Port | Service | Description |
|------|---------|-------------|
| 80 | HTTP | Redirects to HTTPS |
| 443 | HTTPS | Main web interface |
| 631 | CUPS | Print server (internal) |
| 3000 | API | Backend (internal) |
| 3306 | MySQL | Database (internal) |

### Firewall Configuration

```bash
# Ubuntu/Debian with UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# CentOS/RHEL with firewalld
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

---

## Quick Installation

### One-Command Installation

```bash
# Clone and start
git clone https://github.com/saun1790/Printer-Server-Manager.git
cd Printer-Server-Manager
docker compose up -d

# Wait for all services to be healthy (2-3 minutes)
docker compose ps
```

That's it! Access the system at: `https://your-server-ip`

---

## Manual Installation

### Step 1: Clone Repository

```bash
cd /opt  # or your preferred directory
git clone https://github.com/saun1790/Printer-Server-Manager.git
cd Printer-Server-Manager
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

**Important `.env` variables:**

```env
# Database - CHANGE THESE IN PRODUCTION!
MYSQL_ROOT_PASSWORD=YourSecureRootPassword123!
MYSQL_DATABASE=printer_management
MYSQL_USER=printer_admin
MYSQL_PASSWORD=YourSecurePassword123!

# JWT Secret - CHANGE THIS!
JWT_SECRET=YourSuperSecretJWTKey2024!
JWT_REFRESH_SECRET=YourRefreshTokenSecret2024!

# URLs
FRONTEND_URL=https://your-domain.com

# Driver pack: lite (default), common, or full
DRIVER_SET=lite

# Timezone
TZ=America/Bogota
```

### Step 3: Build and Start

```bash
# Build all containers
docker compose build

# Start in detached mode
docker compose up -d

# Check status
docker compose ps
```

Expected output:
```
NAME                STATUS              PORTS
printer-mysql       running (healthy)   3306/tcp
printer-backend     running (healthy)   3000/tcp, 631/tcp
printer-frontend    running             80/tcp
printer-nginx       running             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### Step 4: Verify Installation

```bash
# Check all containers are healthy
docker compose ps

# Check logs for errors
docker compose logs --tail=50

# Test API health endpoint
curl -k https://localhost/api/system/health
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | - | MySQL root password |
| `MYSQL_DATABASE` | printer_management | Database name |
| `MYSQL_USER` | printer_admin | Database user |
| `MYSQL_PASSWORD` | - | Database password |
| `JWT_SECRET` | - | JWT signing key |
| `JWT_EXPIRY` | 7d | Token expiration |
| `FRONTEND_URL` | https://localhost | Frontend URL for CORS |
| `DRIVER_SET` | lite | Printer driver pack (see below) |
| `TZ` | America/Bogota | Timezone for logs/dates |

### Driver Packs (DRIVER_SET)

The `DRIVER_SET` variable controls which printer drivers are installed in the backend container:

| Value | Size | Printers Supported | Use Case |
|-------|------|-------------------|----------|
| `lite` | ~500MB | HP, Kyocera, Epson, Brother (IPP) | Most network printers with IPP Everywhere |
| `common` | ~1.5GB | + Canon, Ricoh, Lexmark, Samsung | Older printers needing specific drivers |
| `full` | ~3GB | + All CUPS drivers | Legacy printers, special models |

**Recommendation:**
- Start with `lite` (default) - works with 90% of modern printers
- Use `common` if you have Canon/Ricoh printers
- Use `full` only if specific printers don't work

To change driver pack:
```bash
# Edit .env
DRIVER_SET=common

# Rebuild backend
docker compose build backend
docker compose up -d backend
```

### Docker Compose Override

Create `docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'
services:
  backend:
    environment:
      - LOG_LEVEL=debug
  nginx:
    ports:
      - "8080:80"
      - "8443:443"
```

---

## SSL Certificates

### Self-Signed (Development)

SSL certificates are **automatically generated** on first startup. For development, accept the browser security warning.

### Let's Encrypt (Production)

```bash
# Install certbot
sudo apt install certbot -y

# Stop nginx temporarily
docker compose stop nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./nginx/certs/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./nginx/certs/server.key

# Restart nginx
docker compose up -d nginx
```

### Custom Certificates

Place your certificates in:
- `./nginx/certs/server.crt` - Certificate file
- `./nginx/certs/server.key` - Private key

---

## First Login

### Default Credentials

| Field | Value |
|-------|-------|
| URL | `https://your-server-ip` |
| Email/Username | `admin` |
| Password | `admin123` |

⚠️ **IMPORTANT:** Change the default password immediately after first login!

### Change Password

1. Login with default credentials
2. Go to **Settings** or click on your profile
3. Select **Change Password**
4. Enter new secure password

---

## Adding Printers

### Method 1: Auto Discovery (Recommended)

1. Go to **Admin → Discovery**
2. Enter IP range (e.g., `192.168.1.1-192.168.1.254`)
3. Click **Start Scan**
4. Select discovered printers
5. Click **Add Selected**

### Method 2: Manual Add

1. Go to **Dashboard**
2. Click **+ Add Printer**
3. Fill in:
   - Name: `Office Printer 1`
   - IP Address: `192.168.1.100`
   - Protocol: `IPP` (recommended)
4. Click **Detect** to auto-detect model
5. Click **Save**

### Supported Protocols

| Protocol | Port | Best For |
|----------|------|----------|
| IPP | 631 | Modern printers (recommended) |
| Socket | 9100 | Raw printing |
| LPD | 515 | Legacy printers |

---

## Maintenance

### Daily Operations

```bash
# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Restart a service
docker compose restart backend
```

### Backup

```bash
# Backup database
docker exec printer-mysql mysqldump -u root -p printer_management > backup_$(date +%Y%m%d).sql

# Backup CUPS configuration
docker cp printer-backend:/etc/cups ./cups_backup_$(date +%Y%m%d)
```

### Restore

```bash
# Restore database
cat backup_20260209.sql | docker exec -i printer-mysql mysql -u root -p printer_management

# Restore CUPS
docker cp ./cups_backup_20260209/. printer-backend:/etc/cups/
docker compose restart backend
```

### Update

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose build
docker compose up -d

# Check status
docker compose ps
```

### Cleanup

```bash
# Remove unused images
docker image prune -f

# Remove unused volumes (⚠️ careful - removes data)
docker volume prune -f

# Full cleanup (keeps data volumes)
docker compose down
docker compose up -d
```

---

## Troubleshooting

### Common Issues

#### Container won't start

```bash
# Check logs
docker compose logs backend

# Check if port is in use
sudo lsof -i :443
sudo lsof -i :80

# Restart all
docker compose down
docker compose up -d
```

#### Database connection error

```bash
# Check MySQL is running
docker compose ps printer-mysql

# Check MySQL logs
docker compose logs printer-mysql

# Verify credentials in .env match docker-compose.yml
```

#### Printers not detected

```bash
# Check network connectivity from container
docker exec printer-backend ping 192.168.1.100

# Check SNMP is working
docker exec printer-backend snmpwalk -v1 -c public 192.168.1.100 system

# Verify firewall allows SNMP (UDP 161)
```

#### SSL Certificate errors

```bash
# Regenerate certificates
rm -rf ./nginx/certs/*
docker compose restart nginx

# Check certificate
openssl s_client -connect localhost:443 -servername localhost
```

#### Permission denied errors

```bash
# Fix Docker socket permissions
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
# Logout and login again
```

### Logs Location

| Service | Log Command |
|---------|-------------|
| All | `docker compose logs` |
| Backend | `docker compose logs backend` |
| Frontend | `docker compose logs frontend` |
| Database | `docker compose logs mysql` |
| NGINX | `docker compose logs nginx` |

### Health Checks

```bash
# API Health
curl -k https://localhost/api/system/health

# CUPS Status
docker exec printer-backend lpstat -t

# Database Status
docker exec printer-mysql mysqladmin -u root -p ping
```

### Reset Everything

⚠️ **WARNING: This deletes all data!**

```bash
# Stop and remove everything
docker compose down -v

# Remove all images
docker compose down --rmi all

# Fresh start
docker compose up -d
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Port 443/80)                      │
│                  SSL Termination + Proxy                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Frontend   │   │   Backend   │   │    MySQL    │
│   (React)   │   │  (Node.js)  │   │  Database   │
│  Port 80    │   │  Port 3000  │   │  Port 3306  │
└─────────────┘   │  + CUPS 631 │   └─────────────┘
                  └─────────────┘
```

### Data Persistence

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| mysql_data | /var/lib/mysql | Database files |
| cups_data | /etc/cups | CUPS configuration |
| cups_spool | /var/spool/cups | Print queue |

---

## Support

### Resources

- **GitHub Issues:** [Report bugs](https://github.com/saun1790/Printer-Server-Manager/issues)
- **Documentation:** `/documentation` page in the app

### Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

**Version:** 1.0.0  
**Last Updated:** February 2026
