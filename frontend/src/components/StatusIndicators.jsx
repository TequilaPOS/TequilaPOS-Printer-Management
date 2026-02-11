import { Wifi, WifiOff } from 'lucide-react'
import { useSocket } from '../context/SocketContext'
import { cn } from '../lib/utils'

/**
 * Connection status indicator component
 * Shows real-time WebSocket connection status
 */
export function ConnectionStatus({ className, showLabel = true }) {
  const { isConnected } = useSocket()
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-full',
          isConnected ? 'bg-green-100' : 'bg-red-100'
        )}
      >
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-600" />
        )}
      </div>
      {showLabel && (
        <span className={cn(
          'text-xs font-medium',
          isConnected ? 'text-green-600' : 'text-red-600'
        )}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      )}
    </div>
  )
}

/**
 * Printer status badge component
 */
export function PrinterStatusBadge({ status, className }) {
  const statusConfig = {
    online: { color: 'bg-green-100 text-green-800', label: 'Online' },
    offline: { color: 'bg-gray-100 text-gray-800', label: 'Offline' },
    printing: { color: 'bg-blue-100 text-blue-800', label: 'Printing' },
    error: { color: 'bg-red-100 text-red-800', label: 'Error' },
    paused: { color: 'bg-yellow-100 text-yellow-800', label: 'Paused' },
    unknown: { color: 'bg-gray-100 text-gray-500', label: 'Unknown' },
  }
  
  const config = statusConfig[status] || statusConfig.unknown
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      config.color,
      className
    )}>
      <span className={cn(
        'w-1.5 h-1.5 mr-1.5 rounded-full',
        status === 'online' && 'bg-green-500',
        status === 'offline' && 'bg-gray-400',
        status === 'printing' && 'bg-blue-500 animate-pulse',
        status === 'error' && 'bg-red-500',
        status === 'paused' && 'bg-yellow-500',
        status === 'unknown' && 'bg-gray-400'
      )} />
      {config.label}
    </span>
  )
}

/**
 * Live status indicator with pulse animation
 */
export function LiveIndicator({ active = true, className }) {
  if (!active) return null
  
  return (
    <span className={cn('relative flex h-2 w-2', className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
    </span>
  )
}

/**
 * Notifications badge with count
 */
export function NotificationsBadge({ count = 0, className }) {
  if (count === 0) return null
  
  return (
    <span className={cn(
      'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold rounded-full',
      count > 0 ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600',
      className
    )}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
