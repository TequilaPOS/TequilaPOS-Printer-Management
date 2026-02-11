import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
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
  AlertCircle,
  Receipt,
  Thermometer,
  HelpCircle
} from 'lucide-react'
import api from '../api/axios'

export default function Discovery() {
  const queryClient = useQueryClient()
  const [networkRange, setNetworkRange] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanType, setScanType] = useState('') // '', 'full', 'quick', 'thermal'
  const [scanResults, setScanResults] = useState([])
  const [selectedPrinters, setSelectedPrinters] = useState(new Set())
  const [showManualAdd, setShowManualAdd] = useState(false)
  const [manualPrinter, setManualPrinter] = useState({
    ip: '',
    name: '',
    printerType: 'auto', // 'auto', 'thermal', 'network'
    protocol: 'socket',
    port: '9100'
  })
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

      if (progress.status === 'scanning' || progress.status === 'quick-scan' || progress.status === 'thermal-scan') {
        setScanResults([...progress.found])
      } else if (progress.status === 'completed') {
        setScanResults([...progress.found])
        setScanning(false)
        setScanType('')
        clearInterval(pollInterval.current)
        toast.success(`Scan completed! Found ${progress.found.length} printers`)
      } else if (progress.status === 'aborted') {
        setScanning(false)
        setScanType('')
        clearInterval(pollInterval.current)
        toast.info('Scan aborted')
      }
    } catch (err) {
      console.error('Poll error:', err)
    }
  }

  // Start scan
  const startScan = async (type = 'full') => {
    if (!networkRange) {
      toast.error('Please enter a network range')
      return
    }

    try {
      setScanning(true)
      setScanType(type)
      setScanResults([])
      setSelectedPrinters(new Set())

      if (type === 'thermal') {
        await api.post('/discovery/scan-thermal', { network: networkRange })
        toast.info('Thermal printer scan started...')
      } else {
        await api.post('/discovery/scan', { 
          network: networkRange,
          quick: type === 'quick'
        })
        toast.info(`${type === 'quick' ? 'Quick' : 'Full'} scan started...`)
      }

      // Start polling
      pollInterval.current = setInterval(pollStatus, 1000)

    } catch (error) {
      setScanning(false)
      setScanType('')
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
  const addPrinter = async (printer, forceThermal = false) => {
    try {
      const isThermal = forceThermal || printer.isThermal || printer.printerType === 'thermal'
      
      await api.post('/discovery/add', {
        ip: printer.ip,
        name: printer.recommended?.name || `Printer_${printer.ip}`,
        protocol: printer.recommended?.protocol || 'socket',
        port: printer.recommended?.port || 9100,
        driver: isThermal ? 'raw' : (printer.recommended?.driver || 'raw'),
        description: printer.info?.model || '',
        forceThermal: isThermal,
        printerType: isThermal ? 'thermal' : 'auto'
      })

      toast.success(`Added ${printer.info?.model || printer.ip}`)
      queryClient.invalidateQueries(['printers'])
      
      // Remove from results
      setScanResults(prev => prev.filter(p => p.ip !== printer.ip))
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add printer')
    }
  }

  // Add printer manually
  const addManualPrinter = async () => {
    if (!manualPrinter.ip || !manualPrinter.name) {
      toast.error('IP and name are required')
      return
    }

    try {
      const isThermal = manualPrinter.printerType === 'thermal'
      
      await api.post('/discovery/add', {
        ip: manualPrinter.ip,
        name: manualPrinter.name,
        protocol: manualPrinter.protocol,
        port: parseInt(manualPrinter.port) || 9100,
        forceThermal: isThermal,
        printerType: manualPrinter.printerType
      })

      toast.success(`Added ${manualPrinter.name}`)
      queryClient.invalidateQueries(['printers'])
      setShowManualAdd(false)
      setManualPrinter({ ip: '', name: '', printerType: 'auto', protocol: 'socket', port: '9100' })
      
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
      case 'http': return 'bg-purple-500'
      case 'https': return 'bg-purple-600'
      default: return 'bg-gray-500'
    }
  }

  // Printer type badge
  const getPrinterTypeBadge = (printer) => {
    if (printer.isThermal || printer.printerType === 'thermal') {
      return (
        <Badge className="bg-orange-500 text-white">
          <Receipt className="w-3 h-3 mr-1" />
          Thermal/POS
        </Badge>
      )
    }
    if (printer.printerType === 'network') {
      return (
        <Badge className="bg-blue-500 text-white">
          <Printer className="w-3 h-3 mr-1" />
          Network
        </Badge>
      )
    }
    return (
      <Badge className="bg-gray-500 text-white">
        <Printer className="w-3 h-3 mr-1" />
        Unknown
      </Badge>
    )
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
              <Button onClick={() => startScan('full')} size="lg">
                <Search className="h-5 w-5 mr-2" />
                Scan Network
              </Button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-muted-foreground">Options:</span>
            <Button variant="ghost" size="sm" onClick={scanSingleIP}>
              <Wifi className="h-4 w-4 mr-2" />
              Scan Single IP
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowManualAdd(true)}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Manually
            </Button>
          </div>

          {scanning && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  Scanning network for all printers...
                </p>
                <p className="text-sm text-blue-700">
                  Found {scanResults.length} printer{scanResults.length !== 1 ? 's' : ''} so far
                  {scanResults.filter(p => p.isThermal).length > 0 && (
                    <span className="ml-2 text-orange-600">
                      ({scanResults.filter(p => p.isThermal).length} thermal)
                    </span>
                  )}
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
                  } ${printer.isThermal ? 'border-orange-200' : ''}`}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium">{printer.ip}</span>
                          {getPrinterTypeBadge(printer)}
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
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <div className="flex items-center gap-1 font-medium text-gray-700">
                              <Settings className="h-3 w-3" />
                              Recommended Configuration:
                            </div>
                            <div className="mt-1 text-gray-600">
                              <div>URI: <code className="bg-gray-200 px-1 rounded">{printer.recommended.uri || `${printer.recommended.protocol}://${printer.ip}:${printer.recommended.port}`}</code></div>
                              <div>Driver: <code className="bg-gray-200 px-1 rounded">{printer.recommended.driverDisplay || printer.recommended.driver}</code></div>
                              {printer.recommended.note && (
                                <div className="text-gray-500 italic mt-1">{printer.recommended.note}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => addPrinter(printer)}
                        className={printer.isThermal ? 'bg-orange-600 hover:bg-orange-700' : ''}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                      {!printer.isThermal && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => addPrinter(printer, true)}
                          className="text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                          title="Force thermal mode if auto-detection failed"
                        >
                          <Receipt className="h-3 w-3 mr-1" />
                          As Thermal
                        </Button>
                      )}
                    </div>
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
                Enter your network range and click "Scan Network" to find all printers
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
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• <strong>Scan Network</strong> finds ALL printers (network and thermal/receipt printers)</li>
            <li>• The system <strong>automatically detects</strong> the printer type and selects the correct driver</li>
            <li>• <strong>Thermal printers</strong> (Epson TM, Star, etc.) are marked with an orange badge</li>
            <li>• Use <strong>Add Manually</strong> if a printer wasn't found or to force thermal mode</li>
            <li>• Network range example: <code className="bg-gray-100 px-1 rounded">192.168.1.0/24</code></li>
          </ul>
        </CardContent>
      </Card>

      {/* Manual Add Modal */}
      {showManualAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Printer Manually
              </CardTitle>
              <CardDescription>
                Add a printer that wasn't auto-detected or force specific settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-ip">IP Address *</Label>
                <Input
                  id="manual-ip"
                  value={manualPrinter.ip}
                  onChange={(e) => setManualPrinter(prev => ({ ...prev, ip: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="manual-name">Printer Name *</Label>
                <Input
                  id="manual-name"
                  value={manualPrinter.name}
                  onChange={(e) => setManualPrinter(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Kitchen Receipt Printer"
                />
              </div>

              <div className="space-y-2">
                <Label>Printer Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={manualPrinter.printerType === 'auto' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setManualPrinter(prev => ({ ...prev, printerType: 'auto' }))}
                    className="flex flex-col items-center py-3 h-auto"
                  >
                    <HelpCircle className="h-5 w-5 mb-1" />
                    <span className="text-xs">Auto-Detect</span>
                  </Button>
                  <Button
                    type="button"
                    variant={manualPrinter.printerType === 'thermal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setManualPrinter(prev => ({ ...prev, printerType: 'thermal', protocol: 'socket', port: '9100' }))}
                    className={`flex flex-col items-center py-3 h-auto ${manualPrinter.printerType === 'thermal' ? 'bg-orange-600 hover:bg-orange-700' : 'border-orange-300 text-orange-700 hover:bg-orange-50'}`}
                  >
                    <Receipt className="h-5 w-5 mb-1" />
                    <span className="text-xs">Thermal/POS</span>
                  </Button>
                  <Button
                    type="button"
                    variant={manualPrinter.printerType === 'network' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setManualPrinter(prev => ({ ...prev, printerType: 'network' }))}
                    className="flex flex-col items-center py-3 h-auto"
                  >
                    <Printer className="h-5 w-5 mb-1" />
                    <span className="text-xs">Network</span>
                  </Button>
                </div>
                {manualPrinter.printerType === 'thermal' && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚡ Thermal printers use RAW driver for ESC/POS commands
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-protocol">Protocol</Label>
                  <select
                    id="manual-protocol"
                    value={manualPrinter.protocol}
                    onChange={(e) => setManualPrinter(prev => ({ ...prev, protocol: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={manualPrinter.printerType === 'thermal'}
                  >
                    <option value="socket">Socket (9100)</option>
                    <option value="ipp">IPP (631)</option>
                    <option value="lpd">LPD (515)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-port">Port</Label>
                  <Input
                    id="manual-port"
                    value={manualPrinter.port}
                    onChange={(e) => setManualPrinter(prev => ({ ...prev, port: e.target.value }))}
                    placeholder="9100"
                    disabled={manualPrinter.printerType === 'thermal'}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowManualAdd(false)}>
                  Cancel
                </Button>
                <Button onClick={addManualPrinter}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Printer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
