/**
 * Unified color standards for printer status across all pages
 * This ensures consistent visual feedback throughout the application
 */

// Status colors for badges and backgrounds
export const STATUS_COLORS = {
  online: {
    badge: 'bg-green-100 text-green-800 border-green-300',
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-600',
    icon: 'text-green-500'
  },
  offline: {
    badge: 'bg-red-100 text-red-800 border-red-300',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-600',
    icon: 'text-red-500'
  },
  error: {
    badge: 'bg-red-100 text-red-800 border-red-300',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-600',
    icon: 'text-red-500'
  },
  warning: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-600',
    icon: 'text-yellow-500'
  },
  unknown: {
    badge: 'bg-gray-100 text-gray-800 border-gray-300',
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-600',
    icon: 'text-gray-400'
  }
}

// SNMP status colors based on printer health
export const SNMP_COLORS = {
  healthy: 'text-green-500',      // SNMP works, no issues
  warning: 'text-yellow-500',     // SNMP works, but toner low or minor issue
  critical: 'text-orange-500',    // SNMP works, critical issue (very low toner, paper out)
  error: 'text-red-500',          // SNMP works but printer has error
  offline: 'text-red-500',        // SNMP not responding / printer offline
  disabled: 'text-gray-300'       // SNMP not enabled
}

// Toner level colors
export const TONER_COLORS = {
  critical: 'bg-red-500',     // <= 10%
  low: 'bg-orange-500',       // 10-20%
  warning: 'bg-yellow-500',   // 20-30%
  good: 'bg-green-500'        // > 30%
}

/**
 * Get status color config based on printer status
 */
export function getStatusColors(status) {
  const normalizedStatus = (status || 'unknown').toLowerCase()
  return STATUS_COLORS[normalizedStatus] || STATUS_COLORS.unknown
}

/**
 * Get SNMP icon color based on printer health
 * @param {Object} printer - The printer object
 * @returns {string} Tailwind color class for the SNMP icon
 */
export function getSnmpColor(printer) {
  if (!printer.snmp_enabled) {
    return SNMP_COLORS.disabled
  }
  
  // If printer is offline, SNMP should show red
  if (printer.status === 'offline' || printer.status === 'error') {
    return SNMP_COLORS.offline
  }
  
  // Check toner level for warnings
  const toner = printer.toner_level
  if (toner !== null && toner >= 0) {
    if (toner <= 10) return SNMP_COLORS.critical
    if (toner <= 20) return SNMP_COLORS.warning
  }
  
  // Check for error messages
  if (printer.error_message && printer.error_message.toLowerCase().includes('error')) {
    return SNMP_COLORS.error
  }
  
  // All good
  return SNMP_COLORS.healthy
}

/**
 * Get toner bar color based on level
 */
export function getTonerColor(level) {
  if (level <= 10) return TONER_COLORS.critical
  if (level <= 20) return TONER_COLORS.low
  if (level <= 30) return TONER_COLORS.warning
  return TONER_COLORS.good
}

/**
 * Get row background class for printer tables
 */
export function getRowBackground(printer) {
  if (printer.status === 'offline' || printer.status === 'error') {
    return 'bg-red-50 hover:bg-red-100'
  }
  if (printer.toner_level !== null && printer.toner_level <= 10) {
    return 'bg-orange-50 hover:bg-orange-100'
  }
  if (printer.toner_level !== null && printer.toner_level <= 20) {
    return 'bg-yellow-50 hover:bg-yellow-100'
  }
  return 'hover:bg-muted/30'
}

/**
 * Determine if printer needs attention (for filtering/highlighting)
 */
export function printerNeedsAttention(printer) {
  return (
    printer.status === 'offline' ||
    printer.status === 'error' ||
    (printer.toner_level !== null && printer.toner_level <= 20)
  )
}
