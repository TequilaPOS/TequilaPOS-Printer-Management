import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI, printersAPI } from '../api/axios'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { 
  Users, 
  Printer, 
  FileText, 
  Settings,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar
} from 'lucide-react'

export default function Quotas() {
  const [editingUser, setEditingUser] = useState(null)
  const [quotaValue, setQuotaValue] = useState('')
  const queryClient = useQueryClient()

  // Fetch users with quota info
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users-quotas'],
    queryFn: () => usersAPI.list().then(res => res.data),
  })

  // Fetch printers
  const { data: printersData } = useQuery({
    queryKey: ['printers'],
    queryFn: () => printersAPI.list().then(res => res.data),
  })

  // Update quota mutation
  const updateQuotaMutation = useMutation({
    mutationFn: ({ userId, quota }) => usersAPI.update(userId, { page_quota: quota }),
    onSuccess: () => {
      toast.success('Quota updated successfully')
      queryClient.invalidateQueries(['users-quotas'])
      setEditingUser(null)
      setQuotaValue('')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update quota')
    }
  })

  // Reset usage mutation
  const resetUsageMutation = useMutation({
    mutationFn: (userId) => usersAPI.update(userId, { pages_printed: 0 }),
    onSuccess: () => {
      toast.success('Usage reset successfully')
      queryClient.invalidateQueries(['users-quotas'])
    },
    onError: () => {
      toast.error('Failed to reset usage')
    }
  })

  const users = usersData?.users || usersData || []
  const printers = printersData?.printers || []

  const handleSaveQuota = (userId) => {
    const quota = quotaValue === '' || quotaValue === '-1' ? -1 : parseInt(quotaValue)
    updateQuotaMutation.mutate({ userId, quota })
  }

  const getUsagePercent = (user) => {
    if (!user.page_quota || user.page_quota <= 0) return 0
    return Math.min(100, Math.round((user.pages_printed || 0) / user.page_quota * 100))
  }

  const getUsageColor = (percent) => {
    if (percent >= 100) return 'bg-red-500'
    if (percent >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // Calculate totals
  const totalPagesThisMonth = users.reduce((sum, u) => sum + (u.pages_printed || 0), 0)
  const usersOverQuota = users.filter(u => u.page_quota > 0 && (u.pages_printed || 0) >= u.page_quota).length
  const usersWithQuotas = users.filter(u => u.page_quota > 0).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Quota Management</h1>
        <p className="text-muted-foreground">Manage user print quotas and usage limits</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPagesThisMonth.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Pages This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{usersWithQuotas}</p>
                <p className="text-sm text-muted-foreground">Users with Quotas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${usersOverQuota > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <AlertTriangle className={`h-5 w-5 ${usersOverQuota > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{usersOverQuota}</p>
                <p className="text-sm text-muted-foreground">Over Quota</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Quotas Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Quotas
          </CardTitle>
          <CardDescription>
            Set page limits per user. Use -1 or blank for unlimited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">Pages Printed</th>
                    <th className="text-left py-3 px-4">Quota</th>
                    <th className="text-left py-3 px-4">Usage</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const usagePercent = getUsagePercent(user)
                    const isOverQuota = user.page_quota > 0 && (user.pages_printed || 0) >= user.page_quota
                    const isEditing = editingUser === user.id
                    
                    return (
                      <tr key={user.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {(user.pages_printed || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={quotaValue}
                                onChange={(e) => setQuotaValue(e.target.value)}
                                placeholder="Unlimited"
                                className="w-24 h-8"
                                min="-1"
                              />
                              <Button size="sm" onClick={() => handleSaveQuota(user.id)}>
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingUser(null)}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span 
                              className="font-mono cursor-pointer hover:text-primary"
                              onClick={() => {
                                setEditingUser(user.id)
                                setQuotaValue(user.page_quota > 0 ? user.page_quota.toString() : '')
                              }}
                            >
                              {user.page_quota > 0 ? user.page_quota.toLocaleString() : 'Unlimited'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 w-32">
                          {user.page_quota > 0 ? (
                            <div className="space-y-1">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${getUsageColor(usagePercent)}`}
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground text-center">{usagePercent}%</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isOverQuota ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Over Quota
                            </Badge>
                          ) : user.page_quota > 0 && usagePercent >= 80 ? (
                            <Badge variant="warning" className="bg-yellow-100 text-yellow-800 flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Near Limit
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              OK
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setEditingUser(user.id)
                                setQuotaValue(user.page_quota > 0 ? user.page_quota.toString() : '')
                              }}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Reset usage for ${user.name}?`)) {
                                  resetUsageMutation.mutate(user.id)
                                }
                              }}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Printer-specific Quotas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Printer Access Control
          </CardTitle>
          <CardDescription>
            Configure which printers each user can access (coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Printer-specific quotas and access control</p>
            <p className="text-sm">Feature in development</p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button 
              variant="outline"
              onClick={() => {
                if (confirm('Reset all user page counts to 0? This is typically done at the start of a new month.')) {
                  users.forEach(user => {
                    resetUsageMutation.mutate(user.id)
                  })
                }
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset All Usage (Monthly)
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => {
                const defaultQuota = prompt('Set default quota for all users (pages):', '500')
                if (defaultQuota && !isNaN(parseInt(defaultQuota))) {
                  users.forEach(user => {
                    if (!user.page_quota || user.page_quota <= 0) {
                      updateQuotaMutation.mutate({ 
                        userId: user.id, 
                        quota: parseInt(defaultQuota) 
                      })
                    }
                  })
                }
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Set Default Quota for All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
