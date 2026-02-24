import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type SheetProps = HTMLAttributes<HTMLElement> & {
  open?: boolean
}

export default function Sheet({
  className,
  open = false,
  ...props
}: SheetProps) {
  return (
    <aside
      className={cn('ui-sheet', open && 'ui-sheet--open', className)}
      data-open={open ? '1' : '0'}
      {...props}
    />
  )
}

