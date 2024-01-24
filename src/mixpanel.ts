/* eslint-disable @typescript-eslint/indent */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/naming-convention */
export interface NiceNodeContext {
  arch: string
  freeMemory: number
  niceNodeVersion: string
  platform: 'win32' | 'macOS' | 'linux'
  platformRelease: string
  totalMemory: number
}
/**
 * Mixpanel docs https://docs.mixpanel.com/docs/data-structure/property-reference#event-properties-1
 */
export interface MixpanelEvent {
  event:
    | 'OpenApp'
    | 'AddNodePackage'
    | 'DailyUserReport'
    | 'UserCheckForUpdateNN'
    | 'ErrorInstallPodman'
    | '$mp_web_page_view'
    | string
  properties: {
    /**
     * unique event identifier
     * More https://docs.mixpanel.com/docs/data-structure/property-reference#event-properties-1
     */
    $insert_id: string
    /**
     * utc timestamp in seconds
     */
    time: number
    /**
     * same as $user_id, distinct user id set by NN
     */
    distinct_id: string
    $city: string
    $region: string
    $os: string
    mp_country_code: string
    /**
     * set by mixpanel
     */
    $device_id: string
    /**
     * same as distinct_id, distinct user id set by NN
     */
    $user_id: string
    context?: NiceNodeContext
    eventData?: any
    [key: string]: any
  }
}
