import { useState, useEffect } from 'react'
import { X, Tag, Edit } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'

export default function EditPrinterModal({ printer, onClose, onSave }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [tags, setTags] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tagArray, setTagArray] = useState([])

  useEffect(() => {
    if (printer) {
      setName(printer.name || '')
      setLocation(printer.location || '')
      setTags(printer.tags || '')
      setTagArray(printer.tags ? printer.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
    }
  }, [printer])

  const addTag = () => {
    if (tagInput.trim() && !tagArray.includes(tagInput.trim())) {
      const newTags = [...tagArray, tagInput.trim()]
      setTagArray(newTags)
      setTags(newTags.join(','))
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove) => {
    const newTags = tagArray.filter(t => t !== tagToRemove)
    setTagArray(newTags)
    setTags(newTags.join(','))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      id: printer.id,
      name: name.trim(),
      location: location.trim(),
      tags: tags.trim()
    })
  }

  if (!printer) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Edit Printer</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium block mb-1">Printer Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Printer"
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-sm font-medium block mb-1">Location (Optional)</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. 2nd Floor, Room 204"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium block mb-2 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </label>
            
            {/* Tag Input */}
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="Add tag (e.g. warehouse, color, finance)"
              />
              <Button type="button" onClick={addTag} variant="outline">
                Add
              </Button>
            </div>

            {/* Tag List */}
            {tagArray.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tagArray.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Use tags to organize printers by department, location, or type
            </p>
          </div>

          {/* Info */}
          <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
            <p><span className="font-medium">IP:</span> {printer.ip_address}</p>
            <p><span className="font-medium">Model:</span> {printer.model || 'Unknown'}</p>
            <p><span className="font-medium">Status:</span> {printer.status}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
