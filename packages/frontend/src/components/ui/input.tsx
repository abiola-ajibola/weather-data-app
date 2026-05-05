import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn(
      'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25',
      className,
    )}
    {...props}
  />
)
