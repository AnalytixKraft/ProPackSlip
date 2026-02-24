import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type CardProps = HTMLAttributes<HTMLElement>

export default function Card({ className, ...props }: CardProps) {
  return <section className={cn('ui-card', className)} {...props} />
}

