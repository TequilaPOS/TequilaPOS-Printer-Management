import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersAPI } from '../api/axios'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Users as UsersIcon, Plus, Trash2, UserCheck, UserX, Edit, Key, Shield } from 'lucide-react'
import { formatDate } from '../lib/utils'
import { useForm } from 'react-hook-form'

export default function Users() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.list().then(res => res.data),
  })

  const createUserMutation = useMutation({
    mutationFn: usersAPI.create,
    onSuccess: () => {
      toast.success('User created')
      queryClient.invalidateQueries(['users'])
      setShowAddModal(false)
      resetAdd()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create user')
    }
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.update(id, data),
    onSuccess: () => {
      toast.success('User updated')
      queryClient.invalidateQueries(['users'])
      setShowEditModal(false)
      setSelectedUser(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to update user')
    }
  })

  const changePasswordMutation = useMutation({
    mutationFn: ({ id, password }) => usersAPI.changePassword(id, password),
    onSuccess: () => {
      toast.success('Password changed')
      setShowPasswordModal(false)
      setSelectedUser(null)
      resetPassword()
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to change password')
    }
  })

  const toggleActiveMutation = useMutation({
    mutationFn: usersAPI.toggleActive,
    onSuccess: () => {
      queryClient.invalidateQueries(['users'])
      toast.success('User status updated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to toggle user')
    }
  })

  const deleteUserMutation = useMutation({
    mutationFn: usersAPI.delete,
    onSuccess: () => {
      toast.success('User deleted')
      queryClient.invalidateQueries(['users'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete user')
    }
  })

  const users = data?.users || []

  const handleDelete = (user) => {
    if (confirm(`Delete user "${user.name}"? This action cannot be undone.`)) {
      deleteUserMutation.mutate(user.id)
    }
  }

  const handleEdit = (user) => {
    setSelectedUser(user)
    setShowEditModal(true)
  }

  const handleChangePassword = (user) => {
    setSelectedUser(user)
    setShowPasswordModal(true)
  }

  // Forms
  const { register: registerAdd, handleSubmit: handleSubmitAdd, reset: resetAdd, formState: { errors: errorsAdd } } = useForm()
  const { register: registerEdit, handleSubmit: handleSubmitEdit, formState: { errors: errorsEdit } } = useForm()
  const { register: registerPassword, handleSubmit: handleSubmitPassword, reset: resetPassword, formState: { errors: errorsPassword }, watch } = useForm()

  const onSubmitAdd = (data) => {
    createUserMutation.mutate(data)
  }

  const onSubmitEdit = (data) => {
    updateUserMutation.mutate({ id: selectedUser.id, data })
  }

  const onSubmitPassword = (data) => {
    changePasswordMutation.mutate({ id: selectedUser.id, password: data.password })
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200'
      case 'operator': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage system users and permissions</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">User</th>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Role</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-sm">
                            {user.name?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={`capitalize ${getRoleBadgeColor(user.role)}`}>
                          <Shield className="h-3 w-3 mr-1" />
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? 'bg-green-100 text-green-800' : ''}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Edit user"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Change password"
                            onClick={() => handleChangePassword(user)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleActiveMutation.mutate(user.id)}
                          >
                            {user.is_active ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="Delete user"
                            onClick={() => handleDelete(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitAdd(onSubmitAdd)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                {...registerAdd('name', { required: 'Name is required' })}
                placeholder="John Doe"
              />
              {errorsAdd.name && <p className="text-sm text-destructive">{errorsAdd.name.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Email / Username</Label>
              <Input
                {...registerAdd('email', { required: 'Email is required' })}
                placeholder="john@example.com or john"
              />
              {errorsAdd.email && <p className="text-sm text-destructive">{errorsAdd.email.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                {...registerAdd('password', { 
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Min 6 characters' }
                })}
                placeholder="••••••••"
              />
              {errorsAdd.password && <p className="text-sm text-destructive">{errorsAdd.password.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                {...registerAdd('role')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="viewer">Viewer - Can only view</option>
                <option value="operator">Operator - Can print and manage printers</option>
                <option value="admin">Admin - Full access</option>
              </select>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                {...registerEdit('name', { required: 'Name is required' })}
                defaultValue={selectedUser?.name}
                placeholder="John Doe"
              />
              {errorsEdit.name && <p className="text-sm text-destructive">{errorsEdit.name.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Email / Username</Label>
              <Input
                {...registerEdit('email', { required: 'Email is required' })}
                defaultValue={selectedUser?.email}
                placeholder="john@example.com"
              />
              {errorsEdit.email && <p className="text-sm text-destructive">{errorsEdit.email.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                {...registerEdit('role')}
                defaultValue={selectedUser?.role}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="viewer">Viewer - Can only view</option>
                <option value="operator">Operator - Can print and manage printers</option>
                <option value="admin">Admin - Full access</option>
              </select>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password: {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                {...registerPassword('password', { 
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Min 6 characters' }
                })}
                placeholder="••••••••"
              />
              {errorsPassword.password && <p className="text-sm text-destructive">{errorsPassword.password.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                {...registerPassword('confirmPassword', { 
                  required: 'Please confirm password',
                  validate: (val) => val === watch('password') || 'Passwords do not match'
                })}
                placeholder="••••••••"
              />
              {errorsPassword.confirmPassword && <p className="text-sm text-destructive">{errorsPassword.confirmPassword.message}</p>}
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={changePasswordMutation.isPending}>
                {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
