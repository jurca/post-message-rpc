import SimpleMap from '../SimpleMap'

describe('SimpleMap', () => {
  it('should support deleting entries', () => {
    const map = new SimpleMap()
    map.set(1, 'a')
    expect(map.has(1)).toBe(true)
    expect(map.delete(1)).toBe(true)
    expect(map.delete(1)).toBe(false)
    expect(map.has(1)).toBe(false)
  })
})
