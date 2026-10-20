import { SearchX, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ title, text, icon: Icon = SearchX, action }: { title: string; text: string; icon?: LucideIcon; action?: ReactNode }) {
  return <div className="empty-state">
    <span className="empty-icon"><Icon /></span>
    <h3>{title}</h3>
    <p>{text}</p>
    {action && <div className="empty-action">{action}</div>}
  </div>
}
