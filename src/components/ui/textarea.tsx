import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export default function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={cn('ui-textarea', className)} {...props} />
}

