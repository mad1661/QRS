export interface ScheduledEvent {
  /** NHRA event code, e.g. "01-GF1". */
  code: string;
  /** Official event name. */
  name: string;
}

/**
 * Current-season NHRA Mission Foods Drag Racing Series schedule (2026, the
 * 75th-anniversary, 20-event season). Used as a convenience picker when
 * creating events; the name/code remain freely editable. Event codes follow
 * the workbook's "NN-XXn" convention (sequence number + venue abbreviation).
 */
export const NHRA_SCHEDULE: readonly ScheduledEvent[] = [
  { code: "01-GF1", name: "AMALIE Motor Oil NHRA Gatornationals" },
  { code: "02-PA1", name: "FMP NHRA Arizona Nationals presented by NGK Spark Plugs" },
  { code: "03-PC1", name: "Lucas Oil NHRA Winternationals" },
  { code: "04-CN1", name: "NHRA Four-Wide Nationals (Charlotte)" },
  { code: "05-AG1", name: "NHRA Southern Nationals" },
  { code: "06-CI1", name: "Gerber Collision & Glass Route 66 NHRA Nationals presented by PEAK" },
  { code: "07-MD1", name: "NHRA Potomac Nationals presented by JEGS" },
  { code: "08-NH1", name: "NHRA New England Nationals presented by bproauto" },
  { code: "09-BT1", name: "Super Grip NHRA Thunder Valley Nationals" },
  { code: "10-NO1", name: "Summit Racing Equipment NHRA Nationals" },
  { code: "11-SC1", name: "DENSO NHRA Sonoma Nationals" },
  { code: "12-SW1", name: "Muckleshoot Casino Resort NHRA Northwest Nationals" },
  { code: "13-BM1", name: "NHRA Nationals (Brainerd)" },
  { code: "14-II1", name: "Cornwell Quality Tools NHRA U.S. Nationals" },
  { code: "15-MI1", name: "NHRA Great Lakes Nationals" },
  { code: "16-RK1", name: "NHRA Nationals at The Rock" },
  { code: "17-MW1", name: "NAPA Auto Parts NHRA Midwest Nationals" },
  { code: "18-DT1", name: "Texas NHRA FallNationals" },
  { code: "19-LN1", name: "NHRA Nevada Nationals" },
  { code: "20-PC2", name: "IN-N-OUT BURGER NHRA Finals" },
];

export const SCHEDULE_BY_CODE: Record<string, ScheduledEvent> =
  Object.fromEntries(NHRA_SCHEDULE.map((e) => [e.code, e]));
