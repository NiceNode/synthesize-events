// Individual JSON objects prefixes
export const nodePrefix = 'node::'
export const nodeServicePrefix = 'node-service::'
export const userPrefix = 'user::'

// Static JSON objects
export const dailyActiveNodesByDay = 'dailyActiveNodesByDay'
export const weeklyActiveNodesByDay = 'weeklyActiveNodesByDay'
export const monthlyActiveNodesByDay = 'monthlyActiveNodesByDay'

// Sets
export const dailyActiveNodesSet = 'dailyActiveNodes'
export const weeklyActiveNodesSet = 'weeklyActiveNodes'
export const monthlyActiveNodesSet = 'monthlyActiveNodes'

export interface NodeOrNodeServiceJson {
  nodeId: string
  specId: string
  specVersion: string
  status: string
  lastReportedTimestamp: number
  region: string
  city: string
  country: string
  userId: string
  diskUsedGBs?: number
  network?: string
  lastRunningTimestampMs?: number
  lastStartedTimestampMs?: number
  [someKey: string]: unknown // required type-check from json.set()
}

export interface NodeJson extends NodeOrNodeServiceJson {
  serviceIds: string[]
}

export interface NodeServiceJson extends NodeOrNodeServiceJson {
  serviceId: string
}

export interface UserJson {
  userId: string
  lastReportedTimestamp: number
  country: string
  region: string
  city: string
  platform: string
  platformRelease: string
  arch: string
  niceNodeVersion: string
  nodeIds: string[]
  /**
   * In bytes
   */
  freeMemory?: number
  /**
   * In bytes
   */
  totalMemory?: number
  [someKey: string]: unknown // required type-check from json.set()
}
