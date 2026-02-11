import { Link } from 'react-router-dom'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { getStatusColors, getSnmpColor, getTonerColor } from '../utils/printerColors'
import { 
  Printer, 
  MoreVertical, 
  Play, 
  Pause, 
  Trash2, 
  TestTube, 
  Star,
  MapPin,
  Clock,
  Activity,
  Wifi,
  WifiOff,
  Edit,
  Tag,
  Wrench
} from 'lucide-react'
import { getStatusDotClass, formatDate } from '../lib/utils'

export default function PrinterCard({ printer, onTest, onToggle, onSetDefault, onDelete, onEdit, onMaintenance, canManage }) {
  const statusColors = getStatusColors(printer.status)
  const snmpColor = getSnmpColor(printer)
  const isOffline = printer.status === 'offline' || printer.status === 'error'
  const inMaintenance = !!printer.in_maintenance
  
  // Determine SNMP badge color based on printer health
  const getSnmpBadgeClass = () => {
    if (!printer.snmp_enabled) return 'bg-gray-100 text-gray-500'
    if (isOffline) return 'bg-red-100 text-red-700'
    // toner_level: -1 means unknown/not available, treat as OK
    if (printer.toner_level !== null && printer.toner_level >= 0 && printer.toner_level <= 10) return 'bg-orange-100 text-orange-700'
    if (printer.toner_level !== null && printer.toner_level >= 0 && printer.toner_level <= 20) return 'bg-yellow-100 text-yellow-700'
    return 'bg-green-100 text-green-700'
  }
  
  return (
    <Card className={`hover:shadow-md transition-shadow overflow-hidden h-full ${inMaintenance ? 'border-orange-300 bg-orange-50/50' : isOffline ? statusColors.border + ' ' + statusColors.bg : ''}`}>
      <CardContent className="p-4 h-full flex flex-col">
        {/* Maintenance Banner */}
        {inMaintenance && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-orange-100 rounded-md text-orange-800 text-xs">
            <Wrench className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="font-medium">In Maintenance</span>
            {printer.maintenance_note && (
              <span className="text-orange-600 truncate">— {printer.maintenance_note}</span>
            )}
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0 ${inMaintenance ? 'bg-orange-100' : isOffline ? 'bg-red-100' : 'bg-muted'}`}>
              <Printer className={`h-6 w-6 ${inMaintenance ? 'text-orange-500' : isOffline ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link 
                  to={`/printers/${printer.id}`}
                  className={`font-semibold hover:text-primary transition-colors truncate ${isOffline ? statusColors.text : ''}`}
                >
                  {printer.name}
                </Link>
                {!!printer.is_default && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{printer.ip_address}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={getStatusDotClass(printer.status)} />
            <Badge className={statusColors.badge}>
              {printer.status === 'unknown' && printer.printer_type === 'thermal' 
                ? 'ready' 
                : (printer.status || 'unknown')}
            </Badge>
          </div>
        </div>
        
        <div className="mt-3 flex flex-wrap gap-1 text-sm">
          {/* Printer Type Badge */}
          {printer.printer_type === 'thermal' ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              <span className="text-xs">🧾 Thermal</span>
            </div>
          ) : (
            /* SNMP Status - only show for network printers */
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${getSnmpBadgeClass()}`}>
              {!!printer.snmp_enabled ? (
                <><Activity className="h-3 w-3" /><span className="text-xs">SNMP</span></>
              ) : (
                <><WifiOff className="h-3 w-3" /><span className="text-xs">Ping Only</span></>
              )}
            </div>
          )}
          
          {printer.location && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              <MapPin className="h-3 w-3" />
              <span className="text-xs truncate max-w-[60px]">{printer.location}</span>
            </div>
          )}

          {/* Tags - compact display */}
          {printer.tags && (() => {
            const tagList = printer.tags.split(',').map(t => t.trim()).filter(t => t)
            if (tagList.length === 0) return null
            return (
              <div 
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 cursor-help"
                title={tagList.join(', ')}
              >
                <Tag className="h-3 w-3" />
                <span className="text-xs">{tagList.length} tag{tagList.length > 1 ? 's' : ''}</span>
              </div>
            )
          })()}
        </div>
        
        {/* Spacer to push content down */}
        <div className="flex-1" />
        
        {/* Last check time */}
        {printer.last_check && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="truncate">{formatDate(printer.last_check)}</span>
          </div>
        )}
        
        {/* Toner Level (if available and valid) */}
        {printer.toner_level !== null && printer.toner_level !== undefined && printer.toner_level >= 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Toner</span>
              <span>{printer.toner_level}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  printer.toner_level > 20 ? 'bg-green-500' : 
                  printer.toner_level > 10 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(printer.toner_level, 2)}%` }}
              />
            </div>
          </div>
        )}
        {/* Unknown toner level */}
        {!!printer.snmp_enabled && (printer.toner_level === null || printer.toner_level === undefined || printer.toner_level < 0) && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Toner</span>
              <span className="text-gray-400">N/A</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gray-300 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
        )}
        
        {/* Spacer to push content down */}
        <div className="flex-1" />
        
        {canManage && (
          <div className="mt-4 flex gap-2 border-t pt-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onTest(printer)}
            >
              <TestTube className="h-4 w-4 mr-1" />
              Test
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onEdit(printer)}
              title="Edit printer"
            >
              <Edit className="h-4 w-4" />
            </Button>
            
            {/* Maintenance toggle */}
            <Button 
              variant="outline" 
              size="sm"
              className={inMaintenance ? 'bg-orange-100 border-orange-300 text-orange-700' : ''}
              onClick={() => onMaintenance(printer)}
              title={inMaintenance ? 'End maintenance' : 'Put in maintenance'}
            >
              <Wrench className="h-4 w-4" />
            </Button>
            
            {printer.status === 'paused' ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onToggle(printer, true)}
              >
                <Play className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onToggle(printer, false)}
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            
            {!printer.is_default && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onSetDefault(printer)}
                title="Set as default"
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(printer)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
