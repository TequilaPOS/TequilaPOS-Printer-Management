import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// Get timezone from env or default to UTC
const getTimezone = () => import.meta.env.VITE_TIMEZONE || 'UTC'
const getDateFormat = () => import.meta.env.VITE_DATE_FORMAT || 'DD/MM/YYYY'
const getTimeFormat = () => import.meta.env.VITE_TIME_FORMAT || '24h'

export function formatDate(date) {
  if (!date) return '-'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    
    const options = {
      timeZone: getTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: getTimeFormat() === '12h'
    }
    
    return d.toLocaleString('en-GB', options).replace(',', '')
  } catch {
    return '-'
  }
}

export function formatDateShort(date) {
  if (!date) return '-'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    
    const options = {
      timeZone: getTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
    
    const format = getDateFormat()
    if (format === 'MM/DD/YYYY') {
      return d.toLocaleDateString('en-US', options)
    } else if (format === 'YYYY-MM-DD') {
      return d.toISOString().split('T')[0]
    }
    return d.toLocaleDateString('en-GB', options)
  } catch {
    return '-'
  }
}

export function formatTime(date) {
  if (!date) return '-'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    
    const options = {
      timeZone: getTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: getTimeFormat() === '12h'
    }
    
    return d.toLocaleTimeString('en-GB', options)
  } catch {
    return '-'
  }
}

export function getStatusColor(status) {
  const colors = {
    online: 'bg-green-100 text-green-800 border-green-200',
    offline: 'bg-red-100 text-red-800 border-red-200',
    error: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    printing: 'bg-blue-100 text-blue-800 border-blue-200',
    paused: 'bg-gray-100 text-gray-800 border-gray-200',
    unknown: 'bg-gray-100 text-gray-500 border-gray-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  }
  return colors[status] || colors.unknown
}

export function getStatusDotClass(status) {
  return `status-dot ${status || 'unknown'}`
}

export function validateIP(ip) {
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!pattern.test(ip)) return false
  const parts = ip.split('.')
  return parts.every(part => {
    const num = parseInt(part)
    return num >= 0 && num <= 255
  })
}

export function validateHostname(hostname) {
  const pattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return pattern.test(hostname) && hostname.length <= 253
}
