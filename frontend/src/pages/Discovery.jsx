import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { 
  Search, 
  Wifi, 
  Printer, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Plus,
  Radar,
  Network,
  Settings,
  Zap,
  AlertCircle
} from 'lucide-react'
import api from '../api/axios'

export default function Discovery() {
  const queryClient = useQueryClient()
  const [networkRange, setNetworkRange] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState([])
  const [selectedPrinters, setSelectedPrinters] = useState(new Set())
  const pollInterval = useRef(null)

  // Get detected local network
  const { data: networkData } = useQuery({
    queryKey: ['local-network'],
    queryFn: () => api.get('/discovery/network').then(res => res.data),
    staleTime: 60000,
  })

  // Set default network when detected
  useEffect(() => {
    if (networkData?.network && !networkRange) {
      setNetworkRange(networkData.network)
    }
  }, [networkData, networkRange])

  // Poll scan status
  const pollStatus = async () => {
    try {
      const res = await api.get('/discovery/status')
      const progress = res.data

      if (progress.status === 'scanning' || progress.status === 'quick-scan') {
        setScanResults([...progress.found])
      } else if (progress.status === 'completed') {
        setScanResults([...progress.found])
        setScanning(false)
        clearInterval(pollInterval.current)
        toast.success(`Scan completed! Found ${progress.found.length} printers`)
      } else if (progress.status === 'aborted') {
        setScanning(false)
        clearInterval(pollInterval.current)
        toast.info('Scan aborted')
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }

  // Start scan
  const startScan = async (quick = false) => {
    if (!networkRange) {
      toast.error('Please enter a network range')
      return
    }

    try {
      setScanning(true)
      setScanResults([])
      setSelectedPrinters(new Set())

      await api.post('/discovery/scan', { 
        network: networkRange,
        quick 
      })

      toast.info(`${quick ? 'Quick' : 'Full'} scan started...`)

      // Start polling
      pollInterval.current = setInterval(pollStatus, 1000)

    } catch (error) {
      setScanning(false)
      toast.error(error.response?.data?.error || 'Failed to start scan')
    }
  }

  // Abort scan
  const abortScan = async () => {
    try {
      await api.post('/discovery/abort')
      clearInterval(pollInterval.current)
      setScanning(false)
    } catch (error) {
      console.error('Abort error:', error)
    }
  }

  // Scan single IP
  const scanSingleIP = async () => {
    const ip = prompt('Enter IP address to scan:')
    if (!ip) return

    try {
      const res = await api.post('/discovery/scan-ip', { ip })
      if (res.data.found) {
        setScanResults(prev => [...prev, res.data.printer])
        toast.success(`Found printer at ${ip}`)
      } else {
        toast.info(`No printer found at ${ip}`)
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Scan failed')
    }
  }

  // Add single printer
  const addPrinter = async (printer) => {
    try {
      await api.post('/discovery/add', {
        ip: printer.ip,
        name: printer.recommended?.name || `Printer_${printer.ip}`,
        protocol: printer.recommended?.protocol || 'socket',
        port: printer.recommended?.port || 9100,
        driver: printer.recommended?.driver || 'raw',
        description: printer.info?.model || ''
      })

      toast.success(`Added ${printer.info?.model || printer.ip}`)
      queryClient.invalidateQueries(['printers'])
      
      // Remove from results
      setScanResults(prev => prev.filter(p => p.ip !== printer.ip))
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add printer')
    }
  }

  // Add all selected printers
  const addSelectedPrinters = async () => {
    const toAdd = scanResults.filter(p => selectedPrinters.has(p.ip))
    
    if (toAdd.length === 0) {
      toast.error('No printers selected')
      return
    }

    try {
      const res = await api.post('/discovery/add-all', { printers: toAdd })
      
      toast.success(`Added ${res.data.results.added.length} printers`)
      
      if (res.data.results.failed.length > 0) {
        toast.warning(`${res.data.results.failed.length} failed to add`)
      }

      queryClient.invalidateQueries(['printers'])
      
      // Remove added printers from results
      const addedIPs = new Set(res.data.results.added.map(p => p.ip))
      setScanResults(prev => prev.filter(p => !addedIPs.has(p.ip)))
      setSelectedPrinters(new Set())

    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add printers')
    }
  }

  // Toggle printer selection
  const toggleSelect = (ip) => {
    const newSet = new Set(selectedPrinters)
    if (newSet.has(ip)) {
      newSet.delete(ip)
    } else {
      newSet.add(ip)
    }
    setSelectedPrinters(newSet)
  }

  // Select all
  const selectAll = () => {
    setSelectedPrinters(new Set(scanResults.map(p => p.ip)))
  }

  // Protocol badge color
  const getProtocolColor = (protocol) => {
    switch (protocol) {
      case 'socket': return 'bg-blue-500'
      case 'ipp': return 'bg-green-500'
      case 'lpd': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current)
      }
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Network Discovery</h1>
        <p className="text-muted-foreground">
          Automatically discover and configure printers on your network
        </p>
      </div>

      {/* Scan Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5" />
            Network Scanner
          </CardTitle>
          <CardDescription>
            Enter a network range to scan for printers (e.g., 192.168.1.0/24 or 192.168.1.1-254)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Network className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={networkRange}
                  onChange={(e) => setNetworkRange(e.target.value)}
                  placeholder="192.168.1.0/24"
                  className="pl-10"
                  disabled={scanning}
                />
              </div>
            </div>
            
            {scanning ? (
              <Button variant="destructive" onClick={abortScan}>
                <XCircle className="h-4 w-4 mr-2" />
                Stop Scan
              </Button>
            ) : (
              <>
                <Button onClick={() => startScan(true)} variant="outline">
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Scan
                </Button>
                <Button onClick={() => startScan(false)}>
                  <Search className="h-4 w-4 mr-2" />
                  Full Scan
                </Button>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={scanSingleIP}>
              <Wifi className="h-4 w-4 mr-2" />
              Scan Single IP
            </Button>
          </div>

          {scanning && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Scanning network...</p>
                <p className="text-sm text-blue-700">
                  Found {scanResults.length} printers so far
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {scanResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Discovered Printers ({scanResults.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                {selectedPrinters.size > 0 && (
                  <Button size="sm" onClick={addSelectedPrinters}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Selected ({selectedPrinters.size})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scanResults.map((printer) => (
                <div 
                  key={printer.ip}
                  className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors ${
                    selectedPrinters.has(printer.ip) ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedPrinters.has(printer.ip)}
                        onChange={() => toggleSelect(printer.ip)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{printer.ip}</span>
                          {printer.info?.manufacturer && (
                            <Badge variant="outline">{printer.info.manufacturer}</Badge>
                          )}
                        </div>
                        
                        {printer.info?.model && (
                          <p className="text-sm font-medium text-foreground">
                            {printer.info.model}
                          </p>
                        )}
                        
                        {printer.info?.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {printer.info.description}
                          </p>
                        )}

                        {/* Protocols */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {printer.protocols?.map((p, i) => (
                            <Badge 
                              key={i} 
                              variant="secondary" 
                              className={`text-xs ${getProtocolColor(p.protocol)} text-white`}
                            >
                              {p.protocol}:{p.port}
                            </Badge>
                          ))}
                        </div>

                        {/* Recommended Config */}
                        {printer.recommended && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Settings className="h-3 w-3" />
                              Recommended: {printer.recommended.protocol}://
                              {printer.ip}:{printer.recommended.port}
                              {printer.recommended.driver !== 'raw' && (
                                <> • Driver: {printer.recommended.driver}</>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button size="sm" onClick={() => addPrinter(printer)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!scanning && scanResults.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Radar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No printers discovered yet</p>
              <p className="text-sm mt-1">
                Enter your network range and click "Full Scan" or "Quick Scan" to find printers
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• <strong>Quick Scan</strong>: Scans common IP endings (1, 10, 20, 50, 100, etc.) - faster but may miss some printers</li>
            <li>• <strong>Full Scan</strong>: Scans all IPs in the range - thorough but slower</li>
            <li>• <strong>CIDR notation</strong>: Use /24 for a typical 254-host network (e.g., 192.168.1.0/24)</li>
            <li>• <strong>Range notation</strong>: Use dashes for custom ranges (e.g., 192.168.1.1-50)</li>
            <li>• Printers are detected via ports 9100 (RAW), 631 (IPP), and 515 (LPD)</li>
            <li>• SNMP is used to detect manufacturer, model, and serial number when available</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
