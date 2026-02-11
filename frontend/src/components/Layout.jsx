import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import {
  Printer,
  LayoutDashboard,
  FileText,
  BarChart3,
  Bell,
  Settings,
  Users,
  ScrollText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Send,
  Network,
  Gauge,
  Radar,
  Activity,
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Status', href: '/status', icon: Activity },
  { name: 'Print', href: '/print', icon: Send },
  { name: 'Architecture', href: '/architecture', icon: Network },
  { name: 'Print Jobs', href: '/jobs', icon: FileText },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Documentation', href: '/documentation', icon: BookOpen },
]

const adminNavigation = [
  { name: 'Discovery', href: '/admin/discovery', icon: Radar },
  { name: 'Maintenance', href: '/admin/maintenance', icon: Clock },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Quotas', href: '/admin/quotas', icon: Gauge },
  { name: 'System Logs', href: '/admin/logs', icon: ScrollText },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === 'true'
  })
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Save collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString())
  }, [sidebarCollapsed])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const NavLink = ({ item }) => {
    const isActive = location.pathname === item.href
    return (
      <Link
        to={item.href}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${sidebarCollapsed ? 'justify-center px-2' : ''}`}
        onClick={() => setSidebarOpen(false)}
        title={sidebarCollapsed ? item.name : ''}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
      </Link>
    )
  }

  const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-56'
  const mainPadding = sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-56'

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Collapsible */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 ${sidebarWidth} bg-card border-r transform transition-all duration-200 lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Collapse toggle button - middle position */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-3 z-10 items-center justify-center w-6 h-6 rounded-full bg-card border shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors`}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Logo - Fixed height */}
        <div className="flex h-14 items-center gap-2 border-b px-4 flex-shrink-0">
          <Printer className="h-6 w-6 text-primary flex-shrink-0" />
          {!sidebarCollapsed && <span className="font-bold text-base truncate">Printer Manager</span>}
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navigation.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {isAdmin && (
            <>
              <div className="my-3 border-t pt-3">
                {!sidebarCollapsed && (
                  <span className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin
                  </span>
                )}
              </div>
              {adminNavigation.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* User section - Fixed at bottom */}
        <div className="border-t p-3 flex-shrink-0">
          <div className={`flex items-center gap-2 px-2 py-1.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-sm flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`w-full mt-1 h-8 ${sidebarCollapsed ? 'justify-center px-0' : 'justify-start'}`}
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Logout' : ''}
          >
            <LogOut className={sidebarCollapsed ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
            {!sidebarCollapsed && 'Logout'}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`${mainPadding} transition-all duration-200`}>
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          <div className="flex-1" />

          {/* Notifications indicator */}
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link to="/notifications">
              <Bell className="h-5 w-5" />
              {/* Notification dot */}
              {/* <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" /> */}
            </Link>
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
        
        {/* Footer */}
        <footer className="border-t bg-card px-4 py-3 text-center text-sm text-muted-foreground">
          © 2026 Saloaun. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
