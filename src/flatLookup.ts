/** Resolved data for one home, from the config file. */
export type FlatInfo = {
  flatNo: string
  owner: string
  phone: string
  /** Free-form notes; included in directory search. */
  details: string
}

export type FlatLookup = Map<string, FlatInfo>
