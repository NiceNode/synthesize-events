import util from 'util'

export const logDeepObj = (myObject: unknown): void => {
  console.log(util.inspect(myObject, { showHidden: false, depth: null, colors: true }))
}
