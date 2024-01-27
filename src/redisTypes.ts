export interface NodeOrNodeServiceJson {
  nodeId: string
  specId: string
  specVersion: string
  status: string
  lastActiveTimestamp: number
  region: string
  city: string
  country: string
  userId: string
  diskUsedGBs?: number
  network?: string
}

export interface NodeJson extends NodeOrNodeServiceJson {
  serviceIds: string[]
}

export interface NodeServiceJson extends NodeOrNodeServiceJson {
  serviceId: string
}

export interface UserJson {
  userId: string
  lastActiveTimestamp: number
  country: string
  region: string
  city: string
  os: string
  niceNodeVersion: string
  nodeIds: string[]
}
