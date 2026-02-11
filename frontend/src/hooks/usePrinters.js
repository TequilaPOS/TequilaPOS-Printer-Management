import { useState, useEffect, useCallback, useRef } from 'react'
import { printersAPI, jobsAPI } from '../api/axios'
import { useSocket } from '../context/SocketContext'

/**
 * Hook for managing printers list with real-time updates
 */
export function usePrinters(filters = {}) {
  const [printers, setPrinters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { printerStatuses } = useSocket()

  const fetchPrinters = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await printersAPI.list(filters)
      setPrinters(response.data.printers || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load printers')
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters)])

  useEffect(() => {
    fetchPrinters()

    // Listen for printer refresh events
    const handleRefresh = () => fetchPrinters()
    window.addEventListener('printer:refresh', handleRefresh)

    return () => {
      window.removeEventListener('printer:refresh', handleRefresh)
    }
  }, [fetchPrinters])

  // Merge real-time status with printer data
  const printersWithStatus = printers.map(printer => ({
    ...printer,
    liveStatus: printerStatuses[printer.id] || { status: printer.status }
  }))

  return {
    printers: printersWithStatus,
    loading,
    error,
    refresh: fetchPrinters,
    total: printers.length
  }
}

/**
 * Hook for single printer with real-time updates
 */
export function usePrinter(printerId) {
  const [printer, setPrinter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { subscribeToPrinter, unsubscribeFromPrinter, getPrinterStatus } = useSocket()

  const fetchPrinter = useCallback(async () => {
    if (!printerId) return
    
    try {
      setLoading(true)
      setError(null)
      const response = await printersAPI.get(printerId)
      setPrinter(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load printer')
    } finally {
      setLoading(false)
    }
  }, [printerId])

  useEffect(() => {
    fetchPrinter()

    if (printerId) {
      subscribeToPrinter(printerId)
      return () => unsubscribeFromPrinter(printerId)
    }
  }, [printerId, fetchPrinter, subscribeToPrinter, unsubscribeFromPrinter])

  const liveStatus = printerId ? getPrinterStatus(printerId) : null

  return {
    printer: printer ? { ...printer, liveStatus } : null,
    loading,
    error,
    refresh: fetchPrinter
  }
}

/**
 * Hook for printer actions (test, toggle, delete, etc.)
 */
export function usePrinterActions() {
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const executeAction = async (action, ...args) => {
    setActionLoading(true)
    setActionError(null)
    
    try {
      const result = await action(...args)
      return { success: true, data: result.data }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Action failed'
      setActionError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setActionLoading(false)
    }
  }

  const testPrinter = useCallback(async (id, printPage = false) => {
    return executeAction(printersAPI.test, id, printPage)
  }, [])

  const togglePrinter = useCallback(async (id, enable) => {
    return executeAction(printersAPI.toggle, id, enable)
  }, [])

  const setDefaultPrinter = useCallback(async (id) => {
    return executeAction(printersAPI.setDefault, id)
  }, [])

  const deletePrinter = useCallback(async (id) => {
    return executeAction(printersAPI.delete, id)
  }, [])

  const createPrinter = useCallback(async (data) => {
    return executeAction(printersAPI.create, data)
  }, [])

  const updatePrinter = useCallback(async (id, data) => {
    return executeAction(printersAPI.update, id, data)
  }, [])

  const discoverPrinters = useCallback(async () => {
    return executeAction(printersAPI.discover)
  }, [])

  return {
    actionLoading,
    actionError,
    testPrinter,
    togglePrinter,
    setDefaultPrinter,
    deletePrinter,
    createPrinter,
    updatePrinter,
    discoverPrinters
  }
}

/**
 * Hook for print jobs with real-time updates
 */
export function useJobs(filters = {}) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })

  const fetchJobs = useCallback(async (page = 1) => {
    try {
      setLoading(true)
      setError(null)
      const response = await jobsAPI.list({ ...filters, page, limit: pagination.limit })
      setJobs(response.data.jobs || [])
      setPagination(prev => ({
        ...prev,
        page,
        total: response.data.total || 0
      }))
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filters), pagination.limit])

  useEffect(() => {
    fetchJobs()

    // Listen for job events
    const handleRefresh = () => fetchJobs(pagination.page)
    const handleStatusUpdate = (e) => {
      const { jobId, status } = e.detail
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status } : job
      ))
    }

    window.addEventListener('job:refresh', handleRefresh)
    window.addEventListener('job:statusUpdate', handleStatusUpdate)
    window.addEventListener('job:completed', handleRefresh)
    window.addEventListener('job:failed', handleRefresh)

    return () => {
      window.removeEventListener('job:refresh', handleRefresh)
      window.removeEventListener('job:statusUpdate', handleStatusUpdate)
      window.removeEventListener('job:completed', handleRefresh)
      window.removeEventListener('job:failed', handleRefresh)
    }
  }, [fetchJobs, pagination.page])

  const cancelJob = useCallback(async (jobId) => {
    try {
      await jobsAPI.cancel(jobId)
      fetchJobs(pagination.page)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Failed to cancel job' }
    }
  }, [fetchJobs, pagination.page])

  return {
    jobs,
    loading,
    error,
    pagination,
    refresh: () => fetchJobs(pagination.page),
    goToPage: fetchJobs,
    cancelJob
  }
}

/**
 * Hook for today's stats (dashboard)
 */
export function useTodayStats() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    pagesTotal: 0,
    activePrinters: 0,
    offlinePrinters: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchStats = useCallback(async () => {
    try {
      const response = await jobsAPI.getTodayStats()
      setStats(response.data)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()

    // Refresh every 30 seconds
    intervalRef.current = setInterval(fetchStats, 30000)

    // Also listen for job events
    const handleJobEvent = () => fetchStats()
    window.addEventListener('job:completed', handleJobEvent)
    window.addEventListener('job:failed', handleJobEvent)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('job:completed', handleJobEvent)
      window.removeEventListener('job:failed', handleJobEvent)
    }
  }, [fetchStats])

  return { stats, loading, error, refresh: fetchStats }
}

/**
 * Hook for auto-discovery
 */
export function usePrinterDiscovery() {
  const [discovering, setDiscovering] = useState(false)
  const [discoveredPrinters, setDiscoveredPrinters] = useState([])
  const [error, setError] = useState(null)

  const startDiscovery = useCallback(async () => {
    try {
      setDiscovering(true)
      setError(null)
      const response = await printersAPI.discover()
      setDiscoveredPrinters(response.data.new || [])
      return response.data
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Discovery failed'
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setDiscovering(false)
    }
  }, [])

  const clearDiscovered = useCallback(() => {
    setDiscoveredPrinters([])
    setError(null)
  }, [])

  return {
    discovering,
    discoveredPrinters,
    error,
    startDiscovery,
    clearDiscovered
  }
}
