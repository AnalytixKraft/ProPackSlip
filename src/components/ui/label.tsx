import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>

export default function Label({ className, ...props }: LabelProps) {
  return <label className={cn('ui-label', className)} {...props} />
}

