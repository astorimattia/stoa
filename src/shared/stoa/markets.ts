export type Market = {
  id: string
  name: string
  /** The area of the markets painting it occupies, in % of the image. */
  x: number
  y: number
  w: number
  h: number
}

/**
 * Where capital is moving, hidden in the landscape at stoa-landscape-markets-v2.
 * Named only on hover, never listed. Eight spots, spaced so no two crowd each other.
 */
export const markets: Market[] = [
  { id: 'nuclear', name: 'Nuclear', x: 18, y: 6, w: 10, h: 10 },
  { id: 'compute', name: 'Compute', x: 3, y: 23, w: 14, h: 11 },
  { id: 'power', name: 'Energy', x: 63, y: 11, w: 15, h: 10 },
  { id: 'defense', name: 'Defense & reindustrialization', x: 74, y: 23, w: 12, h: 13 },
  { id: 'space', name: 'Space infrastructure', x: 87, y: 22, w: 8, h: 22 },
  { id: 'drug-discovery', name: 'AI drug discovery', x: 55, y: 29, w: 18, h: 15 },
  { id: 'robotics', name: 'Robotics & drones', x: 46, y: 46, w: 19, h: 24 },
  { id: 'materials', name: 'Critical minerals', x: 66, y: 46, w: 22, h: 24 },
]
