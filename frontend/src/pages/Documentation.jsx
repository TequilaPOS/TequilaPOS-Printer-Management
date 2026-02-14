import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { 
  BookOpen, 
  Code, 
  Printer,
  Search,
  Plus,
  Settings,
  BarChart3,
  Users,
  Bell,
  FileText,
  Network,
  Activity,
  Server,
  Database,
  HardDrive,
  Terminal,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Gauge,
  Send,
  Radar,
  Shield,
  Copy,
  ExternalLink,
  Globe
} from 'lucide-react'

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('user') // 'user' or 'technical'
  const [copiedCode, setCopiedCode] = useState(null)

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const CodeBlock = ({ code, id, language = 'bash' }) => (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground">Complete guide for the Printer Management System</p>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 border-b pb-4">
        <Button 
          variant={activeTab === 'user' ? 'default' : 'outline'}
          onClick={() => setActiveTab('user')}
          className="gap-2"
        >
          <BookOpen className="h-4 w-4" />
          User Manual
        </Button>
        <Button 
          variant={activeTab === 'technical' ? 'default' : 'outline'}
          onClick={() => setActiveTab('technical')}
          className="gap-2"
        >
          <Code className="h-4 w-4" />
          Technical Guide
        </Button>
        <Button 
          variant={activeTab === 'api' ? 'default' : 'outline'}
          onClick={() => setActiveTab('api')}
          className="gap-2"
        >
          <Globe className="h-4 w-4" />
          API Guide
        </Button>
      </div>

      {/* USER MANUAL */}
      {activeTab === 'user' && (
        <div className="space-y-6">
          {/* Introduction */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-6 w-6" />
                Printer Management System
              </CardTitle>
              <CardDescription className="text-blue-100">
                Enterprise Network Printer Administration
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-600 mb-6">
                A comprehensive web-based solution for managing network printers in enterprise environments. 
                Centralized control over printer discovery, monitoring, printing, and reporting.
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Radar, title: 'Auto Discovery', desc: 'Network scanning', color: 'bg-blue-500' },
                  { icon: Activity, title: 'Real-time Monitor', desc: 'SNMP status', color: 'bg-green-500' },
                  { icon: AlertCircle, title: 'Toner Alerts', desc: 'Low level warnings', color: 'bg-orange-500' },
                  { icon: Send, title: 'Web Printing', desc: 'Upload & print', color: 'bg-purple-500' },
                  { icon: BarChart3, title: 'Reports', desc: 'Job history', color: 'bg-cyan-500' },
                  { icon: Users, title: 'User Management', desc: 'Role-based access', color: 'bg-pink-500' },
                  { icon: Printer, title: '12,000+ Drivers', desc: 'Auto-selection', color: 'bg-emerald-500' },
                  { icon: Shield, title: 'Secure', desc: 'JWT + HTTPS', color: 'bg-red-500' },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className={`${feature.color} p-2 rounded-lg`}>
                      <feature.icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-700">{feature.title}</p>
                      <p className="text-xs text-gray-500">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Module */}
          <Card>
            <CardHeader className="border-b bg-blue-50">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Activity className="h-5 w-5" />
                Dashboard
              </CardTitle>
              <CardDescription>Main overview of all printers and system status</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                The Dashboard provides a real-time overview of all printers in your network.
              </p>
              
              <h4 className="font-semibold">Features:</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Status Cards:</strong> Click on Total/Online/Offline cards to filter printers by status</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Search:</strong> Search by printer name, IP address, location, or tags</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Filter by Location/Tag:</strong> Use dropdown filters to group printers</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Bulk Operations:</strong> Select multiple printers to assign tags or locations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><strong>Printer Cards:</strong> View status, toner levels, model info. Click to see details or edit</span>
                </li>
              </ul>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> Printers with SNMP enabled show real-time toner levels and page counts.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Adding Printers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-500" />
                Adding Printers
              </CardTitle>
              <CardDescription>Two methods to add printers to the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Method 1: Manual Addition</h4>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Go to <strong>Dashboard</strong></li>
                <li>Click the <Badge variant="outline">+ Add Printer</Badge> button</li>
                <li>Enter the printer's IP address</li>
                <li>The system will automatically:
                  <ul className="ml-6 mt-1 space-y-1 list-disc">
                    <li>Detect manufacturer and model via SNMP</li>
                    <li>Select the best matching driver (from 12,000+ available)</li>
                    <li>Configure the print queue</li>
                  </ul>
                </li>
                <li>Optionally add: Name, Location, Tags</li>
                <li>Click <strong>Add Printer</strong></li>
              </ol>

              <h4 className="font-semibold mt-6">Method 2: Network Discovery (Admin)</h4>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Go to <strong>Admin → Discovery</strong></li>
                <li>Enter the IP range to scan (e.g., <code>192.168.1.1-254</code>)</li>
                <li>Click <strong>Start Discovery</strong></li>
                <li>The system scans for devices with open printer ports (9100, 631, 515)</li>
                <li>Review discovered printers</li>
                <li>Click <strong>Add</strong> on each printer you want to add</li>
              </ol>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Discovery requires Admin privileges and may take 1-5 minutes depending on the IP range.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Status Module */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Status & Alerts
              </CardTitle>
              <CardDescription>Monitor printer health and issues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Status page groups printers by their health status for quick issue identification.
              </p>
              
              <h4 className="font-semibold">Status Categories:</h4>
              <div className="grid gap-2">
                <div className="flex items-center gap-3 p-2 rounded bg-red-50 border border-red-200">
                  <Badge className="bg-red-500">Critical</Badge>
                  <span className="text-sm">Error state or toner ≤10%</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-orange-50 border border-orange-200">
                  <Badge className="bg-orange-500">Low Toner</Badge>
                  <span className="text-sm">Toner level 10-20%</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-yellow-50 border border-yellow-200">
                  <Badge className="bg-yellow-500">Warning</Badge>
                  <span className="text-sm">Toner level 20-30%</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-gray-100 border border-gray-300">
                  <Badge variant="secondary">Offline</Badge>
                  <span className="text-sm">Printer not reachable on network</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded bg-green-50 border border-green-200">
                  <Badge className="bg-green-500">Healthy</Badge>
                  <span className="text-sm">Online with toner &gt;30%</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                Click on the status cards at the top to filter and show only printers in that category.
              </p>
            </CardContent>
          </Card>

          {/* Print Module */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-purple-500" />
                Printing
              </CardTitle>
              <CardDescription>How to print files and documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Printing a File:</h4>
              <ol className="text-sm space-y-2 list-decimal list-inside">
                <li>Go to <strong>Print</strong> page</li>
                <li>Select a printer from the list (click on printer card)</li>
                <li>Choose print mode:
                  <ul className="ml-6 mt-1 space-y-1 list-disc">
                    <li><strong>File Upload:</strong> PDF, TXT, DOC, DOCX, images</li>
                    <li><strong>Text Input:</strong> Type or paste text directly</li>
                  </ul>
                </li>
                <li>Configure options: Copies, Color/B&W, Duplex, Paper Size</li>
                <li>Click <strong>Print</strong></li>
              </ol>

              <h4 className="font-semibold mt-4">Supported File Formats:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">PDF</Badge>
                <Badge variant="outline">TXT</Badge>
                <Badge variant="outline">DOC/DOCX</Badge>
                <Badge variant="outline">XLS/XLSX</Badge>
                <Badge variant="outline">JPG/PNG</Badge>
                <Badge variant="outline">GIF</Badge>
                <Badge variant="outline">PostScript</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Architecture */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5 text-cyan-500" />
                Architecture View
              </CardTitle>
              <CardDescription>Visualize your printer infrastructure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Architecture page provides different views of your printer network.
              </p>
              
              <h4 className="font-semibold">View Modes:</h4>
              <ul className="text-sm space-y-2">
                <li><strong>Topology:</strong> Visual network diagram showing server and connected printers</li>
                <li><strong>List:</strong> Traditional table view with all printer details</li>
                <li><strong>Grid:</strong> Card-based layout grouped by location, tag, or status</li>
              </ul>

              <h4 className="font-semibold mt-4">Grouping Options:</h4>
              <ul className="text-sm space-y-1">
                <li>• Group by Location (Floor 1, Floor 2, etc.)</li>
                <li>• Group by Tag (Marketing, IT, HR, etc.)</li>
                <li>• Group by Status (Online, Offline)</li>
              </ul>
            </CardContent>
          </Card>

          {/* Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                Reports & Analytics
              </CardTitle>
              <CardDescription>Usage statistics and data export</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Available Reports:</h4>
              <ul className="text-sm space-y-2">
                <li><strong>Usage Over Time:</strong> Chart showing print jobs per day/week/month</li>
                <li><strong>By Printer:</strong> Jobs and pages per printer</li>
                <li><strong>Summary Stats:</strong> Total jobs, pages, success rate</li>
              </ul>

              <h4 className="font-semibold mt-4">Filters:</h4>
              <ul className="text-sm space-y-1">
                <li>• Date range selection</li>
                <li>• Quick presets: Last 7, 14, 30, 90 days</li>
                <li>• Filter by specific printer</li>
              </ul>

              <h4 className="font-semibold mt-4">Export Options:</h4>
              <div className="flex gap-2">
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" /> Excel (.xlsx)
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" /> CSV
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Admin Modules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-red-500" />
                Admin Modules
              </CardTitle>
              <CardDescription>Administrative functions (Admin role required)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Radar className="h-4 w-4" /> Discovery
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Scan IP ranges to find printers on the network. Configure scan settings and view discovery history.
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" /> User Management
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create, edit, and delete users. Assign roles: Admin, Operator, User.
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Gauge className="h-4 w-4" /> Quotas
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set print quotas per user or department. Monitor usage against limits.
                  </p>
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> System Logs
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    View all system events: printer additions, print jobs, user actions, errors.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-500" />
                Settings
              </CardTitle>
              <CardDescription>System configuration and CUPS access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The Settings page provides access to system configuration and the CUPS print server interface.
              </p>

              <h4 className="font-semibold">CUPS Administration:</h4>
              <p className="text-sm text-muted-foreground">
                Click "Open CUPS Admin" to access the native CUPS web interface for advanced printer configuration:
              </p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• Configure printer options (paper trays, default settings)</li>
                <li>• Manage print queues directly</li>
                <li>• View CUPS logs</li>
                <li>• Configure printer sharing</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TECHNICAL GUIDE */}
      {activeTab === 'technical' && (
        <div className="space-y-6">
          
          {/* ============================================ */}
          {/* REQUEST TO RESULT FLOW */}
          {/* ============================================ */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <span className="text-xl">⚡</span>
                Request to Result Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Flow Diagram */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
                {/* User Request */}
                <div className="flex flex-col items-center p-4 bg-blue-500 text-white rounded-xl min-w-[120px] shadow-lg">
                  <Globe className="h-8 w-8 mb-2" />
                  <span className="font-semibold text-sm">User Request</span>
                  <span className="text-xs text-blue-100">Browser/API</span>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-400" />
                
                {/* Nginx */}
                <div className="flex flex-col items-center p-4 bg-cyan-500 text-white rounded-xl min-w-[120px] shadow-lg">
                  <Shield className="h-8 w-8 mb-2" />
                  <span className="font-semibold text-sm">NGINX</span>
                  <span className="text-xs text-cyan-100">SSL + Proxy</span>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-400" />
                
                {/* Backend API */}
                <div className="flex flex-col items-center p-4 bg-green-500 text-white rounded-xl min-w-[120px] shadow-lg">
                  <Server className="h-8 w-8 mb-2" />
                  <span className="font-semibold text-sm">Backend API</span>
                  <span className="text-xs text-green-100">Port 3000</span>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-400" />
                
                {/* CUPS */}
                <div className="flex flex-col items-center p-4 bg-orange-500 text-white rounded-xl min-w-[120px] shadow-lg">
                  <Printer className="h-8 w-8 mb-2" />
                  <span className="font-semibold text-sm">CUPS Server</span>
                  <span className="text-xs text-orange-100">Port 631</span>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-400" />
                
                {/* Printer */}
                <div className="flex flex-col items-center p-4 bg-emerald-500 text-white rounded-xl min-w-[120px] shadow-lg">
                  <CheckCircle className="h-8 w-8 mb-2" />
                  <span className="font-semibold text-sm">Network Printer</span>
                  <span className="text-xs text-emerald-100">IPP/Socket</span>
                </div>
              </div>

              {/* Process Steps */}
              <div className="border-t pt-6">
                <h4 className="text-gray-700 font-semibold mb-4 flex items-center gap-2">
                  <span>📋</span> Print Job Processing Steps
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { phase: '01', name: 'Auth Check', desc: 'JWT validation', color: 'bg-blue-50 border-blue-300 text-blue-700' },
                    { phase: '02', name: 'File Upload', desc: 'Multipart form', color: 'bg-purple-50 border-purple-300 text-purple-700' },
                    { phase: '03', name: 'Validation', desc: 'File type check', color: 'bg-pink-50 border-pink-300 text-pink-700' },
                    { phase: '04', name: 'CUPS Queue', desc: 'lp command', color: 'bg-orange-50 border-orange-300 text-orange-700' },
                    { phase: '05', name: 'Job Track', desc: 'DB + lpstat', color: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
                    { phase: '06', name: 'Complete', desc: 'Status update', color: 'bg-green-50 border-green-300 text-green-700' },
                  ].map((step) => (
                    <div key={step.phase} className={`p-3 rounded-lg border-2 ${step.color}`}>
                      <Badge variant="secondary" className="mb-2">Phase {step.phase}</Badge>
                      <p className="font-medium text-sm">{step.name}</p>
                      <p className="text-xs opacity-70">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* FRONTEND ↔ BACKEND COMMUNICATION */}
          {/* ============================================ */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2 text-green-700">
                <Network className="h-5 w-5" />
                Frontend ↔ Backend Communication
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Frontend */}
                <div className="bg-blue-500 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="h-5 w-5" />
                    <span className="font-bold">Frontend (React)</span>
                  </div>
                  <p className="text-sm text-blue-100 mb-3">Port 80 • Vite • React</p>
                  
                  <div className="bg-blue-600/50 rounded-lg p-3 mt-3">
                    <h5 className="font-semibold text-sm mb-2">Components</h5>
                    <ul className="text-xs space-y-1 text-blue-100">
                      <li>• AuthContext - JWT state</li>
                      <li>• axios.js - HTTP client</li>
                      <li>• useAuth() - Auth hook</li>
                      <li>• ProtectedRoute - Guard</li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-600/50 rounded-lg p-3 mt-3">
                    <h5 className="font-semibold text-sm mb-2">Storage</h5>
                    <ul className="text-xs space-y-1 text-blue-100">
                      <li>• localStorage - JWT token</li>
                      <li>• React Query - Cache</li>
                      <li>• Auto-refresh on 401</li>
                    </ul>
                  </div>
                </div>

                {/* API */}
                <div className="bg-gray-100 rounded-xl p-4 border-2 border-gray-200">
                  <h4 className="font-bold text-center mb-4 text-gray-700">HTTP/REST API</h4>
                  <div className="space-y-2">
                    {[
                      { method: 'GET', path: '/api/printers', color: 'text-green-600 bg-green-50' },
                      { method: 'POST', path: '/api/printers', color: 'text-yellow-600 bg-yellow-50' },
                      { method: 'GET', path: '/api/printers/:id', color: 'text-green-600 bg-green-50' },
                      { method: 'POST', path: '/api/print/upload', color: 'text-yellow-600 bg-yellow-50' },
                      { method: 'DELETE', path: '/api/printers/:id', color: 'text-red-600 bg-red-50' },
                      { method: 'POST', path: '/api/auth/login', color: 'text-yellow-600 bg-yellow-50' },
                    ].map((api, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white rounded px-3 py-1.5 text-sm border">
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${api.color}`}>{api.method}</span>
                        <span className="text-gray-600">{api.path}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 bg-white rounded-lg p-3 text-center border">
                    <span className="text-gray-400">🔑</span>
                    <p className="text-sm font-medium text-gray-700">Authorization: Bearer {'{JWT}'}</p>
                    <p className="text-xs text-gray-400">Auto-injected by axios</p>
                  </div>
                </div>

                {/* Backend */}
                <div className="bg-green-500 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="h-5 w-5" />
                    <span className="font-bold">Backend (Node.js)</span>
                  </div>
                  <p className="text-sm text-green-100 mb-3">Port 3000 • Express • CUPS</p>
                  
                  <div className="bg-green-600/50 rounded-lg p-3 mt-3">
                    <h5 className="font-semibold text-sm mb-2">Middleware</h5>
                    <ul className="text-xs space-y-1 text-green-100">
                      <li>• CORS - localhost:443</li>
                      <li>• JWT decode - Verify token</li>
                      <li>• Rate limiter - Per IP</li>
                      <li>• Error handler - Logging</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-600/50 rounded-lg p-3 mt-3">
                    <h5 className="font-semibold text-sm mb-2">Services</h5>
                    <ul className="text-xs space-y-1 text-green-100">
                      <li>• cupsService.js - CUPS CLI</li>
                      <li>• snmpMonitor.js - Toner</li>
                      <li>• discoveryService.js - Scan</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* JWT Flow */}
              <div className="mt-6 border-t pt-6">
                <h4 className="text-gray-700 font-semibold mb-4 flex items-center gap-2">
                  🔐 JWT Authentication Flow
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { step: '1. Login', code: 'POST /api/auth/login', desc: 'email + password', color: 'border-l-blue-500 bg-blue-50' },
                    { step: '2. Generate JWT', code: 'jwt.sign()', desc: 'payload: {user_id, role, exp}', color: 'border-l-purple-500 bg-purple-50' },
                    { step: '3. Store Client', code: 'localStorage.setItem()', desc: "key: 'token'", color: 'border-l-yellow-500 bg-yellow-50' },
                    { step: '4. Every Request', code: 'Header: Bearer', desc: 'Auto-injected', color: 'border-l-green-500 bg-green-50' },
                  ].map((item, i) => (
                    <div key={i} className={`rounded-lg p-3 border-l-4 ${item.color}`}>
                      <p className="font-semibold text-sm text-gray-700">{item.step}</p>
                      <code className="text-xs text-blue-600">{item.code}</code>
                      <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* BACKEND INTERNAL ARCHITECTURE */}
          {/* ============================================ */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="flex items-center gap-2 text-purple-700">
                <Server className="h-5 w-5" />
                Backend Internal Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                {/* API Layer */}
                <div className="bg-blue-500 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5" />
                    <span className="font-bold">API Layer</span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-blue-100">
                    <li>• <code className="bg-blue-600/50 px-1 rounded">app.js</code></li>
                    <li>• Express routes</li>
                    <li>• Request validation</li>
                    <li>• JWT middleware</li>
                    <li>• CORS config</li>
                  </ul>
                </div>

                {/* CUPS Integration */}
                <div className="bg-orange-500 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Printer className="h-5 w-5" />
                    <span className="font-bold">CUPS Engine</span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-orange-100">
                    <li>• <code className="bg-orange-600/50 px-1 rounded">cupsService.js</code></li>
                    <li>• lpadmin commands</li>
                    <li>• Driver selection</li>
                    <li>• Job submission</li>
                    <li>• Queue management</li>
                  </ul>
                </div>

                {/* Monitoring */}
                <div className="bg-emerald-500 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-5 w-5" />
                    <span className="font-bold">Monitoring</span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-emerald-100">
                    <li>• <code className="bg-emerald-600/50 px-1 rounded">snmpMonitor.js</code></li>
                    <li>• Toner levels</li>
                    <li>• Page counts</li>
                    <li>• Status polling</li>
                    <li>• Alert triggers</li>
                  </ul>
                </div>

                {/* Discovery */}
                <div className="bg-purple-500 text-white rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Radar className="h-5 w-5" />
                    <span className="font-bold">Discovery</span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-purple-100">
                    <li>• <code className="bg-purple-600/50 px-1 rounded">discoveryService.js</code></li>
                    <li>• IP range scan</li>
                    <li>• Port detection</li>
                    <li>• SNMP probing</li>
                    <li>• Auto-detection</li>
                  </ul>
                </div>
              </div>

              {/* Data Persistence */}
              <div className="bg-gray-50 border rounded-xl p-4">
                <h4 className="font-semibold mb-4 text-gray-700">Data Persistence</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-3 border">
                    <h5 className="text-blue-600 font-semibold text-sm mb-2">MySQL</h5>
                    <ul className="text-xs space-y-1 text-gray-500">
                      <li>• Users & auth</li>
                      <li>• Printers metadata</li>
                      <li>• Print jobs history</li>
                      <li>• Notifications</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <h5 className="text-orange-600 font-semibold text-sm mb-2">CUPS Volumes</h5>
                    <ul className="text-xs space-y-1 text-gray-500">
                      <li>• /etc/cups config</li>
                      <li>• Printer queues</li>
                      <li>• PPD files</li>
                      <li>• Error logs</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <h5 className="text-green-600 font-semibold text-sm mb-2">File System</h5>
                    <ul className="text-xs space-y-1 text-gray-500">
                      <li>• Upload temp files</li>
                      <li>• Application logs</li>
                      <li>• SSL certificates</li>
                      <li>• Driver PPDs</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* DOCKER CONTAINER ARCHITECTURE */}
          {/* ============================================ */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-blue-50">
              <CardTitle className="flex items-center gap-2 text-cyan-700">
                <HardDrive className="h-5 w-5" />
                Docker Container Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                {[
                  { name: 'printer-nginx', port: '443/80', tech: 'Alpine + OpenSSL', color: 'bg-cyan-500', icon: Shield },
                  { name: 'printer-frontend', port: '80', tech: 'Node + Nginx', color: 'bg-blue-500', icon: Globe },
                  { name: 'printer-backend', port: '3000 + 631', tech: 'Ubuntu + CUPS', color: 'bg-green-500', icon: Server },
                  { name: 'printer-mysql', port: '3306', tech: 'MySQL 8.0', color: 'bg-orange-500', icon: Database },
                ].map((container) => (
                  <div key={container.name} className={`${container.color} text-white rounded-xl p-4 text-center shadow-lg`}>
                    <container.icon className="h-10 w-10 mx-auto mb-2" />
                    <p className="font-bold text-sm">{container.name}</p>
                    <p className="text-xs opacity-80">Port {container.port}</p>
                    <p className="text-xs opacity-60 mt-1">{container.tech}</p>
                  </div>
                ))}
              </div>

              {/* Volumes */}
              <div className="bg-gray-50 border rounded-xl p-4">
                <h4 className="font-semibold mb-4 flex items-center gap-2 text-gray-700">
                  <HardDrive className="h-4 w-4 text-purple-500" />
                  Persistent Volumes
                </h4>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3 border">
                    <code className="text-blue-600 text-xs font-bold">mysql_data</code>
                    <p className="text-xs text-gray-400 mt-1">/var/lib/mysql</p>
                    <p className="text-xs text-gray-500">Database files</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <code className="text-orange-600 text-xs font-bold">cups_data</code>
                    <p className="text-xs text-gray-400 mt-1">/etc/cups</p>
                    <p className="text-xs text-gray-500">CUPS configuration</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <code className="text-green-600 text-xs font-bold">cups_spool</code>
                    <p className="text-xs text-gray-400 mt-1">/var/spool/cups</p>
                    <p className="text-xs text-gray-500">Print queue</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* SECURITY & AUTHENTICATION */}
          {/* ============================================ */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-red-50 to-orange-50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Shield className="h-5 w-5" />
                Security & Encryption
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Authentication */}
                <div>
                  <h4 className="font-semibold mb-3 text-gray-700">Authentication</h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h5 className="text-yellow-700 font-semibold text-sm mb-2">JWT (JSON Web Tokens)</h5>
                    <ul className="text-xs space-y-1.5 text-gray-600">
                      <li>• Algorithm: <code className="bg-yellow-100 px-1 rounded">HS256</code></li>
                      <li>• Expiry: <code className="bg-yellow-100 px-1 rounded">24 hours</code></li>
                      <li>• Payload: <code className="bg-yellow-100 px-1 rounded">{'{user_id, email, role, exp}'}</code></li>
                      <li>• Secret: <code className="bg-yellow-100 px-1 rounded">JWT_SECRET</code> env var</li>
                      <li>• Refresh token support</li>
                    </ul>
                  </div>
                </div>

                {/* SSL */}
                <div>
                  <h4 className="font-semibold mb-3 text-gray-700">Data Encryption</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h5 className="text-green-700 font-semibold text-sm mb-2">SSL/TLS Certificates</h5>
                    <ul className="text-xs space-y-1.5 text-gray-600">
                      <li>• Auto-generated on first run</li>
                      <li>• Self-signed for development</li>
                      <li>• HTTPS only (port 443)</li>
                      <li>• HTTP redirects to HTTPS</li>
                      <li>• Password hashing: <code className="bg-green-100 px-1 rounded">bcrypt</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Role-based access */}
              <div className="mt-6 bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-gray-700">Role-Based Access Control</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { role: 'Admin', color: 'bg-red-500 text-white', perms: ['All permissions', 'User management', 'System logs', 'Discovery'] },
                    { role: 'Operator', color: 'bg-yellow-500 text-white', perms: ['Print jobs', 'Add printers', 'View reports', 'Discovery'] },
                    { role: 'User', color: 'bg-blue-500 text-white', perms: ['View printers', 'Print documents', 'View own jobs', 'Basic reports'] },
                  ].map((r) => (
                    <div key={r.role} className="bg-white rounded-lg p-3 border">
                      <Badge className={r.color}>{r.role}</Badge>
                      <ul className="text-xs text-gray-500 mt-2 space-y-1">
                        {r.perms.map((p, i) => <li key={i}>• {p}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* API REFERENCE - EXTERNAL ACCESS */}
          {/* ============================================ */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-purple-50">
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <Code className="h-5 w-5" />
                API Reference - External Access
              </CardTitle>
              <CardDescription>How to call APIs from external servers</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* Step 1: Get JWT */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Badge className="bg-blue-500">Step 1</Badge>
                  Authenticate & Get JWT Token
                </h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                  <pre>{`# Login to get JWT token
curl -X POST https://your-server/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@company.com",
    "password": "your_password"
  }'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@company.com",
    "name": "Admin",
    "role": "admin"
  }
}`}</pre>
                </div>
              </div>

              {/* Step 2: Use Token */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Badge className="bg-green-500">Step 2</Badge>
                  Use Token in API Calls
                </h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                  <pre>{`# Include token in Authorization header
curl -X GET https://your-server/api/printers \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Example: Get all printers
curl -X GET https://your-server/api/printers \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Example: Print a file
curl -X POST https://your-server/api/print/file \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -F "file=@/path/to/document.pdf" \\
  -F "printerId=1" \\
  -F "copies=1"`}</pre>
                </div>
              </div>

              {/* Step 3: Refresh Token */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Badge className="bg-yellow-500">Step 3</Badge>
                  Refresh Token (when expired)
                </h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                  <pre>{`# Token expires after 24 hours. Use refresh token:
curl -X POST https://your-server/api/auth/refresh \\
  -H "Content-Type: application/json" \\
  -d '{
    "refreshToken": "your_refresh_token"
  }'

# Response: New access token
{
  "token": "new_jwt_token...",
  "refreshToken": "new_refresh_token..."
}`}</pre>
                </div>
              </div>

              {/* Python Example */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-700 mb-3">Python Example</h4>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
                  <pre>{`import requests

BASE_URL = "https://your-printer-server"

# 1. Login
response = requests.post(f"{BASE_URL}/api/auth/login", json={
    "email": "admin@company.com",
    "password": "your_password"
}, verify=False)  # verify=False for self-signed SSL

token = response.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Get all printers
printers = requests.get(f"{BASE_URL}/api/printers", headers=headers)
print(printers.json())

# 3. Print a file
with open("document.pdf", "rb") as f:
    response = requests.post(
        f"{BASE_URL}/api/print/file",
        headers=headers,
        files={"file": f},
        data={"printerId": 1, "copies": 1}
    )
print(response.json())`}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* COMPLETE API ENDPOINTS */}
          {/* ============================================ */}
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-slate-100">
              <CardTitle className="flex items-center gap-2 text-gray-700">
                <FileText className="h-5 w-5" />
                Complete API Endpoints
              </CardTitle>
              <CardDescription>All available REST API endpoints</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              
              {/* Auth APIs */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-yellow-500" />
                  Authentication
                  <Badge variant="outline" className="ml-2">No auth required for login</Badge>
                </h4>
                <div className="space-y-2">
                  {[
                    { method: 'POST', path: '/api/auth/login', desc: 'Login and get JWT token', auth: false },
                    { method: 'POST', path: '/api/auth/refresh', desc: 'Refresh expired token', auth: false },
                    { method: 'POST', path: '/api/auth/logout', desc: 'Logout (invalidate token)', auth: true },
                    { method: 'GET', path: '/api/auth/me', desc: 'Get current user info', auth: true },
                    { method: 'PUT', path: '/api/auth/password', desc: 'Change password', auth: true },
                  ].map((api, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 border">
                      <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${
                        api.method === 'GET' ? 'bg-green-100 text-green-700' :
                        api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{api.method}</span>
                      <code className="text-sm text-gray-700 flex-1">{api.path}</code>
                      <span className="text-xs text-gray-500">{api.desc}</span>
                      {api.auth && <Badge variant="outline" className="text-xs">Auth</Badge>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Printer APIs */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Printer className="h-4 w-4 text-blue-500" />
                  Printers
                </h4>
                <div className="space-y-2">
                  {[
                    { method: 'GET', path: '/api/printers', desc: 'List all printers', role: 'any' },
                    { method: 'GET', path: '/api/printers/:id', desc: 'Get printer details', role: 'any' },
                    { method: 'POST', path: '/api/printers', desc: 'Add new printer', role: 'admin/operator' },
                    { method: 'PUT', path: '/api/printers/:id', desc: 'Update printer', role: 'admin/operator' },
                    { method: 'DELETE', path: '/api/printers/:id', desc: 'Delete printer', role: 'admin' },
                    { method: 'POST', path: '/api/printers/detect', desc: 'Detect printer model', role: 'admin/operator' },
                    { method: 'GET', path: '/api/printers/drivers', desc: 'List available drivers', role: 'admin/operator' },
                    { method: 'GET', path: '/api/printers/:id/toner', desc: 'Get toner levels', role: 'any' },
                    { method: 'GET', path: '/api/printers/:id/supplies', desc: 'Get all supplies', role: 'any' },
                    { method: 'POST', path: '/api/printers/:id/test', desc: 'Test connectivity', role: 'admin/operator' },
                    { method: 'POST', path: '/api/printers/:id/print-test', desc: 'Print test page', role: 'admin/operator' },
                  ].map((api, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 border">
                      <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${
                        api.method === 'GET' ? 'bg-green-100 text-green-700' :
                        api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{api.method}</span>
                      <code className="text-sm text-gray-700 flex-1">{api.path}</code>
                      <span className="text-xs text-gray-500 hidden md:block">{api.desc}</span>
                      <Badge variant="outline" className="text-xs">{api.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Print APIs */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Send className="h-4 w-4 text-purple-500" />
                  Print Jobs
                </h4>
                <div className="space-y-2">
                  {[
                    { method: 'POST', path: '/api/print/file', desc: 'Upload and print file', role: 'admin/operator' },
                    { method: 'POST', path: '/api/print/text', desc: 'Print plain text', role: 'admin/operator' },
                    { method: 'POST', path: '/api/print/test', desc: 'Print test page', role: 'admin/operator' },
                    { method: 'GET', path: '/api/print/queue', desc: 'Get print queue', role: 'any' },
                    { method: 'DELETE', path: '/api/print/queue/:jobId', desc: 'Cancel print job', role: 'admin/operator' },
                    { method: 'GET', path: '/api/jobs', desc: 'List all jobs', role: 'any' },
                    { method: 'GET', path: '/api/jobs/:id', desc: 'Get job details', role: 'any' },
                    { method: 'DELETE', path: '/api/jobs/:id', desc: 'Cancel job', role: 'admin/operator' },
                  ].map((api, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 border">
                      <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${
                        api.method === 'GET' ? 'bg-green-100 text-green-700' :
                        api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{api.method}</span>
                      <code className="text-sm text-gray-700 flex-1">{api.path}</code>
                      <span className="text-xs text-gray-500 hidden md:block">{api.desc}</span>
                      <Badge variant="outline" className="text-xs">{api.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discovery APIs */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Radar className="h-4 w-4 text-cyan-500" />
                  Discovery
                </h4>
                <div className="space-y-2">
                  {[
                    { method: 'POST', path: '/api/discovery/scan', desc: 'Start network scan', role: 'admin/operator' },
                    { method: 'GET', path: '/api/discovery/status', desc: 'Get scan progress', role: 'admin/operator' },
                    { method: 'POST', path: '/api/discovery/abort', desc: 'Abort running scan', role: 'admin/operator' },
                    { method: 'POST', path: '/api/discovery/scan-ip', desc: 'Scan single IP', role: 'admin/operator' },
                    { method: 'POST', path: '/api/discovery/add', desc: 'Add discovered printer', role: 'admin/operator' },
                    { method: 'GET', path: '/api/discovery/network', desc: 'Get network info', role: 'admin/operator' },
                  ].map((api, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 border">
                      <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${
                        api.method === 'GET' ? 'bg-green-100 text-green-700' :
                        api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{api.method}</span>
                      <code className="text-sm text-gray-700 flex-1">{api.path}</code>
                      <span className="text-xs text-gray-500 hidden md:block">{api.desc}</span>
                      <Badge variant="outline" className="text-xs">{api.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reports & Users APIs */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                  Reports & Users
                </h4>
                <div className="space-y-2">
                  {[
                    { method: 'GET', path: '/api/reports/summary', desc: 'Get print summary', role: 'any' },
                    { method: 'GET', path: '/api/reports/usage', desc: 'Usage statistics', role: 'any' },
                    { method: 'GET', path: '/api/reports/export', desc: 'Export to Excel/CSV', role: 'admin/operator' },
                    { method: 'GET', path: '/api/users', desc: 'List all users', role: 'admin' },
                    { method: 'POST', path: '/api/users', desc: 'Create user', role: 'admin' },
                    { method: 'PUT', path: '/api/users/:id', desc: 'Update user', role: 'admin' },
                    { method: 'DELETE', path: '/api/users/:id', desc: 'Delete user', role: 'admin' },
                  ].map((api, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 border">
                      <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${
                        api.method === 'GET' ? 'bg-green-100 text-green-700' :
                        api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{api.method}</span>
                      <code className="text-sm text-gray-700 flex-1">{api.path}</code>
                      <span className="text-xs text-gray-500 hidden md:block">{api.desc}</span>
                      <Badge variant="outline" className="text-xs">{api.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* System APIs */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Server className="h-4 w-4 text-gray-500" />
                  System
                </h4>
                <div className="space-y-2">
                  {[
                    { method: 'GET', path: '/api/system/health', desc: 'Health check (no auth)', role: 'public' },
                    { method: 'GET', path: '/api/system/stats', desc: 'System statistics', role: 'any' },
                    { method: 'GET', path: '/api/system/logs', desc: 'View system logs', role: 'admin' },
                    { method: 'GET', path: '/api/system/cups-status', desc: 'CUPS server status', role: 'admin' },
                    { method: 'POST', path: '/api/system/refresh-printers', desc: 'Sync printers with CUPS', role: 'admin/operator' },
                  ].map((api, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 border">
                      <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${
                        api.method === 'GET' ? 'bg-green-100 text-green-700' :
                        api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        api.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{api.method}</span>
                      <code className="text-sm text-gray-700 flex-1">{api.path}</code>
                      <span className="text-xs text-gray-500 hidden md:block">{api.desc}</span>
                      <Badge variant="outline" className="text-xs">{api.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Docker Commands */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-green-500" />
                Docker Commands
              </CardTitle>
              <CardDescription>Common operations for managing the system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Start/Stop System:</h4>
              <CodeBlock 
                id="start"
                code={`# Start all containers
docker-compose up -d

# Stop all containers (data preserved)
docker-compose down

# Stop and REMOVE all data (⚠️ destructive)
docker-compose down -v`}
              />

              <h4 className="font-semibold mt-4">View Logs:</h4>
              <CodeBlock 
                id="logs"
                code={`# All containers
docker-compose logs -f

# Specific container
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mysql`}
              />

              <h4 className="font-semibold mt-4">Restart Services:</h4>
              <CodeBlock 
                id="restart"
                code={`# Restart single service
docker-compose restart backend

# Restart all
docker-compose restart`}
              />

              <h4 className="font-semibold mt-4">Access Container Shell:</h4>
              <CodeBlock 
                id="shell"
                code={`# Backend container (includes CUPS)
docker exec -it printer-backend bash

# MySQL container
docker exec -it printer-mysql mysql -u root -p`}
              />
            </CardContent>
          </Card>

          {/* Making Changes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-500" />
                Making Code Changes
              </CardTitle>
              <CardDescription>How to modify and rebuild each component</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <h4 className="font-semibold">Frontend Changes (React):</h4>
              <CodeBlock 
                id="frontend"
                code={`# Edit files in: frontend/src/
# Example: frontend/src/pages/Dashboard.jsx

# Rebuild and restart
docker-compose build frontend
docker-compose up -d frontend`}
              />

              <h4 className="font-semibold mt-4">Backend Changes (Node.js):</h4>
              <CodeBlock 
                id="backend"
                code={`# Edit files in: backend/src/
# Example: backend/src/routes/printer.routes.js

# Rebuild and restart
docker-compose build backend
docker-compose up -d backend`}
              />

              <h4 className="font-semibold mt-4">CUPS Configuration:</h4>
              <CodeBlock 
                id="cups"
                code={`# Edit CUPS config inside container
docker exec -it printer-backend bash
nano /etc/cups/cupsd.conf

# Or edit Dockerfile for permanent changes
# Edit: backend/Dockerfile

# Then rebuild
docker-compose build backend --no-cache
docker-compose up -d backend`}
              />

              <h4 className="font-semibold mt-4">Database Schema:</h4>
              <CodeBlock 
                id="db"
                code={`# For NEW installations, edit: init.sql

# For EXISTING database, connect and run SQL:
docker exec -it printer-mysql mysql -u root -p
USE printer_management;
ALTER TABLE printers ADD COLUMN new_field VARCHAR(255);`}
              />

              <h4 className="font-semibold mt-4">Rebuild Everything:</h4>
              <CodeBlock 
                id="rebuild"
                code={`# Rebuild all containers (preserves data)
docker-compose build
docker-compose up -d

# Full rebuild with no cache
docker-compose build --no-cache
docker-compose up -d`}
              />
            </CardContent>
          </Card>

          {/* Volumes & Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-purple-500" />
                Persistent Volumes
              </CardTitle>
              <CardDescription>Where data is stored</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All important data is stored in Docker volumes that persist across restarts and rebuilds.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Volume</th>
                      <th className="text-left p-2">Container Path</th>
                      <th className="text-left p-2">Contents</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-xs">mysql_data</td>
                      <td className="p-2 font-mono text-xs">/var/lib/mysql</td>
                      <td className="p-2">All database tables, users, jobs, printers</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-xs">cups_data</td>
                      <td className="p-2 font-mono text-xs">/etc/cups</td>
                      <td className="p-2">CUPS configuration, registered printers</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-xs">cups_spool</td>
                      <td className="p-2 font-mono text-xs">/var/spool/cups</td>
                      <td className="p-2">Print job queue</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-xs">./backend/logs</td>
                      <td className="p-2 font-mono text-xs">/app/logs</td>
                      <td className="p-2">Application logs (bind mount)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4 className="font-semibold mt-4">Backup Commands:</h4>
              <CodeBlock 
                id="backup"
                code={`# Backup MySQL database
docker exec printer-mysql mysqldump -u root -p printer_management > backup.sql

# Backup CUPS config
docker cp printer-backend:/etc/cups ./cups_backup

# Restore MySQL
docker exec -i printer-mysql mysql -u root -p printer_management < backup.sql`}
              />

              <h4 className="font-semibold mt-4">View Volume Data:</h4>
              <CodeBlock 
                id="volumes"
                code={`# List volumes
docker volume ls | grep printer

# Inspect volume location
docker volume inspect printer_management_mysql_data`}
              />
            </CardContent>
          </Card>

          {/* Environment Variables */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                Environment Configuration
              </CardTitle>
              <CardDescription>The .env file settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All configuration is done via the <code>.env</code> file in the project root.
              </p>

              <CodeBlock 
                id="env"
                code={`# Database
MYSQL_ROOT_PASSWORD=your_secure_password
MYSQL_DATABASE=printer_management
MYSQL_USER=printer_admin
MYSQL_PASSWORD=your_password

# JWT Authentication
JWT_SECRET=your_32_char_secret_here
JWT_REFRESH_SECRET=another_32_char_secret

# URLs
FRONTEND_URL=https://your-domain.com
SSL_DOMAIN=your-domain.com

# Timezone
TZ=America/Bogota

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=app_password`}
              />

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> After changing .env, restart containers: <code>docker-compose up -d</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Driver Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-cyan-500" />
                Printer Drivers
              </CardTitle>
              <CardDescription>Available drivers and how they work</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The backend container includes 12,000+ printer drivers from these packages:
              </p>

              <div className="grid gap-2 text-sm">
                <div className="p-2 bg-gray-50 rounded">
                  <strong>HPLIP:</strong> HP LaserJet, OfficeJet, DeskJet (~9,000 models)
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Gutenprint:</strong> Canon, Epson, Lexmark, Samsung (~2,000 models)
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Foomatic:</strong> Generic PPD database (~1,000 models)
                </div>
                <div className="p-2 bg-gray-50 rounded">
                  <strong>Brother brlaser:</strong> Brother laser printers
                </div>
              </div>

              <h4 className="font-semibold mt-4">Check Available Drivers:</h4>
              <CodeBlock 
                id="drivers"
                code={`# List all drivers
docker exec printer-backend lpinfo -m | wc -l

# Search for specific brand
docker exec printer-backend lpinfo -m | grep -i "hp laserjet"

# Search for model
docker exec printer-backend lpinfo -m | grep -i "m401"`}
              />

              <h4 className="font-semibold mt-4">How Auto-Detection Works:</h4>
              <ol className="text-sm list-decimal list-inside space-y-1">
                <li>Backend queries printer via SNMP (sysDescr OID)</li>
                <li>Extracts manufacturer and model</li>
                <li>Searches available drivers with scoring algorithm</li>
                <li>Selects best match or falls back to generic PCL/PostScript</li>
                <li>Configures CUPS queue with <code>lpadmin</code></li>
              </ol>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Troubleshooting
              </CardTitle>
              <CardDescription>Common issues and solutions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-red-600">Container won't start</h4>
                  <CodeBlock 
                    id="trouble1"
                    code={`# Check logs
docker-compose logs backend

# Check if ports are in use
lsof -i :3000
lsof -i :631`}
                  />
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-red-600">Printer not detected</h4>
                  <CodeBlock 
                    id="trouble2"
                    code={`# Test connectivity from container
docker exec printer-backend ping -c 3 PRINTER_IP

# Test SNMP
docker exec printer-backend snmpget -v2c -c public PRINTER_IP sysDescr.0`}
                  />
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-red-600">Print job fails</h4>
                  <CodeBlock 
                    id="trouble3"
                    code={`# Check CUPS error log
docker exec printer-backend tail -50 /var/log/cups/error_log

# Check printer status in CUPS
docker exec printer-backend lpstat -p -d`}
                  />
                </div>

                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-red-600">Database connection error</h4>
                  <CodeBlock 
                    id="trouble4"
                    code={`# Check MySQL is running
docker-compose ps mysql

# Check MySQL logs
docker-compose logs mysql

# Test connection
docker exec printer-mysql mysqladmin -u root -p ping`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Structure */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-500" />
                Project File Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
{`printer_management/
├── docker-compose.yml      # Container orchestration
├── .env                    # Environment variables
├── init.sql                # Database schema
│
├── backend/
│   ├── Dockerfile          # Backend + CUPS container
│   ├── package.json        # Node.js dependencies
│   ├── start.sh            # Startup script
│   └── src/
│       ├── app.js          # Express app entry
│       ├── config/         # Database config
│       ├── middleware/     # Auth, error handling
│       ├── routes/         # API endpoints
│       ├── services/       # Business logic
│       │   ├── cupsService.js      # CUPS integration
│       │   ├── snmpMonitor.js      # Printer monitoring
│       │   └── discoveryService.js # Network scanning
│       └── utils/          # Helpers, logger
│
├── frontend/
│   ├── Dockerfile          # React build + Nginx
│   ├── package.json        # React dependencies
│   └── src/
│       ├── App.jsx         # Router setup
│       ├── api/            # Axios API client
│       ├── components/     # Reusable UI components
│       ├── context/        # Auth, Socket providers
│       ├── pages/          # Page components
│       └── lib/            # Utilities
│
└── nginx/
    ├── Dockerfile          # Nginx + SSL
    └── nginx.conf          # Reverse proxy config`}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API GUIDE */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          {/* Introduction */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-6 w-6" />
                API Integration Guide
              </CardTitle>
              <CardDescription className="text-green-100">
                RESTful API for POS and external system integration
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                This guide explains how to integrate the Printer Management System with your POS 
                or other external systems. All endpoints require JWT authentication.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline">REST API</Badge>
                <Badge variant="outline">JSON</Badge>
                <Badge variant="outline">JWT Auth</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Base URL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock 
                code={`http://<server-ip>:8080/api

Example: http://192.168.170.10:8080/api`}
                id="api-base-url"
              />
            </CardContent>
          </Card>

          {/* Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Authentication
              </CardTitle>
              <CardDescription>
                Obtain a JWT token to access protected endpoints
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Login Request</h4>
                <CodeBlock 
                  code={`POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}`}
                  id="api-login"
                />
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Response</h4>
                <CodeBlock 
                  code={`{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}`}
                  id="api-login-response"
                  language="json"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Include the token in all subsequent requests:
                </p>
                <code className="text-sm bg-yellow-100 px-2 py-1 rounded mt-2 block">
                  Authorization: Bearer &lt;token&gt;
                </code>
              </div>
            </CardContent>
          </Card>

          {/* Add Printer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Printer
              </CardTitle>
              <CardDescription>
                Register a new printer from your POS system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Request</h4>
                <CodeBlock 
                  code={`POST /api/printers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "KITCHEN",
  "ip_address": "192.168.170.22",
  "location": "Kitchen Station",
  "port": 9100,
  "protocol": "socket"
}`}
                  id="api-add-printer"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Required Fields</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Field</th>
                        <th className="text-left py-2">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2"><code>name</code></td>
                        <td className="py-2">string</td>
                      </tr>
                      <tr>
                        <td className="py-2"><code>ip_address</code></td>
                        <td className="py-2">string</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Optional Fields</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Field</th>
                        <th className="text-left py-2">Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-2"><code>location</code></td>
                        <td className="py-2">null</td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2"><code>port</code></td>
                        <td className="py-2">9100</td>
                      </tr>
                      <tr>
                        <td className="py-2"><code>protocol</code></td>
                        <td className="py-2">"socket"</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Success Response (201)</h4>
                <CodeBlock 
                  code={`{
  "id": 25,
  "name": "KITCHEN",
  "ip_address": "192.168.170.22",
  "cups_name": "kitchen",
  "driver": "raw",
  "message": "Printer added successfully"
}`}
                  id="api-add-response"
                  language="json"
                />
              </div>
            </CardContent>
          </Card>

          {/* cURL Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                cURL Example
              </CardTitle>
              <CardDescription>
                Complete example using command line
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Step 1: Login</h4>
                <CodeBlock 
                  code={`TOKEN=$(curl -s -X POST http://192.168.170.10:8080/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"username":"admin","password":"your-password"}' \\
  | jq -r '.token')

echo "Token: $TOKEN"`}
                  id="curl-login"
                />
              </div>
              <div>
                <h4 className="font-semibold mb-2">Step 2: Add Printer</h4>
                <CodeBlock 
                  code={`curl -X POST http://192.168.170.10:8080/api/printers \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "KITCHEN",
    "ip_address": "192.168.170.22",
    "location": "Kitchen Station",
    "port": 9100
  }'`}
                  id="curl-add"
                />
              </div>
            </CardContent>
          </Card>

          {/* JavaScript Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                JavaScript Example
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock 
                code={`const axios = require('axios');

const API_URL = 'http://192.168.170.10:8080/api';

async function addPrinter(name, ipAddress, location) {
  // Step 1: Login
  const loginResponse = await axios.post(\`\${API_URL}/auth/login\`, {
    username: 'admin',
    password: 'your-password'
  });
  
  const token = loginResponse.data.token;
  
  // Step 2: Add printer
  const printerResponse = await axios.post(\`\${API_URL}/printers\`, {
    name: name,
    ip_address: ipAddress,
    location: location,
    port: 9100,
    protocol: 'socket'
  }, {
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    }
  });
  
  return printerResponse.data;
}

// Usage
addPrinter('KITCHEN', '192.168.170.22', 'Kitchen Station')
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error.response?.data));`}
                id="js-example"
                language="javascript"
              />
            </CardContent>
          </Card>

          {/* Python Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Python Example
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock 
                code={`import requests

API_URL = 'http://192.168.170.10:8080/api'

def add_printer(name, ip_address, location):
    # Step 1: Login
    login_response = requests.post(f'{API_URL}/auth/login', json={
        'username': 'admin',
        'password': 'your-password'
    })
    login_response.raise_for_status()
    token = login_response.json()['token']
    
    # Step 2: Add printer
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    printer_response = requests.post(f'{API_URL}/printers', json={
        'name': name,
        'ip_address': ip_address,
        'location': location,
        'port': 9100,
        'protocol': 'socket'
    }, headers=headers)
    
    printer_response.raise_for_status()
    return printer_response.json()

# Usage
if __name__ == '__main__':
    result = add_printer('KITCHEN', '192.168.170.22', 'Kitchen Station')
    print('Printer added:', result)`}
                id="python-example"
                language="python"
              />
            </CardContent>
          </Card>

          {/* Other Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Other Endpoints
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <Badge className="bg-green-500">GET</Badge>
                  <code className="flex-1">/api/printers</code>
                  <span className="text-sm text-muted-foreground">List all printers</span>
                </div>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <Badge className="bg-green-500">GET</Badge>
                  <code className="flex-1">/api/printers/:id</code>
                  <span className="text-sm text-muted-foreground">Get single printer</span>
                </div>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <Badge className="bg-blue-500">PUT</Badge>
                  <code className="flex-1">/api/printers/:id</code>
                  <span className="text-sm text-muted-foreground">Update printer</span>
                </div>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <Badge className="bg-red-500">DELETE</Badge>
                  <code className="flex-1">/api/printers/:id</code>
                  <span className="text-sm text-muted-foreground">Delete printer</span>
                </div>
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <Badge className="bg-yellow-500">POST</Badge>
                  <code className="flex-1">/api/printers/:id/test</code>
                  <span className="text-sm text-muted-foreground">Test print</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Important Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <span><strong>Token Expiration:</strong> Tokens expire after 24 hours. Use the refresh token to get a new one.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <span><strong>Thermal Printers:</strong> Use port 9100 and protocol "socket" for thermal receipt printers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <span><strong>Network Printers:</strong> Use port 631 and protocol "ipp" for office printers with IPP support.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <span><strong>CUPS Name:</strong> The system auto-generates a CUPS-safe name (lowercase, underscores).</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
