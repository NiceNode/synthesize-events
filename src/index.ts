import { nodePrefix, type NodeJson, type UserJson, type NodeServiceJson, nodeServicePrefix, userPrefix } from './redisTypes'
import { eventsRedisClient, impactDashRedisClient, iterateSet } from './RedisClient'
import { type MixpanelEvent, type DailyUserReport } from './mixpanel'
import { convertYyyyMmDdToUTCDate, dateToYyyyMmDd, getTodayYyyyMmDd, getYesterdayYyyyMmDd, logDeepObj } from './util'
import { copyPreviousWeekMonthActiveNodes, indexActiveNodeSets, indexSingleNodeReport, initializeDateConstants } from './activeNodesIndexing'
// const argv = require('minimist')(process.argv.slice(2));
import minimist from 'minimist'

// ================ Index dates setup ====================
/**
 * Today in UTC. Regardless of day which is being indexed.
 * Ex. '2024-01-28'
 */
export const TODAY_YYYY_MM_DD = getTodayYyyyMmDd()

/**
 * Yesterday in UTC. Regardless of day which is being indexed.
 * Ex. '2024-01-27'
 */
export const YESTERDAY_YYYY_MM_DD = getYesterdayYyyyMmDd()

/**
 * -day "yyyy-MM-dd" optional for backfil
 */
const argv = minimist(process.argv.slice(2))
console.log('minimist(argv) = ', argv)
/**
 * Yesterday (YESTERDAY_YYYY_MM_DD) is the default day to index!
 * Today does not make sense because today is still in progress :)
 */
export let dayToIndexYyyyMmDd = YESTERDAY_YYYY_MM_DD
if (typeof argv.day === 'string') {
  dayToIndexYyyyMmDd = argv.day
}
export const dayToIndexDate = convertYyyyMmDdToUTCDate(dayToIndexYyyyMmDd)
export const dayBeforeDayToIndexDate = new Date(dayToIndexDate.getTime())
dayBeforeDayToIndexDate.setDate(dayToIndexDate.getDate() - 1)
export const dayBeforeDayToIndexYyyyMmDd = dateToYyyyMmDd(dayBeforeDayToIndexDate)
/**
 * This script reads events from this day and indexes active
 * nodes (across 3 sliding windows day, week, month) for this day only.
 * yyyy-MM-dd (ex. 2024-01-25)
 */
// '2024-01-31'
// --------------- End Index dates setup ---------------

console.log('Hello from TypeScript and Node.js!')
console.log(`My timezone is: ${process.env.TZ}`)
console.log(`Indexing for day: ${dayToIndexYyyyMmDd} and today is: ${TODAY_YYYY_MM_DD}. Day before index day is: ${dayBeforeDayToIndexYyyyMmDd}`)

const eventsByDayPrefixWithoutDate = 'eventsByDay'
const makeAEventsByDayPrefix = (yyyyMMddString: string): string =>
  `${eventsByDayPrefixWithoutDate}::${yyyyMMddString}`

const processEvent = async (eventId: string | number): Promise<void> => {
  const eventIdStr = eventId as string
  // console.log('process eventId: ', eventIdStr)

  // Only processing Daily Reports for now
  const eventRedisObj = await eventsRedisClient.client.json.get(eventIdStr)

  if (eventRedisObj === null) {
    throw new Error(`eventId not found in redis: ${eventId}`)
  }
  // console.log('process eventRedisObj: ', eventRedisObj, typeof eventRedisObj)

  const event = eventRedisObj as MixpanelEvent
  // console.log('process event: ', event)
  if (event.event === 'DailyUserReport') {
    logDeepObj(event)
    const dailyEvent = event as DailyUserReport
    const properties = dailyEvent.properties
    const userId = properties.$user_id
    const commonProperties = {
      region: properties.$region,
      city: properties.$city,
      country: properties.mp_country_code,
      userId,
    }
    const eventTime = properties.time

    // Upsave each node of the user
    for (const nodeId in properties.eventData) {
      const node = properties.eventData[nodeId]
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const serviceIds = Object.keys(node.nodes)
      const nodeJson: NodeJson = {
        nodeId,
        specId: node.specId,
        specVersion: node.specVersion,
        serviceIds,
        status: node.status,
        lastReportedTimestamp: eventTime,
        diskUsedGBs: node.diskUsedGBs,
        network: node.network,
        lastRunningTimestampMs: node.lastRunningTimestampMs,
        lastStartedTimestampMs: node.lastStartedTimestampMs,
        ...commonProperties
      }
      // todo: add check to only update if this eventTime > savedNodeJson.lastReportedTimestamp
      await impactDashRedisClient.client.json.set(`${nodePrefix}${nodeId}`, '$', nodeJson)
      // Upsave each service of the node
      for (const serviceId in node.nodes) {
        const service = node.nodes[serviceId]
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const nodeServiceJson: NodeServiceJson = {
          nodeId,
          serviceId,
          specId: service.specId,
          specVersion: service.specVersion,
          status: service.status,
          lastReportedTimestamp: eventTime,
          diskUsedGBs: service.diskUsedGBs,
          network: service.network,
          lastRunningTimestampMs: service.lastRunningTimestampMs,
          lastStartedTimestampMs: service.lastStartedTimestampMs,
          ...commonProperties,
        }
        // todo: add check to only update if this eventTime > savedNodeJson.lastReportedTimestamp
        await impactDashRedisClient.client.json.set(`${nodeServicePrefix}${serviceId}`, '$', nodeServiceJson)
      }

      // Upsave user
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const nodeIds = Object.keys(properties.eventData)
      const userJson: UserJson = {
        lastReportedTimestamp: eventTime,
        ...commonProperties,
        ...properties.context,
        nodeIds,
      }
      // todo: add check to only update if this eventTime > savedNodeJson.lastReportedTimestamp
      await impactDashRedisClient.client.json.set(`${userPrefix}${userId}`, '$', userJson)
      // todo: active users sets

      // Upsave the node into active node sets
      await indexSingleNodeReport(nodeJson)
    } // end processing a single node in a DailyUserReport
  } // end looping nodes in a DailyUserReport (for (const nodeId in properties.eventData))
} // end iterate set

// ===============  Main high-level algo  ===================
// 1. Iterate new (daily) events
// 2. Save/update node, service, and user data from the new events
// 3. Iterate all the nodes and calc active node metadata
export const dailyIndexingRoutine = async (): Promise<void> => {
  initializeDateConstants(dayBeforeDayToIndexYyyyMmDd, dayToIndexDate, dayToIndexYyyyMmDd)
  await copyPreviousWeekMonthActiveNodes()
  await iterateSet(eventsRedisClient, makeAEventsByDayPrefix(dayToIndexYyyyMmDd), processEvent)
  await indexActiveNodeSets()
}
void dailyIndexingRoutine()

// ============ Troubleshooting ==============
// const testConnection = async (): Promise<void> => {
//   console.log(await eventsRedisClient.get('hi'))
//   console.log(await impactDashRedisClient.get('hi'))
// }
// void testConnection()
