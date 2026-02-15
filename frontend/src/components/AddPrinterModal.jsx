import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { validateIP, validateHostname } from '../lib/utils'

export default function AddPrinterModal({ open, onClose, onAdd, isLoading }) {
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    defaultValues: {
      name: '',
      ip_address: '',
      port: 9100,
      protocol: 'socket',
      location: '',
      description: '',
      manufacturer: '',
      model: '',
      printerType: 'auto'  // 'auto', 'thermal', 'impact', 'network'
    }
  })

  const printerType = watch('printerType')
  const manufacturer = watch('manufacturer')

  const onSubmit = async (data) => {
    await onAdd(data)
    reset()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Printer</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Printer Name *</Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                placeholder="Office Printer"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ip_address">IP Address *</Label>
              <Input
                id="ip_address"
                {...register('ip_address', { 
                  required: 'IP address is required',
                  validate: (value) => 
                    validateIP(value) || validateHostname(value) || 'Invalid IP or hostname'
                })}
                placeholder="192.168.1.100"
              />
              {errors.ip_address && (
                <p className="text-sm text-destructive">{errors.ip_address.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                {...register('port', { valueAsNumber: true })}
                placeholder="9100"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="protocol">Protocol</Label>
              <select
                id="protocol"
                {...register('protocol')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="socket">Socket/Raw (Port 9100) - POS/Thermal</option>
                <option value="ipp">IPP (Network Printers)</option>
                <option value="ipps">IPP over SSL</option>
                <option value="lpd">LPD</option>
              </select>
            </div>
          </div>

          {/* Printer Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="printerType">Printer Type</Label>
            <select
              id="printerType"
              {...register('printerType')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="auto">🔍 Auto-detect (from name/model)</option>
              <option value="thermal">🔥 Thermal Receipt (TM-T88, TSP100, etc.)</option>
              <option value="impact">🖨️ Impact/Dot Matrix (TM-U220, SP700, etc.)</option>
              <option value="network">📄 Network/Office Printer (HP, Canon, etc.)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {printerType === 'auto' && 'Will detect based on manufacturer and model fields'}
              {printerType === 'thermal' && 'Uses raw/ESC-POS driver for thermal receipt printers'}
              {printerType === 'impact' && 'Uses Epson impact driver for dot matrix printers'}
              {printerType === 'network' && 'Uses IPP Everywhere for modern network printers'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...register('location')}
              placeholder="Office, Floor 2, Room 201"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                {...register('manufacturer')}
                placeholder="HP, Canon, Epson..."
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                {...register('model')}
                placeholder="LaserJet Pro"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...register('description')}
              placeholder="Optional description"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Printer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
