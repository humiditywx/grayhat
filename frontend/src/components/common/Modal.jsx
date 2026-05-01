import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'

export default function Modal({ title, onClose, children, center = false }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto">
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}
