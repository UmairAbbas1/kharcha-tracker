import {
  Utensils, Car, Home, Smile, MoreHorizontal, Wallet,
} from 'lucide-react'

// Maps Supabase icon field (lucide name string) → component
const iconMap = {
  Utensils,
  Car,
  Home,
  Smile,
  MoreHorizontal,
  Wallet,
}

export function categoryIcon(iconName = 'MoreHorizontal', color = '#94a3b8', size = 16) {
  const Icon = iconMap[iconName] || MoreHorizontal
  return <Icon size={size} color={color} />
}
