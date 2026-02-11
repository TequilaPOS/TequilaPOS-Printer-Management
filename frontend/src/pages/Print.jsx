import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { printersAPI, printAPI } from '../api/axios'
import api from '../api/axios'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { getStatusColors } from '../utils/printerColors'
import { 
  Printer, Upload, FileText, Send, RefreshCw, Settings, 
  Trash2, X, Check, Copy, ChevronDown, ChevronRight,
  PauseCircle, PlayCircle, FileUp, Type, Search, Tag, MapPin, Moon
} from 'lucide-react'

export default function Print() {
  const [selectedPrinter, setSelectedPrinter] = useState(null)
  const [file, setFile] = useState(null)
  const [copies, setCopies] = useState(1)
  const [duplex, setDuplex] = useState(false)
  const [color, setColor] = useState(true)
  const [paperSize, setPaperSize] = useState('letter')
  const [textContent, setTextContent] = useState('')
  const [textTitle, setTextTitle] = useState('Document')
  const [printMode, setPrintMode] = useState('file') // 'file' or 'text'
  const [showQueue, setShowQueue] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'location', 'tag'
  const [selectedFilter, setSelectedFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null) // 'online', 'offline', null
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const fileInputRef = useRef(null)
  const queryClient = useQueryClient()

  // Check if monitoring is active (not in maintenance mode)
  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: () => api.get('/maintenance/is-active').then(res => res.data),
    refetchInterval: 60000,
  })
  const isMonitoringActive = maintenanceData?.isActive !== false

  // Get printers
  const { data: printersData, isLoading: loadingPrinters } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
  })

  // Get print queue
  const { data: queueData, isLoading: loadingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ['printQueue', selectedPrinter?.cups_name],
    queryFn: () => printAPI.getQueue(selectedPrinter?.cups_name).then(res => res.data),
    enabled: !!selectedPrinter && showQueue,
    refetchInterval: showQueue ? 5000 : false,
  })

  // Get printer options
  const { data: optionsData } = useQuery({
    queryKey: ['printerOptions', selectedPrinter?.id],
    queryFn: () => printAPI.getOptions(selectedPrinter?.id).then(res => res.data),
    enabled: !!selectedPrinter,
  })

  // Print file mutation
  const printFileMutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData()
      formData.append('file', data.file)
      formData.append('printer_id', data.printer_id)
      formData.append('copies', data.copies)
      formData.append('duplex', data.duplex)
      formData.append('color', data.color)
      formData.append('paper_size', data.paperSize)
      return printAPI.printFile(formData)
    },
    onSuccess: (response) => {
      toast.success(`Print job submitted: ${response.data.job?.documentName}`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      queryClient.invalidateQueries(['printQueue'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to print file')
    }
  })

  // Print text mutation
  const printTextMutation = useMutation({
    mutationFn: (data) => printAPI.printText(data.printer_id, data.text, data.title, data.copies),
    onSuccess: () => {
      toast.success('Text sent to printer')
      setTextContent('')
      queryClient.invalidateQueries(['printQueue'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to print text')
    }
  })

  // Print test page mutation
  const printTestMutation = useMutation({
    mutationFn: (printer_id) => printAPI.printTestPage(printer_id),
    onSuccess: () => {
      toast.success('Test page sent to printer')
      queryClient.invalidateQueries(['printQueue'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to send test page')
    }
  })

  // Cancel job mutation
  const cancelJobMutation = useMutation({
    mutationFn: (jobId) => printAPI.cancelJob(jobId),
    onSuccess: () => {
      toast.success('Job cancelled')
      refetchQueue()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to cancel job')
    }
  })

  // Pause/Resume printer mutations
  const pausePrinterMutation = useMutation({
    mutationFn: (id) => printersAPI.pause(id),
    onSuccess: () => {
      toast.success('Printer paused')
      queryClient.invalidateQueries(['printers'])
    }
  })

  const resumePrinterMutation = useMutation({
    mutationFn: (id) => printersAPI.resume(id),
    onSuccess: () => {
      toast.success('Printer resumed')
      queryClient.invalidateQueries(['printers'])
    }
  })

  const handlePrint = () => {
    if (!selectedPrinter) {
      toast.error('Please select a printer')
      return
    }

    if (printMode === 'file') {
      if (!file) {
        toast.error('Please select a file to print')
        return
      }
      printFileMutation.mutate({
        file,
        printer_id: selectedPrinter.id,
        copies,
        duplex,
        color,
        paperSize
      })
    } else {
      if (!textContent.trim()) {
        toast.error('Please enter text to print')
        return
      }
      printTextMutation.mutate({
        printer_id: selectedPrinter.id,
        text: textContent,
        title: textTitle,
        copies
      })
    }
  }

  const printers = printersData?.printers || []
  const onlinePrinters = printers.filter(p => p.status === 'online')
  const offlinePrinters = printers.filter(p => p.status === 'offline' || p.status === 'error')
  
  // Extract all unique tags from printers
  const allTags = useMemo(() => {
    const tagsSet = new Set()
    printers.forEach(p => {
      if (p.tags) {
        p.tags.split(',').forEach(tag => tagsSet.add(tag.trim()))
      }
    })
    return Array.from(tagsSet).sort()
  }, [printers])

  // Extract all unique locations
  const allLocations = useMemo(() => {
    const locs = new Set()
    printers.forEach(p => {
      if (p.location) locs.add(p.location)
    })
    return Array.from(locs).sort()
  }, [printers])

  // Filter printers - same logic as Dashboard
  const filteredPrinters = useMemo(() => {
    return printers.filter(printer => {
      // Search filter
      const matchesSearch = !searchTerm || 
        printer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        printer.ip_address.includes(searchTerm) ||
        (printer.location && printer.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (printer.tags && printer.tags.toLowerCase().includes(searchTerm.toLowerCase()))
      
      // Type filter (location or tag)
      let matchesFilter = true
      if (filterType === 'location' && selectedFilter) {
        matchesFilter = printer.location === selectedFilter
      } else if (filterType === 'tag' && selectedFilter) {
        matchesFilter = printer.tags && printer.tags.split(',').map(t => t.trim()).includes(selectedFilter)
      }
      
      // Status filter from cards
      let matchesStatus = true
      if (statusFilter === 'online') {
        matchesStatus = printer.status === 'online'
      } else if (statusFilter === 'offline') {
        matchesStatus = printer.status === 'offline' || printer.status === 'error'
      }
      
      return matchesSearch && matchesFilter && matchesStatus
    })
  }, [printers, searchTerm, filterType, selectedFilter, statusFilter])

  const availablePrinters = filteredPrinters

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Print</h1>
          <p className="text-muted-foreground">Upload files or send text to print</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries(['printers'])}>
          <RefreshCw className="h-4 w-4" />
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
              Printer status may not be accurate. You can still send print jobs.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards - Clickeable to filter */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === null ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(null)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Printers</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{printers.length}</div>
            <p className="text-xs text-muted-foreground">In system</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md border-green-200 ${statusFilter === 'online' ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'online' ? null : 'online')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{onlinePrinters.length}</div>
            <p className="text-xs text-muted-foreground">Ready to print</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${offlinePrinters.length > 0 ? 'border-red-300' : ''} ${statusFilter === 'offline' ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'offline' ? null : 'offline')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <PauseCircle className={`h-4 w-4 ${offlinePrinters.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${offlinePrinters.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {offlinePrinters.length}
            </div>
            <p className="text-xs text-muted-foreground">Unavailable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tag className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allTags.length}</div>
            <p className="text-xs text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Selected Printer Banner (shows when printer is selected) */}
      {selectedPrinter && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <Printer className="h-8 w-8 text-primary" />
                <div>
                  <div className="font-semibold text-lg">{selectedPrinter.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedPrinter.ip_address} 
                    {selectedPrinter.model && ` • ${selectedPrinter.model}`}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedPrinter.location && (
                      <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        <MapPin className="h-3 w-3" />
                        {selectedPrinter.location}
                      </span>
                    )}
                    {selectedPrinter.tags && selectedPrinter.tags.split(',').map((tag, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                        <Tag className="h-3 w-3" />
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <Badge className="bg-green-500">Online</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printTestMutation.mutate(selectedPrinter.id)}
                  disabled={printTestMutation.isPending}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Test Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPrinter(null)}
                >
                  <X className="h-4 w-4 mr-1" />
                  Change
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Printer Selection (collapses when printer is selected) */}
      {!selectedPrinter && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Select Printer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search printers by name, IP, location, or tag..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Filter Buttons with Dropdowns - same as Dashboard */}
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
                      <div className="absolute top-full left-0 mt-1 bg-white border rounded-md shadow-lg z-50 min-w-[150px] py-1">
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

              {searchTerm && (
                <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Active filter badge */}
            {selectedFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  {filterType === 'location' ? <MapPin className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
                  {selectedFilter}
                  <button onClick={() => { setSelectedFilter(null); setFilterType('all'); }} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}

            {/* Results count */}
            <div className="text-sm text-muted-foreground">
              {filteredPrinters.length} of {printers.length} printers
            </div>

            {loadingPrinters ? (
              <div className="text-muted-foreground">Loading printers...</div>
            ) : availablePrinters.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                {printers.length === 0 
                  ? 'No printers available. Add one from Dashboard.'
                  : 'No printers match your search or filter.'}
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {availablePrinters.map(printer => {
                  const statusColors = getStatusColors(printer.status)
                  const isOffline = printer.status === 'offline' || printer.status === 'error'
                  return (
                    <button
                      key={printer.id}
                      onClick={() => setSelectedPrinter(printer)}
                      disabled={isOffline}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isOffline
                        ? `${statusColors.border} ${statusColors.bg} opacity-80 cursor-not-allowed`
                        : 'border-border hover:border-primary hover:bg-primary/5 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <Badge className={`text-xs ${statusColors.badge}`}>
                          {printer.status === 'online' ? 'Online' : 
                           printer.status === 'printing' ? 'Printing' :
                           printer.status === 'error' ? 'Error' :
                           printer.status === 'offline' ? 'Offline' : printer.status}
                        </Badge>
                      </div>
                      <div className={`font-medium text-sm truncate ${isOffline ? statusColors.text : ''}`}>{printer.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {printer.ip_address}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {printer.location && (
                          <span className="flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            <MapPin className="h-2.5 w-2.5" />
                            {printer.location}
                          </span>
                        )}
                        {printer.tags && printer.tags.split(',').slice(0, 2).map((tag, i) => (
                          <span key={i} className="flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                            <Tag className="h-2.5 w-2.5" />
                            {tag.trim()}
                          </span>
                        ))}
                        {printer.tags && printer.tags.split(',').length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{printer.tags.split(',').length - 2}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rest of the form only shows when printer is selected */}
      {selectedPrinter && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Button
                  variant={printMode === 'file' ? 'default' : 'outline'}
                  onClick={() => setPrintMode('file')}
                  className="flex-1"
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  variant={printMode === 'text' ? 'default' : 'outline'}
                  onClick={() => setPrintMode('text')}
                  className="flex-1"
                >
                  <Type className="h-4 w-4 mr-2" />
                  Print Text
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File Upload / Text Input */}
          <Card>
            <CardHeader>
              <CardTitle>
                {printMode === 'file' ? 'Upload Document' : 'Enter Text'}
              </CardTitle>
              <CardDescription>
                {printMode === 'file' 
                  ? 'Supported formats: PDF, TXT, JPG, PNG, DOC, DOCX, XLS, XLSX'
                  : 'Enter the text you want to print'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {printMode === 'file' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    accept=".pdf,.txt,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx,.ps"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        <div className="text-left">
                          <div className="font-medium">{file.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFile(null)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                        <p className="mt-2 text-muted-foreground">
                          Click to select a file or drag & drop
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    placeholder="Document title"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                  />
                  <textarea
                    placeholder="Enter text to print..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="w-full h-48 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="text-sm text-muted-foreground text-right">
                    {textContent.length} characters
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Print Options */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Print Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Copies */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Copies</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCopies(Math.max(1, copies - 1))}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={copies}
                      onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                      className="w-16 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCopies(Math.min(100, copies + 1))}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Paper Size */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value)}
                    className="w-full h-10 px-3 border rounded-md"
                  >
                    <option value="letter">Letter (8.5x11)</option>
                    <option value="legal">Legal (8.5x14)</option>
                    <option value="a4">A4</option>
                    <option value="a3">A3</option>
                  </select>
                </div>

                {/* Duplex */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Two-Sided</label>
                  <Button
                    variant={duplex ? 'default' : 'outline'}
                    onClick={() => setDuplex(!duplex)}
                    className="w-full"
                  >
                    {duplex ? <Check className="h-4 w-4 mr-2" /> : null}
                    {duplex ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Color */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Color</label>
                  <Button
                    variant={color ? 'default' : 'outline'}
                    onClick={() => setColor(!color)}
                    className="w-full"
                  >
                    {color ? 'Color' : 'Grayscale'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handlePrint}
            disabled={!selectedPrinter || (printMode === 'file' ? !file : !textContent.trim()) || printFileMutation.isPending || printTextMutation.isPending}
          >
            {(printFileMutation.isPending || printTextMutation.isPending) ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Print {printMode === 'file' && file ? file.name : ''}
              </>
            )}
          </Button>
          </div>

          {/* Right Column - Print Queue */}
          <div className="space-y-6">
              {/* Print Queue */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <button
                      onClick={() => setShowQueue(!showQueue)}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      {showQueue ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      Print Queue
                    </button>
                    {showQueue && (
                      <Button variant="ghost" size="icon" onClick={() => refetchQueue()}>
                        <RefreshCw className={`h-4 w-4 ${loadingQueue ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                {showQueue && (
                  <CardContent>
                    {loadingQueue ? (
                      <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : queueData?.pending?.length === 0 && queueData?.completed?.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No jobs in queue</div>
                    ) : (
                      <div className="space-y-3">
                        {/* Pending Jobs */}
                        {queueData?.pending?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
                            {queueData?.pending?.map((job) => (
                              <div
                                key={job.fullJobId}
                                className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded"
                              >
                                <div className="text-sm">
                                  <div className="font-medium">{job.name || `Document #${job.jobId}`}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {job.owner} · {(job.size / 1024).toFixed(0)}KB
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => cancelJobMutation.mutate(job.fullJobId)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Recent Completed Jobs */}
                        {queueData?.completed?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase">Completed</p>
                            {queueData?.completed?.slice(0, 5).map((job) => (
                              <div
                                key={job.fullJobId}
                                className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded"
                              >
                                <div className="text-sm">
                                  <div className="font-medium">{job.name || `Document #${job.jobId}`}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {job.date}
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                  Done
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
          </div>
        </div>
      )}
    </div>
  )
}
