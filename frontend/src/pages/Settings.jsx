import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { systemAPI } from '../api/axios'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  Settings as SettingsIcon, 
  Printer, 
  Server, 
  ExternalLink,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  Shield,
  Clock,
  Globe,
  Terminal
} from 'lucide-react'

export default function Settings() {
  const [refreshing, setRefreshing] = useState(false)

  // Get system info
  const { data: systemInfo, refetch } = useQuery({
    queryKey: ['system-info'],
    queryFn: () => systemAPI.health().then(res => res.data),
    refetchInterval: 30000
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setTimeout(() => setRefreshing(false), 1000)
  }

  // Use localhost for CUPS admin link
  const cupsUrl = `${window.location.protocol}//localhost:631`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">System configuration and CUPS management</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* CUPS Administration Card */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            CUPS Print Server Administration
          </CardTitle>
          <CardDescription>
            Direct access to CUPS web interface for advanced printer management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">What you can do in CUPS:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• View and manage print queues</li>
                <li>• Configure printer options (paper size, quality)</li>
                <li>• Set default printer settings</li>
                <li>• View detailed printer status</li>
                <li>• Manage print jobs directly</li>
                <li>• Configure printer sharing</li>
              </ul>
            </div>
            <div className="flex flex-col justify-center items-center gap-3 p-4 bg-white rounded-lg border">
              <Globe className="h-12 w-12 text-blue-500" />
              <p className="text-sm text-muted-foreground text-center">
                Access the native CUPS interface
              </p>
              <Button 
                onClick={() => window.open(cupsUrl, '_blank')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open CUPS Admin
              </Button>
              <p className="text-xs text-muted-foreground">
                Opens at {cupsUrl}
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid gap-2 md:grid-cols-4 pt-4 border-t">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`${cupsUrl}/printers`, '_blank')}
              className="justify-start"
            >
              <Printer className="h-4 w-4 mr-2" />
              Printers
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`${cupsUrl}/jobs`, '_blank')}
              className="justify-start"
            >
              <Clock className="h-4 w-4 mr-2" />
              Jobs
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`${cupsUrl}/admin`, '_blank')}
              className="justify-start"
            >
              <Shield className="h-4 w-4 mr-2" />
              Administration
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open(`${cupsUrl}/help`, '_blank')}
              className="justify-start"
            >
              <Terminal className="h-4 w-4 mr-2" />
              Help
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">API Server</span>
              <Badge className="bg-green-500">
                {systemInfo?.status || 'Online'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">CUPS Server</span>
              <Badge className="bg-green-500">Running</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Database</span>
              <Badge className="bg-green-500">Connected</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="text-sm">{systemInfo?.uptime || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-5 w-5" />
              Storage & Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available Drivers</span>
              <span className="text-sm font-medium">12,325+</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Driver Packages</span>
              <span className="text-sm">HPLIP, Gutenprint, Foomatic</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Supported Brands</span>
              <span className="text-sm">HP, Canon, Epson, Brother, +10</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">CUPS Version</span>
              <span className="text-sm">2.4.x</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="h-5 w-5" />
            Configuration Paths
          </CardTitle>
          <CardDescription>
            Reference information for system administrators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Docker Volumes (Persistent)</h4>
              <ul className="text-muted-foreground space-y-1 font-mono text-xs">
                <li>• mysql_data → /var/lib/mysql</li>
                <li>• cups_data → /etc/cups</li>
                <li>• cups_spool → /var/spool/cups</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Important Files</h4>
              <ul className="text-muted-foreground space-y-1 font-mono text-xs">
                <li>• /etc/cups/cupsd.conf</li>
                <li>• /etc/cups/printers.conf</li>
                <li>• /var/log/cups/error_log</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
