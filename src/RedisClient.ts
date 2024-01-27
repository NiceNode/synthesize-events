import { Redis, type ScanCommandOptions } from '@upstash/redis'
import 'dotenv/config'

export interface constructorArgs {
  initRedisUrl?: string
  initRedisToken?: string
}

class RedisClient {
  public client: Redis

  constructor({
    initRedisUrl,
    initRedisToken,
  }: constructorArgs) {
    const redisUrl = initRedisUrl ?? process.env.UPSTASH_REDIS_REST_URL
    const redisPassword = initRedisToken ?? process.env.UPSTASH_REDIS_REST_TOKEN

    if (redisUrl === undefined || redisPassword === undefined) {
      throw new Error('wahhh')
    }

    this.client = new Redis({
      url: redisUrl,
      token: redisPassword,
    })
  }

  /**
   * get a value for a key
   * @param key
   * @returns
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (error) {
      console.error(`Error getting key ${key}:`, error)
      return null
    }
  }

  /**
   * set a value for a key
   * @param key
   * @returns
   */
  async set(key: string, value: string): Promise<string | null> {
    try {
      return await this.client.set(key, value)
    } catch (error) {
      console.error(`Error setting key ${key}:`, error)
      throw error
    }
  }

  /**
   * create or add to a set the values
   * @param key
   * @param values new values to add to the set
   * @returns number of values newly added to the set
   */
  async addToSet(key: string, ...values: string[]): Promise<number | null> {
    try {
      return await this.client.sadd(key, ...values)
    } catch (error) {
      console.error(`Error setting key ${key}:`, error)
      throw error
    }
  }

  /**
   * @see — https://redis.io/commands/sscan
   */
  async sscan(key: string, cursor: number, opts?: ScanCommandOptions | undefined): Promise<[number, Array<string | number>]> {
    try {
      return await this.client.sscan(key, cursor, opts)
    } catch (error: any) {
      console.error(`Error setting key ${key}:`, error)
      throw error
    }
  }
}

export default RedisClient
