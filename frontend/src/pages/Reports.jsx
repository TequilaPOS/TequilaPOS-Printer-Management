import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsAPI, printersAPI } from '../api/axios'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { formatDateShort } from '../lib/utils'
import { toast } from 'sonner'
import { 
  BarChart3, 
  TrendingUp, 
  Printer, 
  FileText,
  Calendar,
  Download,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileType
} from 'lucide-react'

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(getDateDaysAgo(30))
  const [dateTo, setDateTo] = useState(getToday())
  const [selectedPrinter, setSelectedPrinter] = useState('')
  const [groupBy, setGroupBy] = useState('day')
  const [showFilters, setShowFilters] = useState(true)
  const [printerLimit, setPrinterLimit] = useState(10) // Pagination for printers
  const [exporting, setExporting] = useState(false)

  // Export function
  const handleExport = async (format = 'excel', type = 'jobs') => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        type,
        format,
        date_from: dateFrom,
        date_to: dateTo
      })
      
      const response = await fetch(`/api/reports/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) throw new Error('Export failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extensions = { excel: 'xlsx', csv: 'csv', pdf: 'pdf' }
      a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.${extensions[format] || format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      
      toast.success(`Report exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error('Failed to export report')
      console.error('Export error:', error)
    } finally {
      setExporting(false)
    }
  }

  function getDateDaysAgo(days) {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date.toISOString().split('T')[0]
  }

  function getToday() {
    return new Date().toISOString().split('T')[0]
  }

  // Fetch summary
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['summary'],
    queryFn: () => reportsAPI.getSummary().then(res => res.data),
  })

  // Fetch printers for filter
  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
  })

  // Fetch usage data with filters
  const { data: usageData, isLoading: loadingUsage, refetch: refetchUsage } = useQuery({
    queryKey: ['usage', dateFrom, dateTo, groupBy],
    queryFn: () => reportsAPI.getUsage({ 
      date_from: dateFrom, 
      date_to: dateTo,
      group_by: groupBy
    }).then(res => res.data),
  })

  // Fetch printer-specific report if selected
  const { data: printerReport, isLoading: loadingPrinter } = useQuery({
    queryKey: ['printer-report', selectedPrinter, dateFrom, dateTo],
    queryFn: () => reportsAPI.getPrinterReport(selectedPrinter, { 
      period: '30d',
      date_from: dateFrom,
      date_to: dateTo
    }).then(res => res.data),
    enabled: !!selectedPrinter,
  })

  const printers = printersData?.printers || []
  const usage = usageData?.usage || []
  const byPrinter = usageData?.byPrinter || []

  // Calculate totals
  const totalJobs = usage.reduce((sum, u) => sum + (parseInt(u.total_jobs) || 0), 0)
  const totalPages = usage.reduce((sum, u) => sum + (parseInt(u.pages) || 0), 0)
  const totalCompleted = usage.reduce((sum, u) => sum + (parseInt(u.completed) || 0), 0)
  const totalErrors = usage.reduce((sum, u) => sum + (parseInt(u.errors) || 0), 0)
  const successRate = totalJobs > 0 ? ((totalCompleted / totalJobs) * 100).toFixed(1) : 100

  const handleRefresh = () => {
    refetchSummary()
    refetchUsage()
  }

  const handleQuickRange = (days) => {
    setDateFrom(getDateDaysAgo(days))
    setDateTo(getToday())
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Printer usage statistics and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('pdf', 'jobs')}
            disabled={exporting}
          >
            <FileType className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('excel', 'jobs')}
            disabled={exporting}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('csv', 'jobs')}
            disabled={exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            {/* Quick Range Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground self-center mr-2">Quick:</span>
              <Button size="sm" variant="outline" onClick={() => handleQuickRange(7)}>Last 7 days</Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickRange(14)}>Last 14 days</Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickRange(30)}>Last 30 days</Button>
              <Button size="sm" variant="outline" onClick={() => handleQuickRange(90)}>Last 90 days</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              {/* Date From */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>

              {/* Printer Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Printer</label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">All Printers</option>
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Group By */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Group By</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Period Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalJobs.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCompleted.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPages.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Pages Printed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${totalErrors > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <FileText className={`h-5 w-5 ${totalErrors > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalErrors}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${parseFloat(successRate) >= 90 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <TrendingUp className={`h-5 w-5 ${parseFloat(successRate) >= 90 ? 'text-green-600' : 'text-yellow-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{successRate}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Timeline</CardTitle>
          <CardDescription>
            {dateFrom} to {dateTo} • Grouped by {groupBy}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsage ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : usage.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No print jobs in selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Period</th>
                    <th className="text-right py-3 px-4 font-medium">Jobs</th>
                    <th className="text-right py-3 px-4 font-medium">Completed</th>
                    <th className="text-right py-3 px-4 font-medium">Errors</th>
                    <th className="text-right py-3 px-4 font-medium">Pages</th>
                    <th className="text-right py-3 px-4 font-medium">Printers Used</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4 font-mono">{formatDateShort(row.period)}</td>
                      <td className="py-3 px-4 text-right">{row.total_jobs}</td>
                      <td className="py-3 px-4 text-right text-green-600">{row.completed}</td>
                      <td className="py-3 px-4 text-right text-red-600">{row.errors || 0}</td>
                      <td className="py-3 px-4 text-right">{row.pages || 0}</td>
                      <td className="py-3 px-4 text-right">{row.printers_used}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-semibold">
                  <tr>
                    <td className="py-3 px-4">Total</td>
                    <td className="py-3 px-4 text-right">{totalJobs}</td>
                    <td className="py-3 px-4 text-right text-green-600">{totalCompleted}</td>
                    <td className="py-3 px-4 text-right text-red-600">{totalErrors}</td>
                    <td className="py-3 px-4 text-right">{totalPages}</td>
                    <td className="py-3 px-4 text-right">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage by Printer */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Printer</CardTitle>
          <CardDescription>Job distribution across printers for selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {byPrinter.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Printer className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No printer usage data</p>
            </div>
          ) : (
            <div className="space-y-4">
              {byPrinter.slice(0, printerLimit).map((printer, index) => {
                const maxJobs = Math.max(...byPrinter.map(p => parseInt(p.jobs) || 0))
                const percentage = maxJobs > 0 ? ((parseInt(printer.jobs) || 0) / maxJobs) * 100 : 0
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Printer className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{printer.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{printer.jobs} jobs</span>
                        <span className="text-muted-foreground">{printer.pages || 0} pages</span>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              
              {/* Load More / Show Less */}
              {byPrinter.length > 10 && (
                <div className="flex justify-center pt-4 gap-2">
                  {printerLimit < byPrinter.length && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setPrinterLimit(prev => prev + 10)}
                    >
                      Load More ({byPrinter.length - printerLimit} remaining)
                    </Button>
                  )}
                  {printerLimit > 10 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setPrinterLimit(10)}
                    >
                      Show Less
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Printer Details */}
      {selectedPrinter && printerReport && (
        <Card>
          <CardHeader>
            <CardTitle>
              Printer Details: {printers.find(p => p.id === parseInt(selectedPrinter))?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPrinter ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{printerReport.summary?.total_jobs || 0}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Pages</p>
                  <p className="text-2xl font-bold">{printerReport.summary?.total_pages || 0}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">{printerReport.summary?.success_rate || 100}%</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-xl font-bold">{summary?.today?.total || 0} jobs</p>
              <p className="text-sm text-muted-foreground">{summary?.today?.total_pages || 0} pages</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">This Week</p>
              <p className="text-xl font-bold">{summary?.week?.total || 0} jobs</p>
              <p className="text-sm text-muted-foreground">{summary?.week?.total_pages || 0} pages</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-xl font-bold">{summary?.month?.total || 0} jobs</p>
              <p className="text-sm text-muted-foreground">{summary?.month?.total_pages || 0} pages</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Online Printers</p>
              <p className="text-xl font-bold text-green-600">
                {summary?.printers?.online || 0} / {summary?.printers?.total || 0}
              </p>
              <Badge variant={summary?.printers?.online === summary?.printers?.total ? 'default' : 'secondary'}>
                {summary?.printers?.online === summary?.printers?.total ? 'All Online' : 'Some Offline'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
