import { SearchX } from 'lucide-react'

export default function EmptyState({ title = 'Nothing here yet', message = 'Try a different search or filter.' }) {
  return (
    <div className="empty-state">
      <span><SearchX size={22} /></span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  )
}
