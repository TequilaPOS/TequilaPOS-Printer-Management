import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsAPI, printersAPI } from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { FileText, Search, XCircle, RefreshCw, Filter, Calendar, Printer } from 'lucide-react'
import { getStatusColor, formatDate } from '../lib/utils'

export default function Jobs() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [printerFilter, setPrinterFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const { isOperator } = useAuth()
  const { socket } = useSocket()
  const queryClient = useQueryClient()

  // WebSocket real-time job updates
  useEffect(() => {
    if (!socket) return

    const handleJobUpdate = () => {
      queryClient.invalidateQueries(['jobs'])
    }

    socket.on('job:created', handleJobUpdate)
    socket.on('job:updated', handleJobUpdate)
    socket.on('job:completed', handleJobUpdate)
    socket.on('job:failed', handleJobUpdate)

    return () => {
      socket.off('job:created', handleJobUpdate)
      socket.off('job:updated', handleJobUpdate)
      socket.off('job:completed', handleJobUpdate)
      socket.off('job:failed', handleJobUpdate)
    }
  }, [socket, queryClient])

  // Fetch printers for filter
  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', { status: statusFilter, printer: printerFilter, dateFrom, dateTo, page }],
    queryFn: () => jobsAPI.list({ 
      status: statusFilter, 
      printer_id: printerFilter,
      date_from: dateFrom,
      date_to: dateTo,
      page, 
      limit: 50 
    }).then(res => res.data),
    refetchInterval: 120000, // 2 minutes - WebSocket handles real-time
  })

  const cancelJobMutation = useMutation({
    mutationFn: jobsAPI.cancel,
    onSuccess: () => {
      toast.success('Job cancelled')
      queryClient.invalidateQueries(['jobs'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to cancel job')
    }
  })

  const jobs = data?.jobs || []
  const pagination = data?.pagination || {}
  const printers = printersData?.printers || []

  const handleCancel = (job) => {
    if (confirm(`Cancel job "${job.document_name || job.id}"?`)) {
      cancelJobMutation.mutate(job.id)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPrinterFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const filteredJobs = jobs.filter(job => 
    !search || 
    job.document_name?.toLowerCase().includes(search.toLowerCase()) ||
    job.printer_name?.toLowerCase().includes(search.toLowerCase())
  )

  const hasFilters = statusFilter || printerFilter || dateFrom || dateTo

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Print Jobs</h1>
          <p className="text-muted-foreground">Monitor and manage print jobs</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
                Clear Filters
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search document name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Printer Filter */}
            <select
              value={printerFilter}
              onChange={(e) => { setPrinterFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Printers</option>
              {printers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="printing">Printing</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Date Filter */}
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                placeholder="From"
                className="text-sm"
              />
            </div>
          </div>
          
          {/* Second row for date to */}
          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Date Range:</span>
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              placeholder="From"
              className="w-40 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              placeholder="To"
              className="w-40 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Jobs ({pagination.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No jobs found</p>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {job.document_name || `Job #${job.id}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {job.printer_name} • {job.pages || 0} pages • {formatDate(job.submitted_at)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                    
                    {isOperator && ['pending', 'printing'].includes(job.status) && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleCancel(job)}
                        className="text-destructive hover:text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm">
                Page {page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.pages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
