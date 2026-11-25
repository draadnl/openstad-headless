import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import toast from 'react-hot-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<unknown>;
  folderName: string;
};

export function ProjectFolderDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  folderName,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      toast.success('Map verwijderd.');
      onOpenChange(false);
    } catch (error) {
      toast.error('Map verwijderen is niet gelukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Map verwijderen</DialogTitle>
        </DialogHeader>
        <p>
          De map <strong className="break-words">{folderName}</strong> wordt
          verwijderd. De projecten in deze map blijven bestaan.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            Verwijderen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
