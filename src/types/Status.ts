export enum State {
  missing,
  pending,
  success,
  failed
}
  
export interface Status {
  state: State,
  message: string
}


export interface DedicatedMsgSender {
  address: string,
  isDeployed:boolean,
  balance:string
}

export interface Chain {
  name:string,
  id:number
}