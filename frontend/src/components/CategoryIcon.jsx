import {
  Utensils, Car, Home, Smile, MoreHorizontal,
} from 'lucide-react'

const iconMap = {
  Food:      Utensils,
  Transport: Car,
  Rent:      Home,
  Fun:       Smile,
  Other:     MoreHorizontal,
}

export function categoryIcon(cat, color = '#4169E1', size = 16) {
  const Icon = iconMap[cat] || MoreHorizontal
  return <Icon size={size} color={color} />
}
