# Printer Management API Guide

## Base URL
```
http://<server-ip>:8080/api
```

Example: `http://192.168.170.10:8080/api`

---

## Authentication

All API endpoints require a JWT token. First, obtain a token by logging in.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

**Use the token** in all subsequent requests:
```http
Authorization: Bearer <token>
```

---

## Add Printer

### Register a New Printer
```http
POST /api/printers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "KITCHEN",
  "ip_address": "192.168.170.22",
  "location": "Kitchen Station",
  "port": 9100,
  "protocol": "socket"
}
```

**Required Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Printer display name (e.g., "KITCHEN", "BAR", "CASHIER") |
| `ip_address` | string | Printer IP address |

**Optional Fields:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `location` | string | null | Physical location (e.g., "Kitchen", "Bar Area") |
| `port` | integer | 9100 | Printer port (9100 for thermal, 631 for IPP) |
| `protocol` | string | "socket" | Connection protocol: `socket`, `ipp`, `ipps`, `lpd` |
| `description` | string | null | Additional description |
| `manufacturer` | string | null | Printer manufacturer (e.g., "EPSON", "SNBC") |
| `model` | string | null | Printer model |
| `driver` | string | "raw" | CUPS driver to use |

**Success Response (201):**
```json
{
  "id": 25,
  "name": "KITCHEN",
  "ip_address": "192.168.170.22",
  "cups_name": "kitchen",
  "driver": "raw",
  "message": "Printer added successfully"
}
```

**Error Responses:**

- **400 Bad Request** - Missing required fields or invalid IP
```json
{
  "error": "Name and IP address are required"
}
```

- **400 Bad Request** - Printer not reachable
```json
{
  "error": "Cannot reach printer at specified IP"
}
```

- **409 Conflict** - Printer already exists
```json
{
  "error": "Printer with this IP already exists"
}
```

---

## Full Example (cURL)

### Step 1: Login
```bash
TOKEN=$(curl -s -X POST http://192.168.170.10:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### Step 2: Add Printer
```bash
curl -X POST http://192.168.170.10:8080/api/printers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "KITCHEN",
    "ip_address": "192.168.170.22",
    "location": "Kitchen Station",
    "port": 9100
  }'
```

---

## Full Example (JavaScript/Node.js)

```javascript
const axios = require('axios');

const API_URL = 'http://192.168.170.10:8080/api';

async function addPrinter(name, ipAddress, location) {
  // Step 1: Login
  const loginResponse = await axios.post(`${API_URL}/auth/login`, {
    username: 'admin',
    password: 'your-password'
  });
  
  const token = loginResponse.data.token;
  
  // Step 2: Add printer
  const printerResponse = await axios.post(`${API_URL}/printers`, {
    name: name,
    ip_address: ipAddress,
    location: location,
    port: 9100,
    protocol: 'socket'
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Printer added:', printerResponse.data);
  return printerResponse.data;
}

// Usage
addPrinter('KITCHEN', '192.168.170.22', 'Kitchen Station')
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error.response?.data || error.message));
```

---

## Full Example (Python)

```python
import requests

API_URL = 'http://192.168.170.10:8080/api'

def add_printer(name, ip_address, location):
    # Step 1: Login
    login_response = requests.post(f'{API_URL}/auth/login', json={
        'username': 'admin',
        'password': 'your-password'
    })
    login_response.raise_for_status()
    token = login_response.json()['token']
    
    # Step 2: Add printer
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    printer_response = requests.post(f'{API_URL}/printers', json={
        'name': name,
        'ip_address': ip_address,
        'location': location,
        'port': 9100,
        'protocol': 'socket'
    }, headers=headers)
    
    printer_response.raise_for_status()
    return printer_response.json()

# Usage
if __name__ == '__main__':
    result = add_printer('KITCHEN', '192.168.170.22', 'Kitchen Station')
    print('Printer added:', result)
```

---

## Other Useful Endpoints

### List All Printers
```http
GET /api/printers
Authorization: Bearer <token>
```

### Get Single Printer
```http
GET /api/printers/:id
Authorization: Bearer <token>
```

### Delete Printer
```http
DELETE /api/printers/:id
Authorization: Bearer <token>
```

### Test Print
```http
POST /api/printers/:id/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "printPage": true
}
```

### Update Printer
```http
PUT /api/printers/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "NEW-NAME",
  "location": "New Location"
}
```

---

## POS Printing Endpoints

These endpoints are designed for POS integration. They accept raw ESC/POS data or simple text.

### Print Raw Data (ESC/POS)
```http
POST /api/print/raw
Authorization: Bearer <token>
Content-Type: application/json

{
  "printer": "KITCHEN",
  "data": "G0BURVNUIFJFQ0VJUFQKCgoK",
  "cut": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `printer` | string/number | Yes* | Printer name, ID, or cups_name |
| `ip` | string | Yes* | Printer IP (alternative to printer) |
| `data` | string | Yes* | Base64 encoded raw ESC/POS data |
| `text` | string | Yes* | Plain text (alternative to data) |
| `cut` | boolean | No | Auto-cut after printing (default: true) |

*Either `printer` or `ip` is required. Either `data` or `text` is required.

**Response:**
```json
{
  "success": true,
  "message": "Print job sent",
  "jobId": "KITCHEN-123",
  "printer": "KITCHEN",
  "cups_name": "kitchen"
}
```

### Print Receipt (Formatted)
```http
POST /api/print/receipt
Authorization: Bearer <token>
Content-Type: application/json

{
  "printer": "KITCHEN",
  "header": "MY RESTAURANT",
  "lines": [
    "Table: 5",
    "Server: John",
    "--------------------------------",
    { "text": "2x Burger", "bold": true },
    "   $15.00",
    { "text": "1x Fries", "bold": true },
    "   $5.00",
    "--------------------------------",
    { "text": "TOTAL: $20.00", "align": "right", "bold": true }
  ],
  "footer": "Thank you!",
  "cut": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `printer` | string/number | Printer name or ID |
| `header` | string | Centered, bold header text |
| `lines` | array | Array of strings or line objects |
| `footer` | string | Centered footer text |
| `cut` | boolean | Auto-cut after printing |
| `feedLines` | number | Lines to feed before cut (default: 5) |

**Line object format:**
```json
{
  "text": "Line content",
  "align": "left|center|right",
  "bold": true
}
```

---

## Full POS Example (JavaScript)

```javascript
const axios = require('axios');

const API_URL = 'http://192.168.170.10:8080/api';
let token = null;

// Login once at startup
async function login() {
  const res = await axios.post(`${API_URL}/auth/login`, {
    username: 'pos_user',
    password: 'password'
  });
  token = res.data.token;
}

// Print kitchen ticket
async function printKitchenTicket(items) {
  await axios.post(`${API_URL}/print/receipt`, {
    printer: 'KITCHEN',
    header: 'KITCHEN ORDER',
    lines: [
      `Time: ${new Date().toLocaleTimeString()}`,
      `Table: 5`,
      '--------------------------------',
      ...items.map(item => ({ text: `${item.qty}x ${item.name}`, bold: true })),
      ...items.filter(i => i.notes).map(item => `   Note: ${item.notes}`)
    ],
    footer: 'EXPEDITE',
    cut: true
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
}

// Print raw ESC/POS (when you build your own commands)
async function printRaw(printerName, base64Data) {
  await axios.post(`${API_URL}/print/raw`, {
    printer: printerName,
    data: base64Data,
    cut: true
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
```

---

## Full POS Example (Python)

```python
import requests
import base64

API_URL = 'http://192.168.170.10:8080/api'
token = None

def login():
    global token
    res = requests.post(f'{API_URL}/auth/login', json={
        'username': 'pos_user',
        'password': 'password'
    })
    token = res.json()['token']

def print_receipt(printer, header, lines, footer=''):
    headers = {'Authorization': f'Bearer {token}'}
    res = requests.post(f'{API_URL}/print/receipt', json={
        'printer': printer,
        'header': header,
        'lines': lines,
        'footer': footer,
        'cut': True
    }, headers=headers)
    return res.json()

def print_raw(printer, data_bytes):
    headers = {'Authorization': f'Bearer {token}'}
    res = requests.post(f'{API_URL}/print/raw', json={
        'printer': printer,
        'data': base64.b64encode(data_bytes).decode(),
        'cut': True
    }, headers=headers)
    return res.json()

# Usage
login()
print_receipt('KITCHEN', 'ORDER #123', [
    'Table: 5',
    {'text': '2x Burger', 'bold': True},
    {'text': 'RUSH', 'align': 'center', 'bold': True}
])
```

---

## Notes

1. **Token Expiration**: Tokens expire after 24 hours. Use the refresh token to get a new one.

2. **Thermal Printers**: For thermal receipt printers (EPSON, SNBC, Star), use:
   - `port: 9100`
   - `protocol: "socket"`

3. **Network Printers**: For office printers with IPP support:
   - `port: 631`
   - `protocol: "ipp"`

4. **CUPS Name**: The system automatically generates a CUPS-safe name from the printer name (lowercase, underscores instead of spaces).
