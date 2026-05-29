export interface ScheduledEvent {
  /** NHRA event code, e.g. "01-GF1". */
  code: string;
  /** Official event name. */
  name: string;
}

/**
 * The 2025 NHRA Mission Foods Drag Racing Series schedule, from the QRS
 * workbook's EVENTS tab. Used as a convenience picker when creating events;
 * the name/code remain freely editable.
 */
export const NHRA_2025_SCHEDULE: readonly ScheduledEvent[] = [
  { code: "01-GF1", name: "AMALIE Motor Oil NHRA Gatornationals" },
  { code: "02-PC1", name: "Lucas Oil NHRA Winternationals" },
  { code: "03-PA1", name: "NHRA Arizona Nationals" },
  { code: "04-LN1", name: "NHRA Four-Wide Nationals (Las Vegas)" },
  { code: "05-CN1", name: "NHRA Four-Wide Nationals (Charlotte)" },
  { code: "06-CI1", name: "Gerber Collision & Glass Route 66 NHRA Nationals" },
  { code: "07-NH1", name: "NHRA New England Nationals" },
  { code: "08-BT1", name: "Super Grip NHRA Thunder Valley Nationals" },
  { code: "09-RV1", name: "NHRA Virginia Nationals" },
  { code: "10-NO1", name: "Summit Racing Equipment NHRA Nationals" },
  { code: "11-SW1", name: "Muckleshoot Casino Resort NHRA Northwest Nationals" },
  { code: "12-SC1", name: "DENSO NHRA Sonoma Nationals" },
  { code: "13-BM1", name: "Lucas Oil NHRA Nationals" },
  { code: "14-II1", name: "Cornwell Quality Tools NHRA U.S. Nationals" },
  { code: "15-RP1", name: "Reading NHRA Nationals" },
  { code: "16-CN2", name: "NHRA 4-Wide Carolina Nationals" },
  { code: "17-MI1", name: "NHRA Midwest Nationals" },
  { code: "18-DT1", name: "Texas NHRA FallNationals" },
  { code: "19-LN2", name: "NHRA Nevada Nationals" },
  { code: "20-PC2", name: "IN-N-OUT BURGER NHRA Finals" },
];

export const SCHEDULE_BY_CODE: Record<string, ScheduledEvent> =
  Object.fromEntries(NHRA_2025_SCHEDULE.map((e) => [e.code, e]));
