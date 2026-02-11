import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Switch } from '../components/ui/switch'
import api, { printersAPI } from '../api/axios'
import { toast } from 'sonner'
import { 
  Clock, 
  Calendar, 
  Moon, 
  Sun, 
  Save,
  Power,
  AlertCircle,
  CheckCircle,
  Info,
  Wrench,
  Printer,
  X
} from 'lucide-react'

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

export default function Maintenance() {
  const [schedule, setSchedule] = useState({
    name: 'Default Schedule',
    description: '',
    is_active: false,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_time: '06:00',
    end_time: '20:00',
    timezone: 'America/Bogota'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isMonitoringActive, setIsMonitoringActive] = useState(true)
  const queryClient = useQueryClient()

  // Fetch printers in maintenance
  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
    refetchInterval: 30000,
  })

  const printersInMaintenance = (printersData?.printers || []).filter(p => p.in_maintenance)

  useEffect(() => {
    fetchSchedule()
    checkMonitoringStatus()
    
    // Check status every minute
    const interval = setInterval(checkMonitoringStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchSchedule = async () => {
    try {
      const res = await api.get('/maintenance/schedule')
      // Format times for input (remove seconds)
      const data = {
        ...res.data,
        start_time: res.data.start_time?.substring(0, 5) || '06:00',
        end_time: res.data.end_time?.substring(0, 5) || '20:00'
      }
      setSchedule(data)
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkMonitoringStatus = async () => {
    try {
      const res = await api.get('/maintenance/is-active')
      setIsMonitoringActive(res.data.isActive)
    } catch (error) {
      console.error('Error checking monitoring status:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Format times to include seconds
      const payload = {
        ...schedule,
        start_time: schedule.start_time + ':00',
        end_time: schedule.end_time + ':00'
      }
      await api.put('/maintenance/schedule', payload)
      toast.success('Maintenance schedule saved')
      checkMonitoringStatus()
    } catch (error) {
      toast.error('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (enabled) => {
    try {
      await api.post('/maintenance/toggle', { is_active: enabled })
      setSchedule(prev => ({ ...prev, is_active: enabled }))
      toast.success(enabled ? 'Maintenance schedule enabled' : 'Maintenance schedule disabled')
      checkMonitoringStatus()
    } catch (error) {
      toast.error('Failed to toggle schedule')
    }
  }

  const toggleDay = (day) => {
    setSchedule(prev => ({ ...prev, [day]: !prev[day] }))
  }

  const endPrinterMaintenance = async (printer) => {
    try {
      await api.put(`/printers/${printer.id}/maintenance`, { enabled: false })
      toast.success(`${printer.name} maintenance ended`)
      queryClient.invalidateQueries(['printers'])
    } catch (error) {
      toast.error('Failed to end maintenance')
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Unknown'
    return new Date(date).toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  }

  const getCurrentTimeInfo = () => {
    const now = new Date()
    const currentTime = now.toTimeString().substring(0, 5)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = dayNames[now.getDay()]
    return { currentTime, currentDay }
  }

  const { currentTime, currentDay } = getCurrentTimeInfo()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Maintenance Schedule</h1>
        <p className="text-muted-foreground">
          Configure active monitoring hours to prevent false offline alerts during off-hours
        </p>
      </div>

      {/* Current Status */}
      <Card className={isMonitoringActive ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isMonitoringActive ? (
                <div className="p-3 bg-green-500 rounded-full">
                  <Sun className="h-6 w-6 text-white" />
                </div>
              ) : (
                <div className="p-3 bg-orange-500 rounded-full">
                  <Moon className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">
                  {isMonitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Current time: {currentTime} ({currentDay.charAt(0).toUpperCase() + currentDay.slice(1)})
                </p>
              </div>
            </div>
            <Badge variant={isMonitoringActive ? 'default' : 'secondary'} className="text-lg px-4 py-2">
              {isMonitoringActive ? (
                <><CheckCircle className="h-4 w-4 mr-2" /> Active</>
              ) : (
                <><Moon className="h-4 w-4 mr-2" /> Off-Hours</>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Schedule Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Active Hours
                </CardTitle>
                <CardDescription>
                  Printers will only be checked during these hours
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="schedule-active" className="text-sm">Enable</Label>
                <Switch
                  id="schedule-active"
                  checked={schedule.is_active}
                  onCheckedChange={handleToggle}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Schedule Name */}
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input
                value={schedule.name}
                onChange={(e) => setSchedule(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Office Hours"
              />
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-yellow-500" />
                  Start Time
                </Label>
                <Input
                  type="time"
                  value={schedule.start_time}
                  onChange={(e) => setSchedule(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-blue-500" />
                  End Time
                </Label>
                <Input
                  type="time"
                  value={schedule.end_time}
                  onChange={(e) => setSchedule(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            {/* Active Days */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Active Days
              </Label>
              <div className="flex gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.key}
                    onClick={() => toggleDay(day.key)}
                    className={`flex-1 py-2 px-1 text-sm font-medium rounded-lg border-2 transition-all ${
                      schedule[day.key]
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-gray-300'
                    } ${day.key === currentDay ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={schedule.description || ''}
                onChange={(e) => setSchedule(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Monitor during business hours only"
              />
            </div>

            {/* Save Button */}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Schedule'}
            </Button>
          </CardContent>
        </Card>

        {/* Info Panel */}
        <div className="space-y-6">
          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Sun className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Active Hours</p>
                  <p className="text-xs text-muted-foreground">
                    During active hours, printers are monitored normally. Offline printers will show as red.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Moon className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Off-Hours (Maintenance)</p>
                  <p className="text-xs text-muted-foreground">
                    Outside active hours, monitoring is paused. Printers keep their last known status.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">No False Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    This prevents the dashboard from showing all printers as offline when they're intentionally powered off.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-500" />
                Schedule Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule.is_active ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Monitoring active:</span>
                    <span className="font-mono font-bold">
                      {schedule.start_time} - {schedule.end_time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Days:</span>
                    <span className="font-medium">
                      {DAYS.filter(d => schedule[d.key]).map(d => d.label).join(', ') || 'None'}
                    </span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-muted-foreground">
                      <strong>Monitoring paused:</strong> {schedule.end_time} to {schedule.start_time} (next day)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Power className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-muted-foreground">
                    Schedule is disabled. Monitoring is always active.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Presets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setSchedule(prev => ({
                  ...prev,
                  start_time: '06:00',
                  end_time: '20:00',
                  monday: true, tuesday: true, wednesday: true, thursday: true, friday: true,
                  saturday: false, sunday: false
                }))}
              >
                🏢 Office Hours (Mon-Fri 6AM-8PM)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setSchedule(prev => ({
                  ...prev,
                  start_time: '08:00',
                  end_time: '18:00',
                  monday: true, tuesday: true, wednesday: true, thursday: true, friday: true,
                  saturday: false, sunday: false
                }))}
              >
                ⏰ Standard (Mon-Fri 8AM-6PM)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => setSchedule(prev => ({
                  ...prev,
                  start_time: '00:00',
                  end_time: '23:59',
                  monday: true, tuesday: true, wednesday: true, thursday: true, friday: true,
                  saturday: true, sunday: true
                }))}
              >
                🔄 24/7 Monitoring
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Individual Printer Maintenance */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Wrench className="h-5 w-5" />
            Printers in Maintenance ({printersInMaintenance.length})
          </CardTitle>
          <CardDescription>
            Individual printers currently under maintenance. These won't trigger alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {printersInMaintenance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Printer className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No printers are currently in maintenance mode</p>
              <p className="text-sm mt-1">Use the wrench icon on any printer card to put it in maintenance</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Printer</th>
                    <th className="text-left py-3 px-4 font-medium">IP Address</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Reason</th>
                    <th className="text-left py-3 px-4 font-medium">Since</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {printersInMaintenance.map(printer => (
                    <tr key={printer.id} className="border-b hover:bg-orange-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Printer className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{printer.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {printer.ip_address}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={printer.status === 'online' ? 'default' : 'destructive'}>
                          {printer.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {printer.maintenance_note || <span className="text-muted-foreground italic">No reason provided</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatDate(printer.updated_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => endPrinterMaintenance(printer)}
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                          <X className="h-4 w-4 mr-1" />
                          End
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
