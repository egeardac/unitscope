/**
 * Common PCB features for comparison. Values in metres. These are typical
 * reference values, not design rules for any particular manufacturer.
 */
export interface PcbFeature {
  id: string;
  label: string;
  value: number;
  note: string;
}

export const PCB_FEATURES: PcbFeature[] = [
  { id: 'cu1oz', label: '1 oz copper thickness', value: 35e-6, note: 'about 35 µm (1.4 mil), nominal' },
  { id: 'trace6', label: '6 mil trace', value: 6 * 25.4e-6, note: 'common fine trace width' },
  { id: 'trace10', label: '10 mil trace', value: 10 * 25.4e-6, note: 'common signal trace width' },
  { id: 'qfn05', label: '0.5 mm pitch', value: 0.5e-3, note: 'fine-pitch QFN / QFP leads' },
  { id: 'soic', label: '1.27 mm pitch', value: 1.27e-3, note: 'SOIC lead pitch (50 mil)' },
  { id: 'board16', label: '1.6 mm board', value: 1.6e-3, note: 'standard FR-4 board thickness' },
  { id: 'header', label: '2.54 mm pitch', value: 2.54e-3, note: '0.1 in pin header / DIP pitch' },
];

export const PCB_FEATURE_BY_ID: Record<string, PcbFeature> = Object.fromEntries(PCB_FEATURES.map((f) => [f.id, f]));
