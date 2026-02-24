import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type ToastProps = HTMLAttributes<HTMLDivElement>

export default function Toast({ className, ...props }: ToastProps) {
  return <div className={cn('ui-toast', className)} {...props} />
}

