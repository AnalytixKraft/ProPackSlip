import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export default function Select({ className, ...props }: SelectProps) {
  return <select className={cn('ui-select', className)} {...props} />
}

