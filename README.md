# 🖨️ Printer Management System

Complete printer management system with CUPS support, ESC/POS thermal printers, real-time WebSockets, and modern web dashboard.

## ✨ Features

- **Printer Management**: Add, configure, and monitor printers via CUPS
- **Direct Print**: Support for thermal printers (EPSON, STAR, etc.) via TCP/IP
- **WebSockets**: Real-time updates for printer status and jobs
- **Dashboard**: Modern interface with React, Tailwind CSS, and Radix UI components
- **Notifications**: Email alerts and browser push notifications
- **Reports**: Usage statistics and report generation
- **Multi-user**: Role-based system (admin, operator, viewer)
- **Docker**: Easy deployment with Docker Compose

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│   Nginx Proxy   │────▶│   Node.js API   │
│   (Frontend)    │     │   (SSL/HTTPS)   │     │   (Backend)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
              ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
              │   MySQL DB      │            │   CUPS Server   │            │  Thermal        │
              │   (Persistence) │            │   (Print Queue) │            │  Printers       │
              └─────────────────┘            └─────────────────┘            │  (TCP/9100)     │
                                                                            └─────────────────┘
```

## 📋 Requirements

- Docker & Docker Compose
- CUPS installed on host (for queue management)
- Node.js 18+ (for local development)

## 🚀 Quick Start

### 1. Clone and configure

```bash
cd printer_management
cp .env.example .env
# Edit .env with your values
```

### 2. Generate SSL certificates (development)

```bash
./scripts/generate-ssl.sh
```

### 3. Start with Docker

```bash
docker-compose up -d
```

### 4. Access

- **Dashboard**: https://localhost
- **API**: https://localhost/api
- **Health**: https://localhost/api/system/health

### Default credentials

- **Admin**: admin / admin123
- **Operator**: operator@example.com / operator123

## 🖨️ Supported Printers

### Via CUPS (IPP/driverless)
- HP LaserJet, OfficeJet
- Canon PIXMA, imageCLASS
- Epson WorkForce, EcoTank
- Brother HL, MFC
- Any printer with IPP Everywhere support

### Thermal Printers (ESC/POS)
| Brand | Models | Protocol |
|-------|--------|----------|
| EPSON | TM-T20, TM-T88, TM-U220 | ESC/POS |
| STAR | TSP100, TSP650, TSP700 | StarLine |
| CUSTOM | TG2480, KUBE | ESC/POS |
| BEMATECH | MP-4200, MP-100S | ESC/POS |
| Rongta | RP80, RP326 | ESC/POS |

## 🔌 Connection Protocols

| Protocol | Port | Use |
|----------|------|-----|
| IPP/IPPS | 631 | Modern network printers |
| Raw/Socket | 9100 | Direct print (thermal) |
| LPD | 515 | Legacy printers |
| CUPS | local | Print queue |

## 📁 Project Structure

```
printer_management/
├── backend/
│   ├── src/
│   │   ├── config/        # Configuration (DB, etc.)
│   │   ├── middleware/    # Auth, error handling
│   │   ├── routes/        # API routes
│   │   ├── services/      # CUPS, thermal printer
│   │   └── utils/         # Logger, shell exec
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/           # Axios client
│   │   ├── components/    # UI components
│   │   ├── context/       # Auth, Socket context
│   │   ├── hooks/         # Custom hooks
│   │   └── pages/         # Page components
│   └── Dockerfile
├── docker/
│   └── nginx/             # Nginx config
├── scripts/               # Helper scripts
├── docker-compose.yml
└── init.sql               # DB schema
```

## 🔧 API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Printers
- `GET /api/printers` - List printers
- `POST /api/printers` - Add printer
- `GET /api/printers/:id` - Printer details
- `PUT /api/printers/:id` - Update printer
- `DELETE /api/printers/:id` - Delete printer
- `POST /api/printers/:id/test` - Test printer
- `GET /api/printers/discover` - Auto-discover on network

### Direct Print (Thermal)
- `POST /api/direct-print/test-connection` - Test TCP connection
- `POST /api/direct-print/detect` - Detect printer type
- `POST /api/direct-print/test-page` - Print test page
- `POST /api/direct-print/text` - Print text
- `POST /api/direct-print/cash-drawer` - Open cash drawer
- `POST /api/direct-print/scan` - Scan network

### Jobs
- `GET /api/jobs` - List jobs
- `DELETE /api/jobs/:id` - Cancel job

## 🔄 WebSocket Events

### Printer Events
- `printer:status` - Status updated
- `printer:added` - New printer added
- `printer:removed` - Printer removed
- `printer:error` - Printer error

### Job Events
- `job:submitted` - Job submitted
- `job:status` - Status updated
- `job:completed` - Job completed
- `job:failed` - Job failed

## 🛠️ Local Development

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🔐 Environment Variables

See `.env.example` for all available options.

Critical variables:
- `JWT_SECRET` - Secret for JWT tokens (min 32 chars)
- `MYSQL_PASSWORD` - Database password
- `FRONTEND_URL` - Frontend URL for CORS

## 📊 Monitoring

The system includes:
- Automatic health checks
- Structured logging (Winston)
- Printer usage metrics
- Configurable alerts

## 🐛 Troubleshooting

### Printer not detected
1. Verify it's on the same network
2. Check port (9100 for thermal, 631 for IPP)
3. Verify firewall settings

### CUPS error
```bash
# On the host
sudo systemctl status cups
sudo cupsctl --debug-logging
```

### WebSocket not connecting
1. Verify Nginx properly proxies `/socket.io/`
2. Check backend logs

## 📄 License

MIT License
