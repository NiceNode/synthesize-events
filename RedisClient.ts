import { Redis } from '@upstash/redis'
import 'dotenv/config'

class RedisClient {
  private readonly client: Redis

  constructor() {
    // Replace these with your Upstash Redis connection details
    if (
      process.env.UPSTASH_REDIS_REST_URL === undefined ||
      process.env.UPSTASH_REDIS_REST_TOKEN === undefined
    ) {
      throw new Error(
        'env vars UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.',
      )
    }
    // } else {
    //   console.log(process.env.UPSTASH_REDIS_REST_URL + " : " + process.env.UPSTASH_REDIS_REST_TOKEN);
    // }
    const redisUrl: string = process.env.UPSTASH_REDIS_REST_URL
    const redisPassword: string = process.env.UPSTASH_REDIS_REST_TOKEN

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
}

export default RedisClient
