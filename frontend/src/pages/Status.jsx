import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { printersAPI } from '../api/axios'
import api from '../api/axios'
import { useSocket } from '../context/SocketContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Printer,
  Droplet,
  WifiOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Activity,
  TrendingDown,
  MapPin,
  X,
  Moon
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Status() {
  const [expandedSection, setExpandedSection] = useState({
    critical: true,
    warning: true,
    lowToner: true,
    offline: true,
    healthy: false
  })
  const [statusFilter, setStatusFilter] = useState(null) // 'critical', 'warning', 'lowToner', 'offline', null
  
  const { socket } = useSocket()
  const queryClient = useQueryClient()

  // Check if monitoring is active (not in maintenance mode)
  const { data: maintenanceData } = useQuery({
    queryKey: ['maintenance-status'],
    queryFn: () => api.get('/maintenance/is-active').then(res => res.data),
    refetchInterval: 60000,
  })
  const isMonitoringActive = maintenanceData?.isActive !== false

  // Use same query key as Dashboard for shared cache
  const { data: printersData, isLoading, refetch } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
    refetchInterval: 30000 // Refresh every 30s
  })

  // WebSocket real-time updates - same as Dashboard
  useEffect(() => {
    if (!socket) return

    socket.on('printer:status', () => {
      queryClient.invalidateQueries(['printers'])
    })

    return () => {
      socket.off('printer:status')
    }
  }, [socket, queryClient])

  const printers = printersData?.printers || []

  // Categorize printers by status - improved logic
  const statusGroups = useMemo(() => {
    const critical = []  // Errors or very low toner
    const warning = []   // Toner 20-30%
    const lowToner = []  // Toner 10-20%
    const offline = []   // Offline/unreachable printers
    const healthy = []   // All good

    printers.forEach(printer => {
      const status = (printer.status || 'unknown').toLowerCase()
      
      // Check offline first
      if (status === 'offline' || status === 'unreachable') {
        offline.push(printer)
      } else if (status === 'error') {
        critical.push(printer)
      }
      // Check toner levels for non-offline printers
      else if (printer.toner_level !== null && printer.toner_level !== undefined && printer.toner_level >= 0) {
        if (printer.toner_level <= 10) {
          critical.push(printer) // Very low toner is critical
        } else if (printer.toner_level <= 20) {
          lowToner.push(printer)
        } else if (printer.toner_level <= 30) {
          warning.push(printer)
        } else {
          healthy.push(printer)
        }
      } else {
        // Online but no toner info
        healthy.push(printer)
      }
    })
    
    console.log('Status groups:', { critical: critical.length, offline: offline.length, warning: warning.length, lowToner: lowToner.length, healthy: healthy.length })

    return { critical, warning, lowToner, offline, healthy }
  }, [printers])

  const toggleSection = (section) => {
    setExpandedSection(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const getTonerColor = (level) => {
    if (level <= 10) return 'bg-red-500'
    if (level <= 20) return 'bg-orange-500'
    if (level <= 30) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Online</Badge>
      case 'offline':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Offline</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Error</Badge>
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>
    }
  }

  const PrinterRow = ({ printer, showToner = true }) => (
    <Link 
      to={`/printers/${printer.id}`}
      className="flex items-center justify-between p-3 hover:bg-blue-50 rounded-lg transition-colors border border-gray-100 hover:border-blue-200 bg-white"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${
          printer.status === 'online' ? 'bg-green-100' : 
          printer.status === 'offline' ? 'bg-gray-100' : 'bg-red-100'
        }`}>
          <Printer className={`h-5 w-5 ${
            printer.status === 'online' ? 'text-green-600' : 
            printer.status === 'offline' ? 'text-gray-500' : 'text-red-600'
          }`} />
        </div>
        <div>
          <div className="font-medium text-gray-900">{printer.name}</div>
          <div className="text-sm text-gray-500">{printer.ip_address}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {printer.location && (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            <MapPin className="h-3 w-3 mr-1" />
            {printer.location}
          </Badge>
        )}
        {showToner && printer.toner_level !== null && printer.toner_level >= 0 && (
          <div className="flex items-center gap-2 min-w-[120px]">
            <Droplet className="h-4 w-4 text-gray-400" />
            <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden w-16">
              <div 
                className={`h-full ${getTonerColor(printer.toner_level)} transition-all`}
                style={{ width: `${printer.toner_level}%` }}
              />
            </div>
            <span className="text-sm font-semibold w-10 text-right">{printer.toner_level}%</span>
          </div>
        )}
        {getStatusBadge(printer.status)}
      </div>
    </Link>
  )

  const StatusSection = ({ title, icon: Icon, iconColor, borderColor, bgColor, printers, section, emptyMessage }) => (
    <Card className={`border-l-4 ${borderColor} shadow-sm`}>
      <CardHeader className={`pb-2 ${bgColor}`}>
        <button 
          onClick={() => toggleSection(section)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className={`p-1.5 rounded-lg ${bgColor}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            {title}
            <Badge className={`ml-2 ${bgColor} ${iconColor} border-0`}>{printers.length}</Badge>
          </CardTitle>
          {expandedSection[section] ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>
      </CardHeader>
      {expandedSection[section] && (
        <CardContent className="pt-2">
          {printers.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {printers.map(printer => (
                <PrinterRow key={printer.id} printer={printer} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  const totalProblems = statusGroups.critical.length + statusGroups.warning.length + 
                        statusGroups.lowToner.length + statusGroups.offline.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Printer Status</h1>
          <p className="text-gray-500">Overview of printer health and issues</p>
        </div>
        <Button onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
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
                🌙 Monitoring Paused — Outside of active hours (Maintenance Window)
              </p>
            </div>
            <p className="text-sm text-orange-700 mt-1 ml-7">
              Status shown reflects last known state. Alerts are suppressed during maintenance.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - Clickeable to filter */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === null ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setStatusFilter(null)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Printers</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{printers.length}</div>
            <p className="text-xs text-muted-foreground">In system</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusGroups.critical.length > 0 ? 'border-red-300' : ''} ${statusFilter === 'critical' ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'critical' ? null : 'critical')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertCircle className={`h-4 w-4 ${statusGroups.critical.length > 0 ? 'text-red-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${statusGroups.critical.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {statusGroups.critical.length}
            </div>
            <p className="text-xs text-muted-foreground">Error or Toner ≤10%</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusGroups.warning.length > 0 ? 'border-yellow-300' : ''} ${statusFilter === 'warning' ? 'ring-2 ring-yellow-500 bg-yellow-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'warning' ? null : 'warning')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${statusGroups.warning.length > 0 ? 'text-yellow-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${statusGroups.warning.length > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
              {statusGroups.warning.length}
            </div>
            <p className="text-xs text-muted-foreground">Toner 20-30%</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusGroups.lowToner.length > 0 ? 'border-orange-300' : ''} ${statusFilter === 'lowToner' ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'lowToner' ? null : 'lowToner')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Toner</CardTitle>
            <TrendingDown className={`h-4 w-4 ${statusGroups.lowToner.length > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${statusGroups.lowToner.length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {statusGroups.lowToner.length}
            </div>
            <p className="text-xs text-muted-foreground">Toner 10-20%</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${statusGroups.offline.length > 0 ? 'border-gray-400' : ''} ${statusFilter === 'offline' ? 'ring-2 ring-gray-500 bg-gray-100' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'offline' ? null : 'offline')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className={`h-4 w-4 ${statusGroups.offline.length > 0 ? 'text-gray-600' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${statusGroups.offline.length > 0 ? 'text-gray-700' : 'text-gray-400'}`}>
              {statusGroups.offline.length}
            </div>
            <p className="text-xs text-muted-foreground">Unreachable</p>
          </CardContent>
        </Card>
      </div>

      {/* Active filter indicator */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            Showing: {statusFilter === 'critical' ? 'Critical issues' : statusFilter === 'warning' ? 'Warning' : statusFilter === 'lowToner' ? 'Low Toner' : 'Offline'}
            <button onClick={() => setStatusFilter(null)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* All Good Message */}
      {totalProblems === 0 && printers.length > 0 && !statusFilter && (
        <Card className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm">
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-800">All Printers Healthy</h3>
            <p className="text-green-600 mt-1">No issues detected. All {printers.length} printers are operating normally.</p>
          </CardContent>
        </Card>
      )}

      {/* Issue Sections - filtered by card clicks */}
      <div className="space-y-4">
        {(statusFilter === null || statusFilter === 'critical') && statusGroups.critical.length > 0 && (
          <StatusSection
            title="Critical Issues"
            icon={AlertCircle}
            iconColor="text-red-600"
            borderColor="border-l-red-500"
            bgColor="bg-red-50"
            printers={statusGroups.critical}
            section="critical"
            emptyMessage="No critical issues"
          />
        )}

        {(statusFilter === null || statusFilter === 'offline') && statusGroups.offline.length > 0 && (
          <StatusSection
            title="Offline Printers"
            icon={WifiOff}
            iconColor="text-gray-600"
            borderColor="border-l-gray-500"
            bgColor="bg-gray-100"
            printers={statusGroups.offline}
            section="offline"
            emptyMessage="All printers online"
          />
        )}

        {(statusFilter === null || statusFilter === 'lowToner') && statusGroups.lowToner.length > 0 && (
          <StatusSection
            title="Low Toner (10-20%)"
            icon={Droplet}
            iconColor="text-orange-600"
            borderColor="border-l-orange-500"
            bgColor="bg-orange-50"
            printers={statusGroups.lowToner}
            section="lowToner"
            emptyMessage="No low toner warnings"
          />
        )}

        {(statusFilter === null || statusFilter === 'warning') && statusGroups.warning.length > 0 && (
          <StatusSection
            title="Toner Warning (20-30%)"
            icon={AlertTriangle}
            iconColor="text-yellow-600"
            borderColor="border-l-yellow-500"
            bgColor="bg-yellow-50"
            printers={statusGroups.warning}
            section="warning"
            emptyMessage="No toner warnings"
          />
        )}
      </div>

      {/* Healthy Printers */}
      {statusGroups.healthy.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2 bg-gray-50">
            <button 
              onClick={() => setExpandedSection(prev => ({ ...prev, healthy: !prev.healthy }))}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                Healthy Printers
                <Badge className="ml-2 bg-green-100 text-green-700 border-0">{statusGroups.healthy.length}</Badge>
              </CardTitle>
              {expandedSection.healthy ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>
          </CardHeader>
          {expandedSection.healthy && (
            <CardContent className="pt-2">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {statusGroups.healthy.map(printer => (
                  <PrinterRow key={printer.id} printer={printer} />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
