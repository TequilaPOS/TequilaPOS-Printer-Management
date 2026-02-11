import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { printersAPI, reportsAPI } from '../api/axios'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { getStatusColors } from '../utils/printerColors'
import PrinterCard from '../components/PrinterCard'
import AddPrinterModal from '../components/AddPrinterModal'
import EditPrinterModal from '../components/EditPrinterModal'
import { 
  Printer, 
  Plus, 
  RefreshCw, 
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  Tag,
  X,
  ChevronDown,
  CheckSquare,
  Square,
  Edit3,
  Trash2,
  AlertTriangle,
  Moon
} from 'lucide-react'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Wrench } from 'lucide-react'

export default function Dashboard() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'location', 'tag', 'status'
  const [selectedFilter, setSelectedFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null) // 'online', 'offline', null
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedPrinters, setSelectedPrinters] = useState(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkAction, setBulkAction] = useState('tag') // 'tag', 'location', 'delete'
  const [bulkValue, setBulkValue] = useState('')
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  // Maintenance modal state
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [maintenancePrinter, setMaintenancePrinter] = useState(null)
  const [maintenanceNote, setMaintenanceNote] = useState('')
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const { isOperator, isAdmin } = useAuth()
  const { socket } = useSocket()
  const queryClient = useQueryClient()

  // Check if monitoring is active (not in maintenance mode)
  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: () => api.get('/maintenance/is-active').then(res => res.data),
    refetchInterval: 60000, // Check every minute
  })
  const isMonitoringActive = maintenanceData?.isActive !== false

  // WebSocket real-time updates
  useEffect(() => {
    if (!socket) return

    // Printer status updates
    socket.on('printer:status', () => {
      queryClient.invalidateQueries(['printers'])
      queryClient.invalidateQueries(['summary'])
    })

    // Job updates
    socket.on('job:created', () => {
      queryClient.invalidateQueries(['summary'])
    })

    return () => {
      socket.off('printer:status')
      socket.off('job:created')
    }
  }, [socket, queryClient])

  // Fetch printers - reduced interval with WebSocket
  const { data: printersData, isLoading: loadingPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
    refetchInterval: 300000, // 5 minutes - WebSocket handles real-time
  })

  // Fetch summary
  const { data: summaryData } = useQuery({
    queryKey: ['summary'],
    queryFn: () => reportsAPI.getSummary().then(res => res.data),
    refetchInterval: 300000, // 5 minutes - WebSocket handles real-time
  })

  // Add printer mutation
  const addPrinterMutation = useMutation({
    mutationFn: printersAPI.create,
    onSuccess: () => {
      toast.success('Printer added successfully')
      queryClient.invalidateQueries(['printers'])
      queryClient.invalidateQueries(['summary'])
      setShowAddModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to add printer')
    }
  })

  // Edit printer mutation
  const editPrinterMutation = useMutation({
    mutationFn: ({ id, ...data }) => printersAPI.update(id, data),
    onSuccess: () => {
      toast.success('Printer updated successfully')
      queryClient.invalidateQueries(['printers'])
      setShowEditModal(false)
      setEditingPrinter(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update printer')
    }
  })

  // Test printer mutation
  const testPrinterMutation = useMutation({
    mutationFn: ({ id, printPage }) => printersAPI.test(id, printPage),
    onSuccess: (res, { printer }) => {
      const { connectivity, testPrint } = res.data
      if (connectivity.success) {
        toast.success(`${printer.name} is reachable`)
      } else {
        toast.error(`Cannot reach ${printer.name}`)
      }
    },
    onError: () => {
      toast.error('Test failed')
    }
  })

  // Toggle printer mutation
  const togglePrinterMutation = useMutation({
    mutationFn: ({ id, enable }) => printersAPI.toggle(id, enable),
    onSuccess: (_, { enable, printer }) => {
      toast.success(`${printer.name} ${enable ? 'enabled' : 'paused'}`)
      queryClient.invalidateQueries(['printers'])
    },
    onError: () => {
      toast.error('Failed to toggle printer')
    }
  })

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: printersAPI.setDefault,
    onSuccess: () => {
      toast.success('Default printer updated')
      queryClient.invalidateQueries(['printers'])
    },
    onError: () => {
      toast.error('Failed to set default printer')
    }
  })

  // Delete printer mutation
  const deletePrinterMutation = useMutation({
    mutationFn: printersAPI.delete,
    onSuccess: () => {
      toast.success('Printer deleted')
      queryClient.invalidateQueries(['printers'])
      queryClient.invalidateQueries(['summary'])
    },
    onError: () => {
      toast.error('Failed to delete printer')
    }
  })

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, field, value }) => {
      const promises = ids.map(id => 
        printersAPI.update(id, { [field]: value })
      )
      return Promise.all(promises)
    },
    onSuccess: (_, { ids, field, value }) => {
      toast.success(`Updated ${ids.length} printers: ${field} = "${value}"`)
      queryClient.invalidateQueries(['printers'])
      setSelectedPrinters(new Set())
      setBulkMode(false)
      setShowBulkModal(false)
      setBulkValue('')
    },
    onError: () => {
      toast.error('Failed to update some printers')
    }
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const promises = ids.map(id => printersAPI.delete(id))
      return Promise.all(promises)
    },
    onSuccess: (_, ids) => {
      toast.success(`Deleted ${ids.length} printers permanently`)
      queryClient.invalidateQueries(['printers'])
      queryClient.invalidateQueries(['summary'])
      setSelectedPrinters(new Set())
      setBulkMode(false)
      setShowDeleteConfirm(false)
      setDeleteConfirmText('')
    },
    onError: () => {
      toast.error('Failed to delete some printers')
    }
  })

  const printers = printersData?.printers || []
  // Only show error printers that are NOT in maintenance mode
  const errorPrinters = printers.filter(p => (p.status === 'error' || p.status === 'offline') && !p.in_maintenance)
  const maintenancePrinters = printers.filter(p => p.in_maintenance)
  const summary = summaryData || {}

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

  // Filter printers based on search and selected filter
  const filteredPrinters = useMemo(() => {
    return printers.filter(printer => {
      // Text search filter
      const matchesSearch = !search || 
        printer.name.toLowerCase().includes(search.toLowerCase()) ||
        printer.ip_address.includes(search) ||
        (printer.location && printer.location.toLowerCase().includes(search.toLowerCase())) ||
        (printer.tags && printer.tags.toLowerCase().includes(search.toLowerCase()))
      
      // Location/Tag filter
      let matchesFilter = true
      if (filterType === 'location' && selectedFilter) {
        matchesFilter = printer.location === selectedFilter
      } else if (filterType === 'tag' && selectedFilter) {
        matchesFilter = printer.tags && printer.tags.split(',').map(t => t.trim()).includes(selectedFilter)
      }
      
      // Status filter from cards
      let matchesStatus = true
      if (statusFilter === 'online') {
        matchesStatus = printer.status === 'online' && !printer.in_maintenance
      } else if (statusFilter === 'offline') {
        matchesStatus = (printer.status === 'offline' || printer.status === 'error') && !printer.in_maintenance
      } else if (statusFilter === 'maintenance') {
        matchesStatus = printer.in_maintenance
      }
      
      return matchesSearch && matchesFilter && matchesStatus
    })
  }, [printers, search, filterType, selectedFilter, statusFilter])

  const handleTest = (printer) => {
    testPrinterMutation.mutate({ id: printer.id, printPage: false, printer })
  }

  const handleToggle = (printer, enable) => {
    togglePrinterMutation.mutate({ id: printer.id, enable, printer })
  }

  const handleSetDefault = (printer) => {
    setDefaultMutation.mutate(printer.id)
  }

  const handleDelete = (printer) => {
    if (confirm(`Delete printer "${printer.name}"? This cannot be undone.`)) {
      deletePrinterMutation.mutate(printer.id)
    }
  }

  const handleMaintenance = (printer) => {
    if (printer.in_maintenance) {
      // End maintenance directly
      submitMaintenance(printer, false, null)
    } else {
      // Show modal to add note
      setMaintenancePrinter(printer)
      setMaintenanceNote('')
      setShowMaintenanceModal(true)
    }
  }

  const submitMaintenance = async (printer, enabled, note) => {
    setMaintenanceLoading(true)
    try {
      await api.put(`/printers/${printer.id}/maintenance`, { enabled, note })
      toast.success(enabled ? `${printer.name} is now in maintenance` : `${printer.name} maintenance ended`)
      queryClient.invalidateQueries(['printers'])
      setShowMaintenanceModal(false)
    } catch (error) {
      toast.error('Failed to update maintenance status')
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const handleEdit = (printer) => {
    setEditingPrinter(printer)
    setShowEditModal(true)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries(['printers'])
    queryClient.invalidateQueries(['summary'])
    toast.info('Refreshing...')
  }

  // Bulk selection handlers
  const togglePrinterSelection = (printerId) => {
    const newSet = new Set(selectedPrinters)
    if (newSet.has(printerId)) {
      newSet.delete(printerId)
    } else {
      newSet.add(printerId)
    }
    setSelectedPrinters(newSet)
  }

  const selectAllVisible = () => {
    const newSet = new Set(filteredPrinters.map(p => p.id))
    setSelectedPrinters(newSet)
  }

  const clearSelection = () => {
    setSelectedPrinters(new Set())
    setBulkMode(false)
  }

  const handleBulkApply = () => {
    if (!bulkValue.trim()) {
      toast.error('Please enter a value')
      return
    }
    const ids = Array.from(selectedPrinters)
    bulkUpdateMutation.mutate({ 
      ids, 
      field: bulkAction === 'tag' ? 'tags' : 'location', 
      value: bulkValue.trim() 
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Manage your network printers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isOperator && (
            <>
              <Button 
                variant={bulkMode ? 'default' : 'outline'} 
                onClick={() => { setBulkMode(!bulkMode); if (bulkMode) clearSelection(); }}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {bulkMode ? 'Exit Bulk Mode' : 'Bulk Edit'}
              </Button>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Printer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Mode Banner */}
      {bulkMode && (
        <Card className="border-blue-300 bg-blue-50/50">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-blue-600" />
                <span className="font-medium">
                  {selectedPrinters.size} printer{selectedPrinters.size !== 1 ? 's' : ''} selected
                </span>
                <Button variant="link" size="sm" onClick={selectAllVisible} className="text-blue-600">
                  Select all visible ({filteredPrinters.length})
                </Button>
                {selectedPrinters.size > 0 && (
                  <Button variant="link" size="sm" onClick={clearSelection} className="text-red-600">
                    Clear selection
                  </Button>
                )}
              </div>
              {selectedPrinters.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <select 
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value)}
                    className="h-9 px-3 border rounded-md text-sm"
                  >
                    <option value="tag">Set Tag</option>
                    <option value="location">Set Location</option>
                  </select>
                  
                  {bulkAction !== 'delete' && (
                    <>
                      <Input
                        placeholder={bulkAction === 'tag' ? 'Enter tag name...' : 'Enter location...'}
                        value={bulkValue}
                        onChange={(e) => setBulkValue(e.target.value)}
                        className="w-48"
                      />
                      <Button 
                        onClick={handleBulkApply}
                        disabled={bulkUpdateMutation.isPending || !bulkValue.trim()}
                      >
                        {bulkUpdateMutation.isPending ? 'Applying...' : 'Apply to Selected'}
                      </Button>
                    </>
                  )}
                  
                  {/* Delete button always visible for admin */}
                  {isAdmin && (
                    <Button 
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="ml-2"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {selectedPrinters.size} Selected
                    </Button>
                  )}
                </div>
              )}
            </div>
            {/* Quick suggestions */}
            {(allTags.length > 0 || allLocations.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2 items-center text-sm">
                <span className="text-muted-foreground">Quick select:</span>
                {bulkAction === 'tag' && allTags.slice(0, 5).map(tag => (
                  <Button 
                    key={tag} 
                    variant="outline" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => setBulkValue(tag)}
                  >
                    {tag}
                  </Button>
                ))}
                {bulkAction === 'location' && allLocations.slice(0, 5).map(loc => (
                  <Button 
                    key={loc} 
                    variant="outline" 
                    size="sm" 
                    className="h-6 text-xs"
                    onClick={() => setBulkValue(loc)}
                  >
                    {loc}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Maintenance Mode Banner */}
      {!isMonitoringActive && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-orange-600 flex-shrink-0" />
              <p className="font-medium text-orange-900">
                🌙 Monitoring Paused — Outside of active hours (Maintenance Window)
              </p>
            </div>
            <p className="text-sm text-orange-700 mt-1 ml-7">
              Printer status checks are paused. Status shown reflects last known state.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Alert - Only show when monitoring is active */}
      {isMonitoringActive && errorPrinters.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="font-semibold text-red-900">
                ⚠️ {errorPrinters.length} Printer{errorPrinters.length > 1 ? 's' : ''} with Issues
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-[420px] overflow-auto pr-1">
              {errorPrinters.map(p => (
                <div
                  key={p.id}
                  className="bg-white rounded-lg p-3 border border-red-200 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-red-900 truncate">{p.name}</span>
                    <Badge variant="destructive" className="text-xs flex-shrink-0">{p.status}</Badge>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">({p.ip_address})</div>
                  <div className="text-xs text-red-600 line-clamp-2">
                    {p.error_message || 'Check printer'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards - Clickeable to filter */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === null && filterType === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => { setStatusFilter(null); setFilterType('all'); setSelectedFilter(null); }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Printers</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.printers?.total || printers.length}</div>
            <p className="text-xs text-muted-foreground">
              In system
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md border-green-200 ${statusFilter === 'online' ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'online' ? null : 'online')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {printers.filter(p => p.status === 'online').length}
            </div>
            <p className="text-xs text-muted-foreground">Ready to print</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${errorPrinters.length > 0 ? 'border-red-300' : ''} ${statusFilter === 'offline' ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'offline' ? null : 'offline')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <AlertCircle className={`h-4 w-4 ${errorPrinters.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${errorPrinters.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {errorPrinters.length}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${maintenancePrinters.length > 0 ? 'border-orange-300' : ''} ${statusFilter === 'maintenance' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'maintenance' ? null : 'maintenance')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className={`h-4 w-4 ${maintenancePrinters.length > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${maintenancePrinters.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {maintenancePrinters.length}
            </div>
            <p className="text-xs text-muted-foreground">Under service</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Today</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.today?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary.today?.completed || 0} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active status filter indicator */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            {statusFilter === 'online' ? <CheckCircle className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
            Showing: {statusFilter === 'online' ? 'Online printers' : 'Offline printers'}
            <button onClick={() => setStatusFilter(null)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search printers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter Type Buttons */}
          <div className="flex gap-1 items-center">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setFilterType('all'); setSelectedFilter(null); setShowFilterDropdown(false); }}
            >
              All
            </Button>
            
            {/* Location Filter */}
            {allLocations.length > 0 && (
              <div className="relative">
                <Button
                  variant={filterType === 'location' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { 
                    if (filterType === 'location') {
                      setShowFilterDropdown(!showFilterDropdown);
                    } else {
                      setFilterType('location'); 
                      setSelectedFilter(null); 
                      setShowFilterDropdown(true);
                    }
                  }}
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  Location
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                {filterType === 'location' && showFilterDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg z-50 min-w-[150px] py-1">
                    {allLocations.map(loc => (
                      <button
                        key={loc}
                        onClick={() => { setSelectedFilter(loc); setShowFilterDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selectedFilter === loc ? 'bg-primary/10 text-primary font-medium' : ''}`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Tags Filter */}
            {allTags.length > 0 && (
              <div className="relative">
                <Button
                  variant={filterType === 'tag' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { 
                    if (filterType === 'tag') {
                      setShowFilterDropdown(!showFilterDropdown);
                    } else {
                      setFilterType('tag'); 
                      setSelectedFilter(null); 
                      setShowFilterDropdown(true);
                    }
                  }}
                >
                  <Tag className="h-4 w-4 mr-1" />
                  Tags
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                {filterType === 'tag' && showFilterDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg z-50 min-w-[150px] py-1 max-h-[300px] overflow-y-auto">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => { setSelectedFilter(tag); setShowFilterDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${selectedFilter === tag ? 'bg-primary/10 text-primary font-medium' : ''}`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results count */}
          <Badge variant="secondary">
            {filteredPrinters.length} of {printers.length} printer{printers.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Active Filter Indicator */}
        {selectedFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtered by:</span>
            <Badge 
              variant="outline" 
              className={`${filterType === 'location' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}
            >
              {filterType === 'location' ? <MapPin className="h-3 w-3 mr-1" /> : <Tag className="h-3 w-3 mr-1" />}
              {selectedFilter}
              <button 
                onClick={() => { setSelectedFilter(null); setFilterType('all'); }}
                className="ml-1 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {/* Printers Grid */}
      {loadingPrinters ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPrinters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Printer className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No printers found</h3>
            <p className="text-muted-foreground mb-4">
              {search ? 'Try a different search term' : 'Add your first printer to get started'}
            </p>
            {isOperator && !search && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Printer
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 items-stretch">
          {filteredPrinters.map((printer) => (
            <div key={printer.id} className="relative h-full">
              {/* Bulk selection checkbox */}
              {bulkMode && (
                <button
                  onClick={() => togglePrinterSelection(printer.id)}
                  className={`absolute -top-2 -left-2 z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedPrinters.has(printer.id)
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-gray-300 hover:border-primary'
                  }`}
                >
                  {selectedPrinters.has(printer.id) ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              )}
              <div 
                className={`h-full ${bulkMode && selectedPrinters.has(printer.id) ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}`}
                onClick={bulkMode ? () => togglePrinterSelection(printer.id) : undefined}
              >
                <PrinterCard
                  printer={printer}
                  onTest={handleTest}
                  onToggle={handleToggle}
                  onSetDefault={handleSetDefault}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onMaintenance={handleMaintenance}
                  canManage={isOperator && !bulkMode}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Printer Modal */}
      <AddPrinterModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={(data) => addPrinterMutation.mutate(data)}
        isLoading={addPrinterMutation.isPending}
      />

      {/* Edit Printer Modal */}
      {showEditModal && (
        <EditPrinterModal
          printer={editingPrinter}
          onClose={() => {
            setShowEditModal(false)
            setEditingPrinter(null)
          }}
          onSave={(data) => editPrinterMutation.mutate(data)}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete {selectedPrinters.size} Printer{selectedPrinters.size !== 1 ? 's' : ''}?
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium mb-2">
                ⚠️ This action is PERMANENT and cannot be undone!
              </p>
              <p className="text-sm text-red-700">
                The following printers will be permanently deleted from the database:
              </p>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside max-h-32 overflow-y-auto">
                {Array.from(selectedPrinters).slice(0, 10).map(id => {
                  const p = printers.find(pr => pr.id === id)
                  return p ? <li key={id}>{p.name} ({p.ip_address})</li> : null
                })}
                {selectedPrinters.size > 10 && (
                  <li>... and {selectedPrinters.size - 10} more</li>
                )}
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                To confirm, type <strong className="text-destructive">DELETE</strong> below:
              </label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="font-mono"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteConfirm(false)
                setDeleteConfirmText('')
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedPrinters))}
              disabled={deleteConfirmText !== 'DELETE' || bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Modal */}
      <Dialog open={showMaintenanceModal} onOpenChange={setShowMaintenanceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Wrench className="h-5 w-5" />
              Put Printer in Maintenance
            </DialogTitle>
          </DialogHeader>
          
          {maintenancePrinter && (
            <div className="space-y-4">
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="font-medium text-orange-900">{maintenancePrinter.name}</p>
                <p className="text-sm text-orange-700">{maintenancePrinter.ip_address}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Reason for maintenance (optional)
                </label>
                <Textarea
                  value={maintenanceNote}
                  onChange={(e) => setMaintenanceNote(e.target.value)}
                  placeholder="e.g., Replacing toner, Paper jam, Scheduled cleaning..."
                  rows={3}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                While in maintenance, this printer will not trigger alerts.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowMaintenanceModal(false)}
              disabled={maintenanceLoading}
            >
              Cancel
            </Button>
            <Button 
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => submitMaintenance(maintenancePrinter, true, maintenanceNote || null)}
              disabled={maintenanceLoading}
            >
              {maintenanceLoading ? 'Saving...' : 'Start Maintenance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
