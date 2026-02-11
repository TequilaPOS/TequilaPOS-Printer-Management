import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [printerStatuses, setPrinterStatuses] = useState({})
  const [notifications, setNotifications] = useState([])
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  // Initialize socket connection
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    const token = localStorage.getItem('accessToken')
    if (!token) return

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
      setIsConnected(true)
      reconnectAttempts.current = 0
      
      // Join user's room for targeted notifications
      newSocket.emit('join:user', user.id)
    })

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
      reconnectAttempts.current++
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached')
        newSocket.disconnect()
      }
    })

    // ====================================
    // Printer Events
    // ====================================
    
    newSocket.on('printer:status', (data) => {
      console.log('Printer status update:', data)
      setPrinterStatuses(prev => ({
        ...prev,
        [data.printerId]: {
          status: data.status,
          lastUpdate: new Date().toISOString(),
          details: data.details || {}
        }
      }))
    })

    newSocket.on('printer:added', (data) => {
      console.log('New printer added:', data)
      // Trigger refresh in components listening
      window.dispatchEvent(new CustomEvent('printer:refresh'))
    })

    newSocket.on('printer:removed', (data) => {
      console.log('Printer removed:', data)
      setPrinterStatuses(prev => {
        const newStatuses = { ...prev }
        delete newStatuses[data.printerId]
        return newStatuses
      })
      window.dispatchEvent(new CustomEvent('printer:refresh'))
    })

    newSocket.on('printer:error', (data) => {
      console.error('Printer error:', data)
      setPrinterStatuses(prev => ({
        ...prev,
        [data.printerId]: {
          ...prev[data.printerId],
          status: 'error',
          error: data.error,
          lastUpdate: new Date().toISOString()
        }
      }))
    })

    // ====================================
    // Job Events
    // ====================================

    newSocket.on('job:submitted', (data) => {
      console.log('Job submitted:', data)
      window.dispatchEvent(new CustomEvent('job:refresh', { detail: data }))
    })

    newSocket.on('job:status', (data) => {
      console.log('Job status update:', data)
      window.dispatchEvent(new CustomEvent('job:statusUpdate', { detail: data }))
    })

    newSocket.on('job:completed', (data) => {
      console.log('Job completed:', data)
      window.dispatchEvent(new CustomEvent('job:completed', { detail: data }))
    })

    newSocket.on('job:failed', (data) => {
      console.error('Job failed:', data)
      window.dispatchEvent(new CustomEvent('job:failed', { detail: data }))
    })

    // ====================================
    // Notification Events
    // ====================================

    newSocket.on('notification', (data) => {
      console.log('New notification:', data)
      setNotifications(prev => [data, ...prev].slice(0, 50)) // Keep last 50
      
      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title || 'Printer Alert', {
          body: data.message,
          icon: '/printer-icon.png',
          tag: data.id
        })
      }
    })

    // ====================================
    // System Events
    // ====================================

    newSocket.on('system:cups_status', (data) => {
      console.log('CUPS status update:', data)
      window.dispatchEvent(new CustomEvent('system:cups', { detail: data }))
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [user])

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Subscribe to specific printer updates
  const subscribeToPrinter = useCallback((printerId) => {
    if (socket && isConnected) {
      socket.emit('subscribe:printer', printerId)
    }
  }, [socket, isConnected])

  // Unsubscribe from printer updates
  const unsubscribeFromPrinter = useCallback((printerId) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe:printer', printerId)
    }
  }, [socket, isConnected])

  // Get printer status
  const getPrinterStatus = useCallback((printerId) => {
    return printerStatuses[printerId] || { status: 'unknown', lastUpdate: null }
  }, [printerStatuses])

  // Clear notification
  const clearNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }, [])

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const value = {
    socket,
    isConnected,
    printerStatuses,
    notifications,
    subscribeToPrinter,
    unsubscribeFromPrinter,
    getPrinterStatus,
    clearNotification,
    clearAllNotifications,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider')
  }
  return context
}

// Custom hook for printer real-time status
export function usePrinterStatus(printerId) {
  const { subscribeToPrinter, unsubscribeFromPrinter, getPrinterStatus } = useSocket()
  const [status, setStatus] = useState(() => getPrinterStatus(printerId))

  useEffect(() => {
    if (!printerId) return

    subscribeToPrinter(printerId)
    
    const handleStatusUpdate = () => {
      setStatus(getPrinterStatus(printerId))
    }

    window.addEventListener('printer:status', handleStatusUpdate)

    return () => {
      unsubscribeFromPrinter(printerId)
      window.removeEventListener('printer:status', handleStatusUpdate)
    }
  }, [printerId, subscribeToPrinter, unsubscribeFromPrinter, getPrinterStatus])

  useEffect(() => {
    setStatus(getPrinterStatus(printerId))
  }, [printerId, getPrinterStatus])

  return status
}
