import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { printersAPI, reportsAPI, jobsAPI } from '../api/axios'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  ArrowLeft, 
  Printer, 
  MapPin, 
  Wifi, 
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Activity,
  Droplets,
  FileStack,
  Hash,
  RefreshCw
} from 'lucide-react'
import { getStatusColor, formatDate } from '../lib/utils'

export default function PrinterDetail() {
  const { id } = useParams()

  const { data: printer, isLoading } = useQuery({
    queryKey: ['printer', id],
    queryFn: () => printersAPI.get(id).then(res => res.data),
    refetchInterval: 30000,
  })

  const { data: report } = useQuery({
    queryKey: ['printer-report', id],
    queryFn: () => reportsAPI.getPrinterReport(id, { period: '7d' }).then(res => res.data),
    enabled: !!id,
  })

  // SNMP data
  const { data: snmpData, isLoading: loadingSnmp, refetch: refetchSnmp } = useQuery({
    queryKey: ['printer-snmp', id],
    queryFn: () => printersAPI.getSnmp(id).then(res => res.data),
    enabled: !!id,
    refetchInterval: 60000, // Every minute
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!printer) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Printer not found</h2>
        <Button asChild className="mt-4">
          <Link to="/">Go back</Link>
        </Button>
      </div>
    )
  }

  const stats = report?.stats || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{printer.name}</h1>
            <Badge className={getStatusColor(printer.status)}>
              {printer.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">{printer.cups_name}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Wifi className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">IP Address</p>
              <p className="font-medium">{printer.ip_address}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Printer className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Protocol</p>
              <p className="font-medium uppercase">{printer.protocol || 'IPP'}</p>
            </div>
          </CardContent>
        </Card>
        
        {printer.location && (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{printer.location}</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Last Check</p>
              <p className="font-medium">{formatDate(printer.last_check)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SNMP Metrics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              SNMP Metrics
              {snmpData?.snmp?.online && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Online
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchSnmp()} disabled={loadingSnmp}>
              <RefreshCw className={`h-4 w-4 ${loadingSnmp ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSnmp ? (
            <div className="text-center py-4 text-muted-foreground">Loading SNMP data...</div>
          ) : !snmpData?.snmp ? (
            <div className="text-center py-4 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>SNMP not available for this printer</p>
              <p className="text-sm">Make sure SNMP is enabled on the printer</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Page Count & Serial */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <FileStack className="h-4 w-4" />
                    <span className="text-sm font-medium">Page Count</span>
                  </div>
                  <p className="text-2xl font-bold">{snmpData.snmp.pageCount?.toLocaleString() || 'N/A'}</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Hash className="h-4 w-4" />
                    <span className="text-sm font-medium">Serial Number</span>
                  </div>
                  <p className="text-lg font-mono">{snmpData.snmp.serialNumber || 'N/A'}</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Printer className="h-4 w-4" />
                    <span className="text-sm font-medium">Model</span>
                  </div>
                  <p className="text-sm font-medium">{snmpData.snmp.model || printer.model || 'Unknown'}</p>
                </div>
              </div>
              
              {/* Toner/Supplies */}
              {snmpData.snmp.supplies?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Droplets className="h-4 w-4" />
                    Supplies / Toner
                  </h4>
                  <div className="space-y-3">
                    {snmpData.snmp.supplies.map((supply, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: supply.colorHex || '#000' }}
                            />
                            {supply.name || `${supply.color || supply.type} ${supply.type}`}
                          </span>
                          <span className="font-medium">
                            {supply.percent >= 0 ? `${supply.percent}%` : supply.status || 'Unknown'}
                          </span>
                        </div>
                        {supply.percent >= 0 && (
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                supply.percent > 20 ? 'bg-green-500' : 
                                supply.percent > 10 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.max(supply.percent, 2)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Paper Trays - filter out SNMP errors */}
              {snmpData.snmp.paperTrays?.filter(t => 
                t.name && !t.name.includes('No Such Object') && !t.name.includes('noSuchObject')
              ).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Paper Trays</h4>
                  <div className="grid gap-2 md:grid-cols-2">
                    {snmpData.snmp.paperTrays
                      .filter(t => t.name && !t.name.includes('No Such Object') && !t.name.includes('noSuchObject'))
                      .map((tray, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{tray.name}</span>
                          <Badge variant={tray.status === 'ok' ? 'outline' : 'destructive'} className="text-xs">
                            {tray.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tray.mediaName} • Capacity: {tray.maxCapacity}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Last 7 Days Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-3xl font-bold">{stats.total_jobs || 0}</p>
              <p className="text-sm text-muted-foreground">Total Jobs</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{stats.successful || 0}</p>
              <p className="text-sm text-muted-foreground">Successful</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-600">{stats.failed || 0}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-3xl font-bold text-blue-600">{stats.total_pages || 0}</p>
              <p className="text-sm text-muted-foreground">Pages Printed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {printer.recentJobs?.length > 0 ? (
            <div className="space-y-2">
              {printer.recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{job.document_name || 'Unknown document'}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.pages || 0} pages • {formatDate(job.submitted_at)}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No recent jobs</p>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      {(printer.manufacturer || printer.model || printer.description) && (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {printer.manufacturer && (
              <p><span className="text-muted-foreground">Manufacturer:</span> {printer.manufacturer}</p>
            )}
            {printer.model && (
              <p><span className="text-muted-foreground">Model:</span> {printer.model}</p>
            )}
            {printer.description && (
              <p><span className="text-muted-foreground">Description:</span> {printer.description}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
