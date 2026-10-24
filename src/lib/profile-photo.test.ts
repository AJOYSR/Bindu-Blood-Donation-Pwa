import { beforeEach, expect, test, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  getUser: vi.fn(), single: vi.fn(), upload: vi.fn(), remove: vi.fn(), prepare: vi.fn(), update: vi.fn()
}))
vi.mock('./supabase', () => ({ supabase: {
  auth: { getUser: mock.getUser },
  from: () => ({
    select: () => ({ eq: () => ({ single: mock.single }) }),
    update: mock.update
  }),
  storage: { from: () => ({ upload: mock.upload, remove: mock.remove,
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://photos.example/${path}` } })
  }) }
} }))
vi.mock('./image', () => ({ prepareProfilePhoto: mock.prepare, stripImageMetadata: vi.fn() }))
import { uploadProfilePhoto } from './api'

beforeEach(() => {
  vi.resetAllMocks()
  mock.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  mock.prepare.mockResolvedValue(new File(['processed'], 'profile.jpg', { type: 'image/jpeg' }))
  mock.upload.mockResolvedValue({ error: null })
  mock.remove.mockResolvedValue({ error: null })
  mock.update.mockImplementation(() => ({ eq: () => ({ select: () => ({ single: mock.single }) }) }))
})
const photo = () => new File(['photo'], 'photo.png', { type: 'image/png' })

test('rejects invalid types and oversized photos before upload', async () => {
  await expect(uploadProfilePhoto(new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('5 MB')
  await expect(uploadProfilePhoto(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).rejects.toThrow('5 MB')
  expect(mock.upload).not.toHaveBeenCalled()
})

test('requires a signed-in user', async () => {
  mock.getUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(uploadProfilePhoto(photo())).rejects.toThrow('Sign in')
  expect(mock.upload).not.toHaveBeenCalled()
})

test('saves the processed photo then removes the previous photo', async () => {
  mock.single.mockResolvedValueOnce({ data: { avatar_path: 'owner/old.jpg' }, error: null })
    .mockResolvedValueOnce({ data: { id: 'owner' }, error: null })
  const url = await uploadProfilePhoto(photo())
  expect(mock.prepare).toHaveBeenCalledOnce()
  const path = mock.upload.mock.calls[0][0]
  expect(path).toMatch(/^owner\/.+\.jpg$/)
  expect(mock.update).toHaveBeenCalledWith({ avatar_path: path })
  expect(mock.remove).toHaveBeenCalledWith(['owner/old.jpg'])
  expect(url).toBe(`https://photos.example/${path}`)
})

test('cleans up the new upload and preserves the old photo if profile save fails', async () => {
  mock.single.mockResolvedValueOnce({ data: { avatar_path: 'owner/old.jpg' }, error: null })
    .mockResolvedValueOnce({ data: null, error: new Error('Save failed') })
  await expect(uploadProfilePhoto(photo())).rejects.toThrow('Save failed')
  expect(mock.remove).toHaveBeenCalledExactlyOnceWith([mock.upload.mock.calls[0][0]])
})

test('does not save a profile when storage upload fails', async () => {
  mock.single.mockResolvedValueOnce({ data: { avatar_path: null }, error: null })
  mock.upload.mockResolvedValueOnce({ error: new Error('Upload failed') })
  await expect(uploadProfilePhoto(photo())).rejects.toThrow('Upload failed')
  expect(mock.update).not.toHaveBeenCalled()
})
