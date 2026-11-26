// Shrinks an image in the browser before upload, so a phone photo or a
// screenshot becomes a web-sized file. Wide images are scaled to 2000px,
// which is sharp on the article column at 2x. GIFs keep their animation
// and are sent as they are.

const MAX_W = 2000
const MAX_BYTES = 3_000_000

export type PreparedImage = { type: string; data: string }

const toBase64 = (blob: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).split(',')[1] || '')
  r.onerror = () => fail(new Error('The image could not be read'))
  r.readAsDataURL(blob)
})

const load = (file: Blob) => new Promise<HTMLImageElement>((ok, fail) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => { URL.revokeObjectURL(url); ok(img) }
  img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('This file is not an image the browser can open')) }
  img.src = url
})

const encode = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob | null>((ok) => c.toBlob(ok, type, q))

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!/^image\/(jpeg|png|gif|webp)$/.test(file.type)) throw new Error('Use a JPEG, PNG, GIF or WebP image')
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new Error('This GIF is too large (3 MB at most)')
    return { type: file.type, data: await toBase64(file) }
  }
  const img = await load(file)
  const scale = Math.min(1, MAX_W / img.naturalWidth)
  if (scale === 1 && file.size <= 600_000) return { type: file.type, data: await toBase64(file) }
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * scale)
  c.height = Math.round(img.naturalHeight * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  // PNG keeps charts and screenshots crisp; fall back to JPEG if it is big.
  let type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  let out = await encode(c, type, 0.86)
  if (out && type === 'image/png' && out.size > 1_500_000) {
    const flat = document.createElement('canvas')
    flat.width = c.width; flat.height = c.height
    const g = flat.getContext('2d')!
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, flat.width, flat.height); g.drawImage(c, 0, 0)
    type = 'image/jpeg'; out = await encode(flat, type, 0.86)
  }
  if (!out) throw new Error('The image could not be prepared')
  if (out.size > MAX_BYTES) throw new Error('This image is too large even after resizing')
  return { type, data: await toBase64(out) }
}
