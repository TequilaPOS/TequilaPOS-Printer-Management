import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { printersAPI, systemAPI } from '../api/axios'
import api from '../api/axios'
import { useSocket } from '../context/SocketContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { getStatusColors, getSnmpColor, getRowBackground } from '../utils/printerColors'
import { 
  Server, 
  Printer, 
  Database, 
  Globe, 
  Wifi,
  Network,
  MonitorSmartphone,
  CheckCircle,
  XCircle,
  Activity,
  RefreshCw,
  HardDrive,
  Cpu,
  Tag,
  MapPin,
  ChevronDown,
  Moon,
  Plus,
  Monitor,
  Smartphone,
  Laptop,
  ShoppingCart,
  Trash2,
  Edit,
  Save
} from 'lucide-react'

// Device type icons
const DEVICE_ICONS = {
  pos: ShoppingCart,
  workstation: Monitor,
  laptop: Laptop,
  mobile: Smartphone,
  other: Globe
}

const DEVICE_COLORS = {
  pos: 'bg-white border-gray-300',
  workstation: 'bg-white border-gray-300',
  laptop: 'bg-white border-gray-300',
  mobile: 'bg-white border-gray-300',
  other: 'bg-white border-gray-300'
}

export default function Architecture() {
  const { socket } = useSocket()
  const queryClient = useQueryClient()
  const [groupBy, setGroupBy] = useState('none') // 'none', 'location', 'tag'
  const [selectedTag, setSelectedTag] = useState(null)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState(null) // For printer detail modal
  
  // Custom devices state
  const [customDevices, setCustomDevices] = useState(() => {
    const saved = localStorage.getItem('architecture-devices')
    return saved ? JSON.parse(saved) : []
  })
  const [deviceStatuses, setDeviceStatuses] = useState({}) // { ip: 'online' | 'offline' }
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false)
  const [editingDevice, setEditingDevice] = useState(null)
  const [printerSearch, setPrinterSearch] = useState('')
  const [newDevice, setNewDevice] = useState({
    name: '',
    type: 'pos',
    ip: '',
    description: '',
    printerIds: [] // Connected printers
  })

  // Save devices to localStorage
  useEffect(() => {
    localStorage.setItem('architecture-devices', JSON.stringify(customDevices))
  }, [customDevices])

  // Ping devices with IP addresses
  useEffect(() => {
    const pingDevices = async () => {
      const devicesWithIp = customDevices.filter(d => d.ip && d.ip.trim())
      if (devicesWithIp.length === 0) return
      
      // Set checking state for all devices
      const checkingMap = {}
      devicesWithIp.forEach(d => {
        checkingMap[d.ip] = 'checking'
      })
      setDeviceStatuses(prev => ({ ...prev, ...checkingMap }))
      
      try {
        const response = await api.post('/system/ping-batch', {
          ips: devicesWithIp.map(d => d.ip)
        })
        
        const statusMap = {}
        response.data.results.forEach(r => {
          statusMap[r.ip] = r.status
        })
        setDeviceStatuses(prev => ({ ...prev, ...statusMap }))
      } catch (error) {
        console.error('Failed to ping devices:', error)
        // On error, keep previous status or mark as unknown
      }
    }
    
    pingDevices()
    const interval = setInterval(pingDevices, 180000) // Every 3 minutes (like Zabbix ICMP check default)
    return () => clearInterval(interval)
  }, [customDevices])

  const addDevice = () => {
    if (!newDevice.name.trim()) return
    const device = {
      ...newDevice,
      id: Date.now(),
      createdAt: new Date().toISOString()
    }
    setCustomDevices(prev => [...prev, device])
    setNewDevice({ name: '', type: 'pos', ip: '', description: '', printerIds: [] })
    setPrinterSearch('')
    setShowAddDeviceModal(false)
  }

  const togglePrinterForDevice = (printerId, isEditing = false) => {
    if (isEditing) {
      setEditingDevice(prev => ({
        ...prev,
        printerIds: prev.printerIds?.includes(printerId)
          ? prev.printerIds.filter(id => id !== printerId)
          : [...(prev.printerIds || []), printerId]
      }))
    } else {
      setNewDevice(prev => ({
        ...prev,
        printerIds: prev.printerIds.includes(printerId)
          ? prev.printerIds.filter(id => id !== printerId)
          : [...prev.printerIds, printerId]
      }))
    }
  }

  const updateDevice = () => {
    if (!editingDevice || !editingDevice.name.trim()) return
    setCustomDevices(prev => prev.map(d => d.id === editingDevice.id ? editingDevice : d))
    setPrinterSearch('')
    setEditingDevice(null)
  }

  const deleteDevice = (id) => {
    if (confirm('Delete this device from the diagram?')) {
      setCustomDevices(prev => prev.filter(d => d.id !== id))
    }
  }

  // Check if monitoring is active (not in maintenance mode)
  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: () => api.get('/maintenance/is-active').then(res => res.data),
    refetchInterval: 60000,
  })
  const isMonitoringActive = maintenanceData?.isActive !== false

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket) return

    socket.on('printer:status', () => {
      queryClient.invalidateQueries(['printers'])
    })

    return () => {
      socket.off('printer:status')
    }
  }, [socket, queryClient])

  // Get printers
  const { data: printersData, refetch: refetchPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
    refetchInterval: 180000, // 3 minutes
  })

  // Get system health
  const { data: healthData, refetch: refetchHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => systemAPI.health().then(res => res.data),
    refetchInterval: 60000, // 1 minute
  })

  // Get CUPS status
  const { data: cupsData, refetch: refetchCups } = useQuery({
    queryKey: ['cups-status'],
    queryFn: () => systemAPI.cupsStatus().then(res => res.data),
    refetchInterval: 60000, // 1 minute
  })

  const printers = printersData?.printers || []
  const onlinePrinters = printers.filter(p => p.status === 'online')
  
  // Extract unique locations and tags
  const allLocations = useMemo(() => {
    const locs = new Set()
    printers.forEach(p => {
      if (p.location) locs.add(p.location)
    })
    return Array.from(locs).sort()
  }, [printers])

  const allTags = useMemo(() => {
    const tags = new Set()
    printers.forEach(p => {
      if (p.tags) {
        p.tags.split(',').forEach(t => tags.add(t.trim()))
      }
    })
    return Array.from(tags).sort()
  }, [printers])

  // Group printers based on selection
  const groupedPrinters = useMemo(() => {
    if (groupBy === 'location') {
      const groups = {}
      printers.forEach(p => {
        const key = p.location || 'No Location'
        if (!groups[key]) groups[key] = []
        groups[key].push(p)
      })
      return groups
    } else if (groupBy === 'tag' && selectedTag) {
      const groups = { [selectedTag]: [], 'Other': [] }
      printers.forEach(p => {
        if (p.tags && p.tags.split(',').map(t => t.trim()).includes(selectedTag)) {
          groups[selectedTag].push(p)
        } else {
          groups['Other'].push(p)
        }
      })
      if (groups['Other'].length === 0) delete groups['Other']
      return groups
    }
    return { 'All Printers': printers }
  }, [printers, groupBy, selectedTag])
  
  // Normalize health data - API returns status: "healthy" not healthy: true
  const isHealthy = healthData?.status === 'healthy' || healthData?.healthy === true
  const isDbConnected = healthData?.database === 'connected' || healthData?.database === true
  
  // Normalize CUPS data - API returns cups.success not running
  const isCupsRunning = cupsData?.cups?.success === true || cupsData?.running === true

  const StatusBadge = ({ ok, label }) => (
    <Badge variant={ok ? 'default' : 'destructive'} className="text-xs">
      {ok ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
      {label}
    </Badge>
  )

  const refreshAll = () => {
    refetchPrinters()
    refetchHealth()
    refetchCups()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Architecture</h1>
          <p className="text-muted-foreground">Network topology and infrastructure overview</p>
        </div>
        <Button variant="outline" onClick={refreshAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Maintenance Mode Banner */}
      {!isMonitoringActive && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <p className="font-medium text-orange-900">
                🌙 Monitoring Paused — Outside of active hours
              </p>
            </div>
            <p className="text-sm text-orange-700 mt-1 ml-7">
              Printer status reflects last known state before maintenance window.
            </p>
          </CardContent>
        </Card>
      )}

      {/* System Status Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={isHealthy ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Server className={`h-8 w-8 ${isHealthy ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="font-semibold">API Server</p>
                <StatusBadge ok={isHealthy} label={isHealthy ? 'Running' : 'Down'} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={isCupsRunning ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Cpu className={`h-8 w-8 ${isCupsRunning ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="font-semibold">CUPS Spooler</p>
                <StatusBadge ok={isCupsRunning} label={isCupsRunning ? 'Running' : 'Stopped'} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={isDbConnected ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Database className={`h-8 w-8 ${isDbConnected ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="font-semibold">MySQL</p>
                <StatusBadge ok={isDbConnected} label={isDbConnected ? 'Connected' : 'Disconnected'} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Printer className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-semibold">Printers</p>
                <Badge variant="outline" className="text-xs">
                  {onlinePrinters.length} / {printers.length} Online
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simple Visual Diagram */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Network Topology
              </CardTitle>
              <CardDescription>Visual representation of your print infrastructure</CardDescription>
            </div>
            {/* Grouping Options - Dropdown */}
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground">Group by:</span>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                  className="min-w-[140px] justify-between"
                >
                  {groupBy === 'none' ? 'All' : 
                   groupBy === 'location' ? 'Location' :
                   `Tag: ${selectedTag}`}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
                {showGroupDropdown && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { setGroupBy('none'); setSelectedTag(null); setShowGroupDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${groupBy === 'none' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                    >
                      All Printers
                    </button>
                    {allLocations.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 border-t">
                          Locations
                        </div>
                        <button
                          onClick={() => { setGroupBy('location'); setSelectedTag(null); setShowGroupDropdown(false); }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${groupBy === 'location' ? 'bg-primary/10 text-primary font-medium' : ''}`}
                        >
                          <MapPin className="h-3 w-3" />
                          Group by Location
                        </button>
                      </>
                    )}
                    {allTags.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 border-t">
                          Tags ({allTags.length})
                        </div>
                        {allTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => { setGroupBy('tag'); setSelectedTag(tag); setShowGroupDropdown(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${groupBy === 'tag' && selectedTag === tag ? 'bg-primary/10 text-primary font-medium' : ''}`}
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {/* Add Device Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDeviceModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Scrollable container - horizontal scroll only */}
          <div className="overflow-x-auto">
            <div className="p-6 bg-slate-50 min-w-max">
            {/* TOP ROW - Network Clients */}
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm border min-w-[120px]">
                  <Globe className="h-8 w-8 text-blue-500 mb-2" />
                  <span className="text-sm font-medium">Network</span>
                  <span className="text-xs text-muted-foreground">LAN Clients</span>
                </div>
                <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-sm border min-w-[120px]">
                  <MonitorSmartphone className="h-8 w-8 text-indigo-500 mb-2" />
                  <span className="text-sm font-medium">Web UI</span>
                  <span className="text-xs text-muted-foreground">Management</span>
                </div>
              </div>
            </div>

            {/* Connection Line */}
            <div className="flex justify-center mb-6">
              <div className="h-8 w-px bg-gray-300" />
            </div>

            {/* PRINT SERVER */}
            <div className="flex justify-center mb-6">
              <div className={`flex flex-col items-center p-5 rounded-2xl shadow-lg border-2 ${
                isHealthy ? 'bg-white border-green-400' : 'bg-red-50 border-red-400'
              }`}>
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Server className="h-10 w-10 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold">Print Server</h3>
                    <p className="text-xs text-muted-foreground">CUPS + Node.js API</p>
                    <Badge variant={isHealthy ? 'default' : 'destructive'} className="mt-1 text-xs">
                      {isHealthy ? '✓ Healthy' : '✗ Unhealthy'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t w-full justify-center">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 rounded-full">
                    <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs">MySQL</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 rounded-full">
                    <div className={`w-2 h-2 rounded-full ${isCupsRunning ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs">CUPS</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 rounded-full">
                    <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs">API</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Line from Server */}
            <div className="flex justify-center mb-4">
              <div className="h-8 w-px bg-gray-300" />
            </div>

            {/* DEVICES ROW */}
            {customDevices.length > 0 && (
              <>
                <div className="flex justify-center mb-4">
                  <span className="text-xs font-medium text-muted-foreground bg-white px-3 py-1 rounded-full border">
                    Workstations & Devices
                  </span>
                </div>
                
                {/* Devices in a clean grid */}
                <div className="overflow-x-auto pb-4 mb-4">
                  <div className="flex gap-6 min-w-max px-4 justify-center">
                    {customDevices.map(device => {
                      const DeviceIcon = DEVICE_ICONS[device.type] || Globe
                      const connectedPrinters = printers.filter(p => device.printerIds?.includes(p.id))
                      const hasIp = device.ip && device.ip.trim()
                      const deviceStatus = hasIp ? deviceStatuses[device.ip] : null
                      const isOnline = deviceStatus === 'online'
                      const isChecking = deviceStatus === 'checking' || (hasIp && !deviceStatus)
                      
                      // Colors based on status
                      const borderColor = !hasIp ? 'border-gray-300' 
                        : isChecking ? 'border-yellow-400'
                        : isOnline ? 'border-green-400' 
                        : 'border-red-300'
                      
                      const iconBgColor = !hasIp ? 'bg-gray-100'
                        : isChecking ? 'bg-yellow-100'
                        : isOnline ? 'bg-green-100'
                        : 'bg-red-100'
                      
                      const iconColor = !hasIp ? 'text-gray-600'
                        : isChecking ? 'text-yellow-600'
                        : isOnline ? 'text-green-600'
                        : 'text-red-500'
                      
                      const dotColor = isChecking ? 'bg-yellow-500'
                        : isOnline ? 'bg-green-500'
                        : 'bg-red-500'
                      
                      return (
                        <div key={device.id} className="flex flex-col items-center">
                          {/* Device Card */}
                          <div className={`relative group flex flex-col items-center p-4 rounded-xl shadow-sm border-2 min-w-[140px] bg-white ${borderColor}`}>
                            {/* Edit/Delete on hover */}
                            <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                              <button
                                onClick={() => setEditingDevice({...device, printerIds: device.printerIds || []})}
                                className="p-1 bg-white rounded-full shadow border hover:bg-blue-50"
                              >
                                <Edit className="h-3 w-3 text-blue-600" />
                              </button>
                              <button
                                onClick={() => deleteDevice(device.id)}
                                className="p-1 bg-white rounded-full shadow border hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </button>
                            </div>
                            
                            {/* Status indicator */}
                            {hasIp && (
                              <div className={`absolute -top-1 -left-1 w-3 h-3 rounded-full border-2 border-white ${dotColor} ${isChecking ? 'animate-pulse' : ''}`} 
                                title={isChecking ? 'Checking...' : isOnline ? 'Online' : 'Offline'} 
                              />
                            )}
                            
                            <div className={`p-2 rounded-lg mb-2 ${iconBgColor}`}>
                              <DeviceIcon className={`h-7 w-7 ${iconColor}`} />
                            </div>
                            <span className="text-sm font-semibold text-center">{device.name}</span>
                            {device.ip && (
                              <span className="text-xs text-muted-foreground font-mono">{device.ip}</span>
                            )}
                          </div>
                          
                          {/* Connection line */}
                          {connectedPrinters.length > 0 && (
                            <div className="h-4 w-px bg-gray-300" />
                          )}
                          
                          {/* Connected Printers Grid - 4 columns, larger cards, clickable */}
                          {connectedPrinters.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 max-w-[480px]">
                              {connectedPrinters.map(printer => (
                                <button 
                                  key={printer.id}
                                  onClick={(e) => { e.stopPropagation(); setSelectedPrinter(printer); }}
                                  className={`flex flex-col items-center p-2.5 rounded-lg border-2 text-center cursor-pointer transition-all hover:scale-105 hover:shadow-lg ${
                                    printer.status === 'online' 
                                      ? 'bg-white border-green-400 hover:border-green-500' 
                                      : 'bg-gray-50 border-gray-300 hover:border-gray-400'
                                  }`}
                                  title="Click for details"
                                >
                                  <Printer className={`h-6 w-6 mb-1 ${
                                    printer.status === 'online' ? 'text-green-600' : 'text-gray-400'
                                  }`} />
                                  <span className="text-xs font-medium truncate w-full leading-tight">
                                    {printer.name.split('_').pop()?.substring(0, 10) || printer.name.substring(0, 8)}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate w-full">
                                    .{printer.ip_address.split('.').slice(-1)[0]}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {/* Connection Line to unassigned printers */}
                <div className="flex justify-center mb-4">
                  <div className="h-6 w-px bg-gray-300" />
                </div>
              </>
            )}

            {/* UNASSIGNED PRINTERS - Printers not linked to any device */}
            {(() => {
              const assignedPrinterIds = new Set(customDevices.flatMap(d => d.printerIds || []))
              const unassignedPrinters = printers.filter(p => !assignedPrinterIds.has(p.id))
              
              if (unassignedPrinters.length === 0 && customDevices.length > 0) return null
              
              const printersToShow = customDevices.length > 0 ? unassignedPrinters : printers
              
              return (
                <>
                  {customDevices.length > 0 && unassignedPrinters.length > 0 && (
                    <div className="flex justify-center mb-2">
                      <span className="text-xs font-medium text-muted-foreground bg-white px-3 py-1 rounded-full border">
                        Unassigned Printers
                      </span>
                    </div>
                  )}
                  
                  {customDevices.length === 0 && (
                    <>
                      <div className="flex justify-center mb-6">
                        <div className="h-6 w-px bg-gray-300" />
                      </div>
                      <div className="flex justify-center mb-2">
                        <span className="text-xs font-medium text-muted-foreground bg-white px-3 py-1 rounded-full border">
                          Network Printers
                        </span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-center">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-4xl">
                      {printersToShow.map(printer => (
                        <div 
                          key={printer.id}
                          className={`flex flex-col items-center p-3 rounded-xl border-2 shadow-sm transition-all hover:shadow-md ${
                            printer.status === 'online' 
                              ? 'bg-white border-green-300' 
                              : 'bg-gray-50 border-gray-300'
                          }`}
                        >
                          <div className={`p-2 rounded-lg mb-2 ${
                            printer.status === 'online' ? 'bg-green-100' : 'bg-gray-200'
                          }`}>
                            <Printer className={`h-6 w-6 ${
                              printer.status === 'online' ? 'text-green-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <span className="text-xs font-medium text-center truncate w-full" title={printer.name}>
                            {printer.name.length > 15 ? printer.name.substring(0, 13) + '...' : printer.name}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{printer.ip_address}</span>
                          <Badge 
                            variant={printer.status === 'online' ? 'default' : 'secondary'}
                            className="text-xs mt-1"
                          >
                            {printer.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
            })()}
            
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Details</CardTitle>
          <CardDescription>Technical details for each printer connection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-4 font-medium">Printer</th>
                  <th className="text-left py-3 px-4 font-medium">IP Address</th>
                  <th className="text-left py-3 px-4 font-medium">Location</th>
                  <th className="text-left py-3 px-4 font-medium">Tags</th>
                  <th className="text-left py-3 px-4 font-medium">Port</th>
                  <th className="text-left py-3 px-4 font-medium">Protocol</th>
                  <th className="text-left py-3 px-4 font-medium">CUPS Name</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">SNMP</th>
                </tr>
              </thead>
              <tbody>
                {printers.map(printer => {
                  const statusColors = getStatusColors(printer.status)
                  const snmpColor = getSnmpColor(printer)
                  const rowBg = getRowBackground(printer)
                  return (
                    <tr key={printer.id} className={`border-b ${rowBg}`}>
                      <td className="py-3 px-4 font-medium">{printer.name}</td>
                      <td className="py-3 px-4 font-mono text-sm">{printer.ip_address}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {printer.location || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {printer.tags ? (
                          <div className="flex flex-wrap gap-1">
                            {printer.tags.split(',').map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                <Tag className="h-3 w-3 mr-1" />
                                {tag.trim()}
                              </Badge>
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">{printer.port || 9100}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{printer.protocol?.toUpperCase() || 'IPP'}</Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-sm">{printer.cups_name}</td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors.badge}>
                          {printer.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {printer.snmp_enabled ? (
                          <CheckCircle className={`h-5 w-5 ${snmpColor}`} />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {printers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No printers to display
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'API Server', port: 3000, icon: Server, status: isHealthy },
              { name: 'CUPS Daemon', port: 631, icon: HardDrive, status: isCupsRunning },
              { name: 'MySQL Database', port: 3306, icon: Database, status: isDbConnected },
              { name: 'Nginx Proxy', port: 80, icon: Globe, status: true },
            ].map(service => (
              <div key={service.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <service.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">Port {service.port}</p>
                  </div>
                </div>
                <Badge variant={service.status ? 'default' : 'destructive'}>
                  {service.status ? 'Running' : 'Stopped'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Protocol Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['socket', 'ipp', 'ipps', 'lpd', 'http'].map(protocol => {
              const count = printers.filter(p => p.protocol === protocol).length
              const onlineCount = printers.filter(p => p.protocol === protocol && p.status === 'online').length
              if (count === 0) return null
              return (
                <div key={protocol} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wifi className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium uppercase">{protocol}</p>
                      <p className="text-xs text-muted-foreground">
                        {protocol === 'socket' && 'RAW/JetDirect'}
                        {protocol === 'ipp' && 'Internet Printing Protocol'}
                        {protocol === 'ipps' && 'IPP over TLS'}
                        {protocol === 'lpd' && 'Line Printer Daemon'}
                        {protocol === 'http' && 'HTTP'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">{count}</span>
                    <p className="text-xs text-muted-foreground">{onlineCount} online</p>
                  </div>
                </div>
              )
            })}
            {printers.filter(p => p.snmp_enabled).length > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">SNMP Enabled</p>
                    <p className="text-xs text-muted-foreground">Remote monitoring active</p>
                  </div>
                </div>
                <span className="text-lg font-bold">{printers.filter(p => p.snmp_enabled).length}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Device Modal */}
      <Dialog open={showAddDeviceModal} onOpenChange={setShowAddDeviceModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Device to Diagram
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Device Name *</Label>
              <Input
                value={newDevice.name}
                onChange={(e) => setNewDevice(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., POS Terminal 1, Reception PC"
              />
            </div>

            <div className="space-y-2">
              <Label>Device Type</Label>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(DEVICE_ICONS).map(([type, Icon]) => (
                  <button
                    key={type}
                    onClick={() => setNewDevice(prev => ({ ...prev, type }))}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      newDevice.type === type 
                        ? 'border-primary bg-primary/10' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mb-1 ${newDevice.type === type ? 'text-primary' : 'text-gray-500'}`} />
                    <span className="text-xs capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IP Address (optional)</Label>
                <Input
                  value={newDevice.ip}
                  onChange={(e) => setNewDevice(prev => ({ ...prev, ip: e.target.value }))}
                  placeholder="e.g., 192.168.1.50"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={newDevice.description}
                  onChange={(e) => setNewDevice(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Main register"
                />
              </div>
            </div>

            {/* Printer Selection */}
            <div className="space-y-2">
              <Label>Connected Printers</Label>
              <p className="text-xs text-muted-foreground">Select which printers this device sends jobs to</p>
              <Input
                placeholder="Search printers..."
                value={printerSearch}
                onChange={(e) => setPrinterSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {printers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No printers available</p>
                ) : (
                  printers
                    .filter(p => 
                      p.name.toLowerCase().includes(printerSearch.toLowerCase()) ||
                      p.ip_address.includes(printerSearch)
                    )
                    .map(printer => (
                    <button
                      key={printer.id}
                      type="button"
                      onClick={() => togglePrinterForDevice(printer.id, false)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                        newDevice.printerIds.includes(printer.id)
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-muted/50 border-2 border-transparent hover:bg-muted'
                      }`}
                    >
                      <div className={`p-1.5 rounded ${printer.status === 'online' ? 'bg-green-100' : 'bg-gray-200'}`}>
                        <Printer className={`h-4 w-4 ${printer.status === 'online' ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{printer.name}</p>
                        <p className="text-xs text-muted-foreground">{printer.ip_address}</p>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        newDevice.printerIds.includes(printer.id)
                          ? 'bg-primary border-primary text-white'
                          : 'border-gray-300'
                      }`}>
                        {newDevice.printerIds.includes(printer.id) && (
                          <CheckCircle className="h-3 w-3" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              {newDevice.printerIds.length > 0 && (
                <p className="text-xs text-primary">{newDevice.printerIds.length} printer(s) selected</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDeviceModal(false)}>
              Cancel
            </Button>
            <Button onClick={addDevice} disabled={!newDevice.name.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Device Modal */}
      <Dialog open={!!editingDevice} onOpenChange={(open) => !open && setEditingDevice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Device
            </DialogTitle>
          </DialogHeader>
          
          {editingDevice && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Device Name *</Label>
                <Input
                  value={editingDevice.name}
                  onChange={(e) => setEditingDevice(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Device Type</Label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(DEVICE_ICONS).map(([type, Icon]) => (
                    <button
                      key={type}
                      onClick={() => setEditingDevice(prev => ({ ...prev, type }))}
                      className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                        editingDevice.type === type 
                          ? 'border-primary bg-primary/10' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`h-6 w-6 mb-1 ${editingDevice.type === type ? 'text-primary' : 'text-gray-500'}`} />
                      <span className="text-xs capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IP Address</Label>
                  <Input
                    value={editingDevice.ip || ''}
                    onChange={(e) => setEditingDevice(prev => ({ ...prev, ip: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={editingDevice.description || ''}
                    onChange={(e) => setEditingDevice(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>

              {/* Printer Selection */}
              <div className="space-y-2">
                <Label>Connected Printers</Label>
                <Input
                  placeholder="Search printers..."
                  value={printerSearch}
                  onChange={(e) => setPrinterSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {printers
                    .filter(p => 
                      p.name.toLowerCase().includes(printerSearch.toLowerCase()) ||
                      p.ip_address.includes(printerSearch)
                    )
                    .map(printer => (
                    <button
                      key={printer.id}
                      type="button"
                      onClick={() => togglePrinterForDevice(printer.id, true)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                        editingDevice.printerIds?.includes(printer.id)
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-muted/50 border-2 border-transparent hover:bg-muted'
                      }`}
                    >
                      <div className={`p-1.5 rounded ${printer.status === 'online' ? 'bg-green-100' : 'bg-gray-200'}`}>
                        <Printer className={`h-4 w-4 ${printer.status === 'online' ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{printer.name}</p>
                        <p className="text-xs text-muted-foreground">{printer.ip_address}</p>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        editingDevice.printerIds?.includes(printer.id)
                          ? 'bg-primary border-primary text-white'
                          : 'border-gray-300'
                      }`}>
                        {editingDevice.printerIds?.includes(printer.id) && (
                          <CheckCircle className="h-3 w-3" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {editingDevice.printerIds?.length > 0 && (
                  <p className="text-xs text-primary">{editingDevice.printerIds.length} printer(s) selected</p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDevice(null)}>
              Cancel
            </Button>
            <Button onClick={updateDevice} disabled={!editingDevice?.name?.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printer Detail Modal */}
      <Dialog open={!!selectedPrinter} onOpenChange={(open) => !open && setSelectedPrinter(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selectedPrinter?.status === 'online' ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Printer className={`h-6 w-6 ${selectedPrinter?.status === 'online' ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div>
                <span className="text-lg">{selectedPrinter?.name}</span>
                <Badge 
                  variant={selectedPrinter?.status === 'online' ? 'default' : 'secondary'} 
                  className={`ml-2 ${selectedPrinter?.status === 'online' ? 'bg-green-500' : ''}`}
                >
                  {selectedPrinter?.status}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {selectedPrinter && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="font-mono text-sm">{selectedPrinter.ip_address}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">CUPS Name</p>
                  <p className="text-sm truncate">{selectedPrinter.cups_name || '-'}</p>
                </div>
              </div>
              
              {/* Location & Model */}
              <div className="grid grid-cols-2 gap-4">
                {selectedPrinter.location && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm">{selectedPrinter.location}</p>
                  </div>
                )}
                {(selectedPrinter.manufacturer || selectedPrinter.model) && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="text-sm">{[selectedPrinter.manufacturer, selectedPrinter.model].filter(Boolean).join(' ')}</p>
                  </div>
                )}
              </div>
              
              {/* Toner Level */}
              {selectedPrinter.toner_level !== null && selectedPrinter.toner_level >= 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Toner Level</span>
                    <span className="font-medium">{selectedPrinter.toner_level}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        selectedPrinter.toner_level > 20 ? 'bg-green-500' : 
                        selectedPrinter.toner_level > 10 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(selectedPrinter.toner_level, 3)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Tags */}
              {selectedPrinter.tags && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPrinter.tags.split(',').map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* SNMP Status */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">SNMP Monitoring</span>
                <Badge variant={selectedPrinter.snmp_enabled ? 'default' : 'secondary'}>
                  {selectedPrinter.snmp_enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              
              {/* Jobs Today */}
              {selectedPrinter.jobs_today !== undefined && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Jobs Today</span>
                  <span className="font-semibold">{selectedPrinter.jobs_today}</span>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPrinter(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
