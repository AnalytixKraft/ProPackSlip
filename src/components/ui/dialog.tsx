import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type DialogProps = HTMLAttributes<HTMLDialogElement> & {
  open?: boolean
}

export default function Dialog({ className, open, ...props }: DialogProps) {
  return <dialog className={cn('ui-dialog', className)} open={open} {...props} />
}

