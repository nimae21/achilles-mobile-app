import type { OrderStatusKey } from './api'

export function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value))
}

export function compactMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '—'
  if (Math.abs(amount) >= 1_000_000) return `₱${(amount / 1_000_000).toFixed(1)}M`
  if (Math.abs(amount) >= 1_000) return `₱${(amount / 1_000).toFixed(1)}K`
  return money(amount)
}

export function count(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-PH').format(Number(value ?? 0))
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function dateOnly(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-PH', { dateStyle: 'medium' })
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return dateOnly(value)
}

export function statusPillClass(status: string | null | undefined): string {
  const key = (status ?? '').toLowerCase().trim().replace(/\s+/g, '-')
  return key ? `pill pill--${key}` : 'pill'
}

export function orderStatusClass(status: OrderStatusKey | string): string {
  return statusPillClass(status)
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '—'
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '—'
  )
}