# 🖨️ Printer Management System

Sistema completo de gestión de impresoras con soporte para CUPS, impresoras térmicas ESC/POS, WebSockets en tiempo real y dashboard web moderno.

## ✨ Características

- **Gestión de Impresoras**: Agregar, configurar y monitorear impresoras vía CUPS
- **Impresión Directa**: Soporte para impresoras térmicas (EPSON, STAR, etc.) vía TCP/IP
- **WebSockets**: Actualizaciones en tiempo real de estados de impresoras y trabajos
- **Dashboard**: Interfaz moderna con React, Tailwind CSS y componentes Radix UI
- **Notificaciones**: Alertas por email y notificaciones push del navegador
- **Reportes**: Estadísticas de uso y generación de reportes
- **Multi-usuario**: Sistema de roles (admin, operator, viewer)
- **Docker**: Despliegue fácil con Docker Compose

## 🏗️ Arquitectura

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

## 📋 Requisitos

- Docker & Docker Compose
- CUPS instalado en el host (para gestión de colas)
- Node.js 18+ (para desarrollo local)

## 🚀 Quick Start

### 1. Clonar y configurar

```bash
cd printer_management
cp .env.example .env
# Editar .env con tus valores
```

### 2. Generar certificados SSL (desarrollo)

```bash
./scripts/generate-ssl.sh
```

### 3. Levantar con Docker

```bash
docker-compose up -d
```

### 4. Acceder

- **Dashboard**: https://localhost
- **API**: https://localhost/api
- **Health**: https://localhost/api/system/health

### Credenciales por defecto

- **Admin**: admin@example.com / admin123
- **Operator**: operator@example.com / operator123

## 🖨️ Impresoras Soportadas

### Via CUPS (IPP/driverless)
- HP LaserJet, OfficeJet
- Canon PIXMA, imageCLASS
- Epson WorkForce, EcoTank
- Brother HL, MFC
- Cualquier impresora con IPP Everywhere

### Impresoras Térmicas (ESC/POS)
| Marca | Modelos | Protocolo |
|-------|---------|-----------|
| EPSON | TM-T20, TM-T88, TM-U220 | ESC/POS |
| STAR | TSP100, TSP650, TSP700 | StarLine |
| CUSTOM | TG2480, KUBE | ESC/POS |
| BEMATECH | MP-4200, MP-100S | ESC/POS |
| DARUMA | DR800 | ESC/POS |
| Rongta | RP80, RP326 | ESC/POS |

## 🔌 Protocolos de Conexión

| Protocolo | Puerto | Uso |
|-----------|--------|-----|
| IPP/IPPS | 631 | Impresoras de red modernas |
| Raw/Socket | 9100 | Impresión directa (térmicas) |
| LPD | 515 | Impresoras legacy |
| CUPS | local | Cola de impresión |

## 📁 Estructura del Proyecto

```
printer_management/
├── backend/
│   ├── src/
│   │   ├── config/        # Configuración (DB, etc.)
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
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual

### Printers
- `GET /api/printers` - Listar impresoras
- `POST /api/printers` - Agregar impresora
- `GET /api/printers/:id` - Detalle de impresora
- `PUT /api/printers/:id` - Actualizar impresora
- `DELETE /api/printers/:id` - Eliminar impresora
- `POST /api/printers/:id/test` - Probar impresora
- `GET /api/printers/discover` - Auto-descubrir en red

### Direct Print (Térmicas)
- `POST /api/direct-print/test-connection` - Probar conexión TCP
- `POST /api/direct-print/detect` - Detectar tipo de impresora
- `POST /api/direct-print/test-page` - Imprimir página de prueba
- `POST /api/direct-print/text` - Imprimir texto
- `POST /api/direct-print/cash-drawer` - Abrir cajón
- `POST /api/direct-print/scan` - Escanear red

### Jobs
- `GET /api/jobs` - Listar trabajos
- `DELETE /api/jobs/:id` - Cancelar trabajo

## 🔄 WebSocket Events

### Printer Events
- `printer:status` - Estado actualizado
- `printer:added` - Nueva impresora agregada
- `printer:removed` - Impresora eliminada
- `printer:error` - Error en impresora

### Job Events
- `job:submitted` - Trabajo enviado
- `job:status` - Estado actualizado
- `job:completed` - Trabajo completado
- `job:failed` - Trabajo fallido

## 🛠️ Desarrollo Local

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

## 🔐 Variables de Entorno

Ver `.env.example` para todas las opciones disponibles.

Variables críticas:
- `JWT_SECRET` - Secreto para tokens JWT (min 32 chars)
- `MYSQL_PASSWORD` - Contraseña de base de datos
- `FRONTEND_URL` - URL del frontend para CORS

## 📊 Monitoreo

El sistema incluye:
- Health checks automáticos
- Logs estructurados (Winston)
- Métricas de uso de impresoras
- Alertas configurables

## 🐛 Troubleshooting

### Impresora no detectada
1. Verificar que esté en la misma red
2. Comprobar puerto (9100 para térmicas, 631 para IPP)
3. Verificar firewall

### Error de CUPS
```bash
# En el host
sudo systemctl status cups
sudo cupsctl --debug-logging
```

### WebSocket no conecta
1. Verificar que Nginx proxee correctamente `/socket.io/`
2. Revisar logs del backend

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE)

## 🙏 Créditos

Basado en las mejores prácticas de:
- [node-thermal-printer](https://github.com/Klemen1337/node-thermal-printer)
- [escpos](https://github.com/song940/node-escpos)
- [mike42/escpos-php](https://github.com/mike42/escpos-php)
