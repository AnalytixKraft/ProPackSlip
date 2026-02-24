import type { HTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type HelperTone = 'default' | 'danger' | 'success'

type HelperTextProps = HTMLAttributes<HTMLParagraphElement> & {
  tone?: HelperTone
}

export default function HelperText({
  className,
  tone = 'default',
  ...props
}: HelperTextProps) {
  return (
    <p className={cn('ui-helper-text', `ui-helper-text--${tone}`, className)} {...props} />
  )
}

