export const CATEGORIES = ['Food', 'Transport', 'Rent', 'Fun', 'Other']

export const CAT_COLORS = {
  Food:      '#4169E1',
  Transport: '#F7A8C4',
  Rent:      '#818cf8',
  Fun:       '#fb923c',
  Other:     '#34d399',
}

export const CAT_BG = {
  Food:      '#4169E11a',
  Transport: '#F7A8C41a',
  Rent:      '#818cf81a',
  Fun:       '#fb923c1a',
  Other:     '#34d3991a',
}

export const pkr = (n) =>
  `Rs ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`
