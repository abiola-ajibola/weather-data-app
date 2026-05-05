import * as React from 'react'

import { cn } from '@/lib/utils'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'ghost' | 'danger'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', type = 'button', ...props }, ref) => {
    const variantClassName =
      variant === 'secondary'
        ? 'bg-secondary text-secondary-foreground hover:opacity-90'
        : variant === 'ghost'
          ? 'bg-transparent text-foreground hover:bg-muted'
          : variant === 'danger'
            ? 'bg-destructive text-white hover:opacity-90'
            : 'bg-primary text-primary-foreground hover:opacity-90'

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
          variantClassName,
          className,
        )}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
