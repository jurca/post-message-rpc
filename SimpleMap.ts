// Some Map polyfills have issues with the WindowProxy objects from other origins, resulting in errors being thrown
// while the said polyfills are trying to serialize the object into a hash code. To circumvent this issue, the
// following low-performance (good for small maps) map implementation will be used where needed.

export default class SimpleMap<K, V> {
  private keys: K[] = []
  private values: V[] = []

  public has(key: K): boolean {
    return this.getKeyIndex(key) > -1
  }

  public get(key: K): V | undefined {
    const index = this.getKeyIndex(key)
    return this.values[index]
  }

  public set(key: K, value: V): void {
    this.delete(key)
    this.keys.push(key)
    this.values.push(value)
  }

  public delete(key: K): boolean {
    const index = this.getKeyIndex(key)
    if (index > -1) {
      this.keys.splice(index, 1)
      this. values.splice(index, 1)
      return true
    }
    return false
  }

  private getKeyIndex(key: K): number {
    return this.keys.indexOf(key)
  }
}
