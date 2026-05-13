// Validator network pentagon positions (in % of container)
export const VALIDATOR_POSITIONS = [
  { x: 50, y: 6 },
  { x: 88, y: 33 },
  { x: 73, y: 80 },
  { x: 27, y: 80 },
  { x: 12, y: 33 },
];

export const VALIDATOR_LABELS = ["α", "β", "γ", "δ", "ε"];

export const TRIAGE_CFG = {
  EMERGENCY: { label: "EMERGENCY",        action: "Go to Emergency Room immediately",       colorKey: "emergency", severity: 4, gauge: 100 },
  URGENT:    { label: "URGENT",           action: "See a doctor within 24–48 hours",        colorKey: "urgent",    severity: 3, gauge: 75 },
  SOON:      { label: "SEE DOCTOR SOON",  action: "Schedule an appointment this week",      colorKey: "soon",      severity: 2, gauge: 50 },
  HOME_CARE: { label: "HOME CARE",        action: "Rest at home and monitor symptoms",      colorKey: "homecare",  severity: 1, gauge: 25 },
};
