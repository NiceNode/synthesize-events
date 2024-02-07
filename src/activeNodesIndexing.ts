import {
  type NodeJson, nodePrefix, makeAKeyByDay, dailyActiveNodesSetByDay,
  dailyActiveNodesByDay, weeklyActiveNodesByDay, monthlyActiveNodesByDay, weeklyActiveNodesSetByDay, monthlyActiveNodesSetByDay
} from './redisTypes'
import { impactDashRedisClient, iterateSet } from './RedisClient'

const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000 // 24 hours, 60 minutes per hour, 60 seconds per minute, 1000 milliseconds per second
const ONE_WEEK_MILLISECONDS = 7 * ONE_DAY_MILLISECONDS // 7 days in a week
const ONE_MONTH_MILLISECONDS = 30 * ONE_DAY_MILLISECONDS // Assuming 30 days in a month for simplicity

// Separate thresholds for when the indexing day is different from today (yesterday?)
let dayToIndexYyyyMmDd: string | null = null
let indexDayStartOfDay: Date | null = null
let indexDayTimestampStartOfDay: number | null = null

let dailyThresholdTimeMs: number | null = null
let weeklyThresholdTimeMs: number | null = null
let monthlyThresholdTimeMs: number | null = null
console.log('Active nodes sets indexing threshold timestamps (daily, weekly, monthly): ',
  dailyThresholdTimeMs, weeklyThresholdTimeMs, monthlyThresholdTimeMs)

/**
 * Used to keep track of historically active nodes by day, week, and month
 */
let dailyActiveNodesByDayKey: string | null = null
let weeklyActiveNodesByDayKey: string | null = null
let monthlyActiveNodesByDayKey: string | null = null
let dayBeforeWeeklyActiveNodesByDayKey: string | null = null
let dayBeforeMonthlyActiveNodesByDayKey: string | null = null

export const initializeDateConstants = (dayBeforeDayToIndexYyyyMmDd: string,
  dayToIndexDate: Date, argDayToIndexYyyyMmDd: string): void => {
  dayToIndexYyyyMmDd = argDayToIndexYyyyMmDd
  // Separate thresholds for when the indexing day is different from today (yesterday?)
  indexDayStartOfDay = new Date(dayToIndexDate.getFullYear(), dayToIndexDate.getMonth(), dayToIndexDate.getDate())
  indexDayTimestampStartOfDay = indexDayStartOfDay.getTime()

  dailyThresholdTimeMs = indexDayTimestampStartOfDay - ONE_DAY_MILLISECONDS
  weeklyThresholdTimeMs = indexDayTimestampStartOfDay - ONE_WEEK_MILLISECONDS
  monthlyThresholdTimeMs = indexDayTimestampStartOfDay - ONE_MONTH_MILLISECONDS
  console.log('Active nodes sets indexing threshold timestamps (daily, weekly, monthly): ',
    dailyThresholdTimeMs, weeklyThresholdTimeMs, monthlyThresholdTimeMs)

  /**
 * Used to keep track of historically active nodes by day, week, and month
 */
  dailyActiveNodesByDayKey = makeAKeyByDay(dailyActiveNodesSetByDay, dayToIndexYyyyMmDd)
  weeklyActiveNodesByDayKey = makeAKeyByDay(weeklyActiveNodesSetByDay, dayToIndexYyyyMmDd)
  monthlyActiveNodesByDayKey = makeAKeyByDay(monthlyActiveNodesSetByDay, dayToIndexYyyyMmDd)
  dayBeforeWeeklyActiveNodesByDayKey = makeAKeyByDay(weeklyActiveNodesSetByDay, dayBeforeDayToIndexYyyyMmDd)
  dayBeforeMonthlyActiveNodesByDayKey = makeAKeyByDay(monthlyActiveNodesSetByDay, dayBeforeDayToIndexYyyyMmDd)
}

/**
 * This function takes a node report and looks a node's lastRunningTimestampMs
 * to see if it has been active for the day being indexed.
 * modifies day/week/month...NodesByDay sets
 * @param nodeJson
 */
export const indexSingleNodeReport = async (nodeJson: NodeJson): Promise<void> => {
  console.log('indexSingleNodeReport nodeId: ', nodeJson.nodeId)
  if (dailyThresholdTimeMs === null || weeklyThresholdTimeMs === null || monthlyThresholdTimeMs === null ||
    dailyActiveNodesByDayKey === null || weeklyActiveNodesByDayKey === null || monthlyActiveNodesByDayKey === null) {
    throw new Error('A required time, date, or key is null.')
  }
  if (nodeJson.lastRunningTimestampMs == null) {
    return
  }

  // console.log(`node last running: ${nodeJson.lastRunningTimestampMs}, monthly thres`)
  // if node is active, save to active node sets
  if (nodeJson.lastRunningTimestampMs >= dailyThresholdTimeMs) {
    await impactDashRedisClient.addToSet(dailyActiveNodesByDayKey, nodeJson.nodeId)
  }
  if (nodeJson.lastRunningTimestampMs >= weeklyThresholdTimeMs) {
    await impactDashRedisClient.addToSet(weeklyActiveNodesByDayKey, nodeJson.nodeId)
  }
  if (nodeJson.lastRunningTimestampMs >= monthlyThresholdTimeMs) {
    console.log(`Monthly active set: adding ${nodeJson.nodeId} to set ${monthlyActiveNodesByDayKey}`)
    await impactDashRedisClient.addToSet(monthlyActiveNodesByDayKey, nodeJson.nodeId)
  }
}

export interface activeNodesIndex {
  count: number
  specId: Record<string, number>
  country: Record<string, number>
  [key: string]: unknown // redis req
}

// todo: special metrics for ethereum nodes like networks, client diversity, diskGBsUsed

const dailyActiveNodesIndex: activeNodesIndex = {
  count: 0,
  specId: {},
  country: {}
}
const weeklyActiveNodesIndex: activeNodesIndex = {
  count: 0,
  specId: {},
  country: {}
}
const monthlyActiveNodesIndex: activeNodesIndex = {
  count: 0,
  specId: {},
  country: {}
}

/**
 * Looks at a node's lastRunningTimestampMs to see if it should be included in an active node set.
 * If the node is active, then the node's metadata will be indexed in the global index vars:
 * dailyActiveNodesIndex, weeklyActiveNodesIndex, monthlyActiveNodesIndex
 * @param setKey a redis set key. daily, weekly, or monthly.
 * @returns
 */
const processNode = (
  setKey: string,
  timePeriod: 'daily' | 'weekly' | 'monthly'
): (nodeIdStrOrNum: string | number) => Promise<void> => {
  return async (nodeIdStrOrNum: string | number): Promise<void> => {
    if (dailyThresholdTimeMs === null || weeklyThresholdTimeMs === null || monthlyThresholdTimeMs === null) {
      throw new Error('A required time, date, or key is null.')
    }
    const nodeId = nodeIdStrOrNum as string
    const node: NodeJson = await impactDashRedisClient.client.json.get(`${nodePrefix}${nodeId}`)

    // console.log(`Indexing. processNode ${nodeId}, setKey ${setKey}, node ${JSON.stringify(node)}`)

    let indexToUpdate
    if (timePeriod === 'daily') {
      if (node.lastRunningTimestampMs == null || node.lastRunningTimestampMs < dailyThresholdTimeMs) {
        console.log(`Removing ${nodeId} from daily set`)
        await impactDashRedisClient.removeFromSet(setKey, nodeId)
      } else {
        // node was detected running that day, update indexing data
        indexToUpdate = dailyActiveNodesIndex
      }
    } else if (timePeriod === 'weekly') {
      if (node.lastRunningTimestampMs == null || node.lastRunningTimestampMs < weeklyThresholdTimeMs) {
        console.log(`Removing ${nodeId} from weekly set`)
        await impactDashRedisClient.removeFromSet(setKey, nodeId)
      } else {
        // node was detected running that week, update indexing data
        indexToUpdate = weeklyActiveNodesIndex
      }
    } else if (timePeriod === 'monthly') {
      if (node.lastRunningTimestampMs == null || node.lastRunningTimestampMs < monthlyThresholdTimeMs) {
        console.warn(`Removing ${nodeId} from monthly set...${node.lastRunningTimestampMs} and ${monthlyThresholdTimeMs}`)
        await impactDashRedisClient.removeFromSet(setKey, nodeId)
      } else {
        // node was detected running that month, update indexing data
        indexToUpdate = monthlyActiveNodesIndex
      }
    }

    // if undefined, then the node was removed from the active set and should not be counted in the index
    if (indexToUpdate !== undefined) {
      console.log(`Indexing ${nodeId} ${JSON.stringify(node)} to ${JSON.stringify(indexToUpdate)} set`)
      indexToUpdate.count++
      if (indexToUpdate.specId[node.specId] === undefined) {
        indexToUpdate.specId[node.specId] = 1
      } else {
        indexToUpdate.specId[node.specId]++
      }
      if (indexToUpdate.country[node.country] === undefined) {
        indexToUpdate.country[node.country] = 1
      } else {
        indexToUpdate.country[node.country]++
      }
    } else {
      console.error(`Indexing ${nodeId} indexToUpdate is undefined`)
    }
  }
}

export const copyPreviousWeekMonthActiveNodes = async (): Promise<void> => {
  if (dailyThresholdTimeMs === null || weeklyThresholdTimeMs === null || monthlyThresholdTimeMs === null ||
    dailyActiveNodesByDayKey === null || weeklyActiveNodesByDayKey === null || monthlyActiveNodesByDayKey === null ||
    dayToIndexYyyyMmDd === null || dayBeforeWeeklyActiveNodesByDayKey === null || dayBeforeMonthlyActiveNodesByDayKey === null) {
    throw new Error('A required time, date, or key is null.')
  }
  // First copy previous day's non-daily active node sets to the index day's sets before updating
  // day doesn't need copied, because it is ONLY created from the daily event reports that are processed in the next step
  console.log(`Redis copying set ${dayBeforeWeeklyActiveNodesByDayKey} to ${weeklyActiveNodesByDayKey}`)
  const copyResult = await impactDashRedisClient.client.copy(dayBeforeWeeklyActiveNodesByDayKey, weeklyActiveNodesByDayKey, { replace: true })
  console.log('Copy result, ', copyResult)
  console.log(`Redis copying set ${dayBeforeMonthlyActiveNodesByDayKey} to ${monthlyActiveNodesByDayKey}`)
  const copyResult2 = await impactDashRedisClient.client.copy(dayBeforeMonthlyActiveNodesByDayKey, monthlyActiveNodesByDayKey, { replace: true })
  console.log('Copy result2, ', copyResult2)
}

/**
 * // for each node in a event report
  //  if not active "enough", remove from set
  //  else
  //      bump count for set
  //      bump count for region, type, etc.

  // once done with all nodes
  // store count of each set byDay
  // store count of each region, type, etc. byDay
 */
export const indexActiveNodeSets = async (): Promise<void> => {
  if (dailyThresholdTimeMs === null || weeklyThresholdTimeMs === null || monthlyThresholdTimeMs === null ||
    dailyActiveNodesByDayKey === null || weeklyActiveNodesByDayKey === null || monthlyActiveNodesByDayKey === null ||
    dayToIndexYyyyMmDd === null || dayBeforeWeeklyActiveNodesByDayKey === null || dayBeforeMonthlyActiveNodesByDayKey === null) {
    throw new Error('A required time, date, or key is null.')
  }

  // clean and index active sets - iterate daily, weekly, monthly sets and count active by type, region, etc.
  await iterateSet(impactDashRedisClient, dailyActiveNodesByDayKey, processNode(dailyActiveNodesByDayKey, 'daily'))
  await iterateSet(impactDashRedisClient, weeklyActiveNodesByDayKey, processNode(weeklyActiveNodesByDayKey, 'weekly'))
  await iterateSet(impactDashRedisClient, monthlyActiveNodesByDayKey, processNode(monthlyActiveNodesByDayKey, 'monthly'))

  // save indexed data
  await impactDashRedisClient.client.json.set(makeAKeyByDay(dailyActiveNodesByDay, dayToIndexYyyyMmDd), '$', dailyActiveNodesIndex)
  await impactDashRedisClient.client.json.set(makeAKeyByDay(weeklyActiveNodesByDay, dayToIndexYyyyMmDd), '$', weeklyActiveNodesIndex)
  await impactDashRedisClient.client.json.set(makeAKeyByDay(monthlyActiveNodesByDay, dayToIndexYyyyMmDd), '$', monthlyActiveNodesIndex)
}
