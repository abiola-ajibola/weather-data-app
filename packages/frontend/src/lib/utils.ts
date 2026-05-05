import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

export const toTitleCase = (value: string): string =>
  value
    .split(/[_\s-]+/)
    .map((part) =>
      part.length > 0
        ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`
        : part,
    )
    .join(' ')
