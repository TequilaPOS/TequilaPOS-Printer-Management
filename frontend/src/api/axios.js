import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) {
          throw new Error('No refresh token')
        }
        
        // Try to refresh token
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        })
        
        const { accessToken } = response.data
        localStorage.setItem('accessToken', accessToken)
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
        
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  logout: () => 
    api.post('/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }),
  getMe: () => 
    api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.put('/auth/password', { currentPassword, newPassword }),
}

// Printers API
export const printersAPI = {
  list: (params) => 
    api.get('/printers', { params }),
  get: (id) => 
    api.get(`/printers/${id}`),
  create: (data) => 
    api.post('/printers', data),
  update: (id, data) => 
    api.put(`/printers/${id}`, data),
  delete: (id) => 
    api.delete(`/printers/${id}`),
  test: (id, printPage = false) => 
    api.post(`/printers/${id}/test`, { printPage }),
  setDefault: (id) => 
    api.post(`/printers/${id}/set-default`),
  toggle: (id, enable) => 
    api.post(`/printers/${id}/toggle`, { enable }),
  discover: () => 
    api.get('/printers/discover'),
  getSnmp: (id) =>
    api.get(`/printers/${id}/snmp`),
  // NEW: CUPS control endpoints
  pause: (id) =>
    api.post(`/printers/${id}/pause`),
  resume: (id) =>
    api.post(`/printers/${id}/resume`),
  reject: (id) =>
    api.post(`/printers/${id}/reject`),
  accept: (id) =>
    api.post(`/printers/${id}/accept`),
  setOptions: (id, options) =>
    api.put(`/printers/${id}/options`, { options }),
  getJobs: (id) =>
    api.get(`/printers/${id}/jobs`),
  cancelAllJobs: (id) =>
    api.delete(`/printers/${id}/jobs`),
  moveJob: (id, jobId, targetPrinterId) =>
    api.post(`/printers/${id}/move-job`, { jobId, targetPrinterId }),
}

// Jobs API
export const jobsAPI = {
  list: (params) => 
    api.get('/jobs', { params }),
  get: (id) => 
    api.get(`/jobs/${id}`),
  cancel: (id) => 
    api.delete(`/jobs/${id}`),
  getByPrinter: (printerId, params) => 
    api.get(`/jobs/printer/${printerId}`, { params }),
  getTodayStats: () => 
    api.get('/jobs/stats/today'),
}

// Reports API
export const reportsAPI = {
  getSummary: () => 
    api.get('/reports/summary'),
  getPrinterReport: (id, params) => 
    api.get(`/reports/printer/${id}`, { params }),
  getUsage: (params) => 
    api.get('/reports/usage', { params }),
  export: (params) => 
    api.get('/reports/export', { params, responseType: 'blob' }),
}

// Notifications API
export const notificationsAPI = {
  list: (params) => 
    api.get('/notifications', { params }),
  markAsRead: (id) => 
    api.put(`/notifications/${id}/read`),
  markAllAsRead: () => 
    api.put('/notifications/read-all'),
  getConfigs: () => 
    api.get('/notifications/configs'),
  createConfig: (data) => 
    api.post('/notifications/configs', data),
  updateConfig: (id, data) => 
    api.put(`/notifications/configs/${id}`, data),
  deleteConfig: (id) => 
    api.delete(`/notifications/configs/${id}`),
  test: (data) => 
    api.post('/notifications/test', data),
}

// Users API (admin)
export const usersAPI = {
  list: () => 
    api.get('/users'),
  get: (id) => 
    api.get(`/users/${id}`),
  create: (data) => 
    api.post('/users', data),
  update: (id, data) => 
    api.put(`/users/${id}`, data),
  delete: (id) => 
    api.delete(`/users/${id}`),
  toggleActive: (id) => 
    api.put(`/users/${id}/toggle-active`),
  changePassword: (id, password) => 
    api.put(`/users/${id}/password`, { password }),
}

// System API
export const systemAPI = {
  health: () => 
    api.get('/system/health'),
  stats: () => 
    api.get('/system/stats'),
  logs: (params) => 
    api.get('/system/logs', { params }),
  cupsStatus: () => 
    api.get('/system/cups-status'),
  refreshPrinters: () => 
    api.post('/system/refresh-printers'),
  getSettings: () => 
    api.get('/system/settings'),
  updateSettings: (settings) => 
    api.put('/system/settings', { settings }),
}

// Direct Print API (for thermal/receipt printers)
export const directPrintAPI = {
  testConnection: (ip, port = 9100) =>
    api.post('/direct-print/test-connection', { ip, port }),
  detectType: (ip, port = 9100) =>
    api.post('/direct-print/detect', { ip, port }),
  printTestPage: (ip, port = 9100, printerType = 'epson') =>
    api.post('/direct-print/test-page', { ip, port, printerType }),
  printText: (ip, port, text, options = {}) =>
    api.post('/direct-print/text', { ip, port, text, ...options }),
  openCashDrawer: (ip, port = 9100, printerType = 'epson') =>
    api.post('/direct-print/cash-drawer', { ip, port, printerType }),
  beep: (ip, port = 9100, printerType = 'epson') =>
    api.post('/direct-print/beep', { ip, port, printerType }),
  scanNetwork: (baseIp, timeout = 1000) =>
    api.post('/direct-print/scan', { baseIp, timeout }),
  getPrinterTypes: () =>
    api.get('/direct-print/printer-types'),
  testByPrinterId: (printerId) =>
    api.post(`/direct-print/by-printer/${printerId}/test`),
}

// Print API - Upload and print files
export const printAPI = {
  // Upload and print a file
  printFile: (formData) =>
    api.post('/print/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  // Print plain text
  printText: (printer_id, text, title = 'Text Document', copies = 1) =>
    api.post('/print/text', { printer_id, text, title, copies }),
  // Print test page
  printTestPage: (printer_id) =>
    api.post('/print/test', { printer_id }),
  // Get CUPS print queue
  getQueue: (printer) =>
    api.get('/print/queue', { params: { printer } }),
  // Cancel job in CUPS queue
  cancelJob: (jobId) =>
    api.delete(`/print/queue/${jobId}`),
  // Get print options for a printer
  getOptions: (printerId) =>
    api.get(`/print/options/${printerId}`),
}

export default api
