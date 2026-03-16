'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteBrand } from '@/app/actions/brands'

interface DeleteBrandDialogProps {
  brandId: number
  brandName: string
}

export function DeleteBrandDialog({ brandId, brandName }: DeleteBrandDialogProps) {
  const [open, setOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    setPending(true)
    setError(null)
    const result = await deleteBrand(brandId, confirmInput)
    setPending(false)
    if (result?.error) {
      setError(result.error)
    }
    // On success, deleteBrand redirects — no further action needed
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { setOpen(v); if (!v) { setConfirmInput(''); setError(null) } }}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-destructive text-white hover:bg-destructive/90 h-9 px-4 py-2 cursor-pointer"
      >
        Delete Brand
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Brand</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{brandName}</strong> and all its connected
            accounts. Type the brand name to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="confirm-name">
            Type <strong>{brandName}</strong> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={brandName}
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmInput !== brandName || pending}
            onClick={handleDelete}
          >
            {pending ? 'Deleting...' : 'Delete Brand'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
