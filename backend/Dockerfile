FROM node:18-bookworm-slim

# ============================================
# LITE CUPS (Driverless / IPP Everywhere)
# Optimized for modern printers (AirPrint / IPP)
# ============================================

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Bogota

# Driver set:
# - lite (default): driverless IPP Everywhere stack for modern printers
# - common: adds a curated set of popular drivers (still reasonably small)
# - full: restores large legacy driver packs (very large image)
ARG DRIVER_SET=lite

# Install CUPS and minimal runtime utilities.
# NOTE: intentionally excludes huge legacy driver packs (hplip/gutenprint/foomatic)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core CUPS + CLI tools (lpadmin/lpstat/lpinfo/ipptool)
    cups \
    cups-bsd \
    cups-client \
    cups-filters \
    # PDF/PostScript toolchain (commonly needed for printing PDFs)
    ghostscript \
    poppler-utils \
    # Discovery (optional; used by avahi-browse in discovery flows)
    avahi-daemon \
    avahi-utils \
    libnss-mdns \
    # Monitoring/network tools
    snmp \
    iputils-ping \
    netcat-openbsd \
    # System utilities
    procps \
    tzdata \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Optional driver packs
RUN set -eux; \
        if [ "$DRIVER_SET" = "common" ]; then \
            apt-get update; \
            apt-get install -y --no-install-recommends \
                printer-driver-brlaser \
                printer-driver-escpr \
                printer-driver-splix; \
            rm -rf /var/lib/apt/lists/*; \
        elif [ "$DRIVER_SET" = "full" ]; then \
            apt-get update; \
            apt-get install -y --no-install-recommends \
                hplip \
                printer-driver-gutenprint \
                foomatic-db-engine \
                foomatic-db-compressed-ppds \
                printer-driver-brlaser \
                printer-driver-escpr \
                printer-driver-splix; \
            rm -rf /var/lib/apt/lists/*; \
        fi

# Set timezone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Configure CUPS for remote management and driverless printing
RUN mkdir -p /etc/cups && \
    echo 'LogLevel warn' > /etc/cups/cupsd.conf && \
    echo 'MaxLogSize 0' >> /etc/cups/cupsd.conf && \
    echo 'Listen *:631' >> /etc/cups/cupsd.conf && \
    echo 'Listen /run/cups/cups.sock' >> /etc/cups/cupsd.conf && \
    echo 'Browsing On' >> /etc/cups/cupsd.conf && \
    echo 'BrowseLocalProtocols dnssd' >> /etc/cups/cupsd.conf && \
    echo 'DefaultAuthType Basic' >> /etc/cups/cupsd.conf && \
    echo 'WebInterface Yes' >> /etc/cups/cupsd.conf && \
    echo 'ServerAlias *' >> /etc/cups/cupsd.conf && \
    echo 'DefaultEncryption Never' >> /etc/cups/cupsd.conf && \
    echo '<Location />' >> /etc/cups/cupsd.conf && \
    echo '  Order allow,deny' >> /etc/cups/cupsd.conf && \
    echo '  Allow all' >> /etc/cups/cupsd.conf && \
    echo '</Location>' >> /etc/cups/cupsd.conf && \
    echo '<Location /admin>' >> /etc/cups/cupsd.conf && \
    echo '  Order allow,deny' >> /etc/cups/cupsd.conf && \
    echo '  Allow all' >> /etc/cups/cupsd.conf && \
    echo '</Location>' >> /etc/cups/cupsd.conf && \
    echo '<Location /admin/conf>' >> /etc/cups/cupsd.conf && \
    echo '  AuthType Default' >> /etc/cups/cupsd.conf && \
    echo '  Require user @SYSTEM' >> /etc/cups/cupsd.conf && \
    echo '  Order allow,deny' >> /etc/cups/cupsd.conf && \
    echo '  Allow all' >> /etc/cups/cupsd.conf && \
    echo '</Location>' >> /etc/cups/cupsd.conf && \
    echo '<Policy default>' >> /etc/cups/cupsd.conf && \
    echo '  <Limit All>' >> /etc/cups/cupsd.conf && \
    echo '    Order deny,allow' >> /etc/cups/cupsd.conf && \
    echo '  </Limit>' >> /etc/cups/cupsd.conf && \
    echo '</Policy>' >> /etc/cups/cupsd.conf

# Create necessary directories
RUN mkdir -p /run/cups /var/spool/cups /var/log/cups

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Create logs directory
RUN mkdir -p /app/logs

# Expose ports (3000 for API, 631 for CUPS web interface)
EXPOSE 3000 631

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/system/health || exit 1

# Start CUPS daemon and Node.js
CMD ["/start.sh"]
