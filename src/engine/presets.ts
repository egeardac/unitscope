import type { QuantityId } from './units';

/**
 * Value presets. "Typical" values are common orders of magnitude for
 * orientation, not specifications for any particular part.
 */
export interface Preset {
  label: string;
  text: string;
  unit: string;
  note: string;
  /** For voltage: open the AC view with this value as RMS. */
  ac?: boolean;
}

export const PRESETS: Record<QuantityId, Preset[]> = {
  voltage: [
    { label: '1.8 V', text: '1.8', unit: 'V', note: 'Low-voltage logic rail' },
    { label: '3.3 V', text: '3.3', unit: 'V', note: '3.3 V logic rail' },
    { label: '5 V', text: '5', unit: 'V', note: 'USB VBUS (nominal)' },
    { label: '12 V', text: '12', unit: 'V', note: 'Common bench / automotive rail' },
    { label: '1 mV', text: '1', unit: 'mV', note: 'Small sensor signal scale' },
    { label: '230 Vrms', text: '230', unit: 'V', note: 'EU mains (nominal), AC view', ac: true },
    { label: '120 Vrms', text: '120', unit: 'V', note: 'US mains (nominal), AC view', ac: true },
  ],
  current: [
    { label: '1 µA', text: '1', unit: 'uA', note: 'Micro-power sleep current scale' },
    { label: '4 mA', text: '4', unit: 'mA', note: '4–20 mA loop: lower limit' },
    { label: '20 mA', text: '20', unit: 'mA', note: '4–20 mA loop: upper limit' },
    { label: '500 mA', text: '500', unit: 'mA', note: 'USB 2.0 port limit' },
    { label: '1 A', text: '1', unit: 'A', note: 'One ampere' },
  ],
  resistance: [
    { label: '50 Ω', text: '50', unit: 'ohm', note: 'RF system impedance' },
    { label: '330 Ω', text: '330', unit: 'ohm', note: 'Common series resistor' },
    { label: '4.7 kΩ', text: '4.7', unit: 'kohm', note: 'Typical I²C pull-up' },
    { label: '10 kΩ', text: '10', unit: 'kohm', note: 'Common pull-up' },
    { label: '1 MΩ', text: '1', unit: 'Mohm', note: 'Typical scope input resistance' },
  ],
  capacitance: [
    { label: '22 pF', text: '22', unit: 'pF', note: 'Typical crystal load capacitor' },
    { label: '100 nF', text: '100', unit: 'nF', note: 'Decoupling capacitor' },
    { label: '10 µF', text: '10', unit: 'uF', note: 'Bulk decoupling' },
    { label: '100 µF', text: '100', unit: 'uF', note: 'Reservoir capacitor' },
    { label: '1000 µF', text: '1000', unit: 'uF', note: 'Power-supply smoothing' },
  ],
  inductance: [
    { label: '100 nH', text: '100', unit: 'nH', note: 'RF inductor scale' },
    { label: '4.7 µH', text: '4.7', unit: 'uH', note: 'Typical buck-converter inductor' },
    { label: '10 µH', text: '10', unit: 'uH', note: 'Power inductor' },
    { label: '1 mH', text: '1', unit: 'mH', note: 'Filter choke scale' },
  ],
  power: [
    { label: '1 mW', text: '1', unit: 'mW', note: '0 dBm reference' },
    { label: '250 mW', text: '250', unit: 'mW', note: '¼ W resistor rating' },
    { label: '1 W', text: '1', unit: 'W', note: '30 dBm' },
    { label: '100 W', text: '100', unit: 'W', note: 'Bench supply scale' },
  ],
  frequency: [
    { label: '50 Hz', text: '50', unit: 'Hz', note: 'Mains frequency (EU)' },
    { label: '60 Hz', text: '60', unit: 'Hz', note: 'Mains frequency (US)' },
    { label: '1 kHz', text: '1', unit: 'kHz', note: 'Audio test tone' },
    { label: '16 MHz', text: '16', unit: 'MHz', note: 'Typical MCU crystal' },
    { label: '2.4 GHz', text: '2.4', unit: 'GHz', note: 'Wi-Fi / Bluetooth band' },
  ],
  time: [
    { label: '1 ns', text: '1', unit: 'ns', note: 'Fast logic edge scale' },
    { label: '1 µs', text: '1', unit: 'us', note: 'Period of 1 MHz' },
    { label: '20 ms', text: '20', unit: 'ms', note: 'Period of 50 Hz' },
    { label: '16.67 ms', text: '16.67', unit: 'ms', note: 'Period of 60 Hz (rounded)' },
    { label: '1 s', text: '1', unit: 's', note: 'One second' },
  ],
  energy: [
    { label: '1 J', text: '1', unit: 'J', note: 'One joule' },
    { label: '1 Wh', text: '1', unit: 'Wh', note: '3600 J' },
    { label: '10 Wh', text: '10', unit: 'Wh', note: 'Phone battery scale' },
    { label: '1 kWh', text: '1', unit: 'kWh', note: 'Electricity billing unit' },
  ],
  charge: [
    { label: '1 C', text: '1', unit: 'C', note: 'One coulomb' },
    { label: '220 mAh', text: '220', unit: 'mAh', note: 'Typical CR2032 coin cell' },
    { label: '2000 mAh', text: '2000', unit: 'mAh', note: 'Typical 18650-size cell scale' },
    { label: '1 Ah', text: '1', unit: 'Ah', note: '3600 C' },
  ],
  pcb: [
    { label: '35 µm', text: '35', unit: 'um', note: '1 oz copper thickness (nominal)' },
    { label: '6 mil', text: '6', unit: 'mil', note: 'Fine trace width' },
    { label: '10 mil', text: '10', unit: 'mil', note: 'Signal trace width' },
    { label: '0.5 mm', text: '0.5', unit: 'mm', note: 'Fine-pitch QFN' },
    { label: '1.6 mm', text: '1.6', unit: 'mm', note: 'Standard board thickness' },
    { label: '100 mil', text: '100', unit: 'mil', note: '0.1 in header pitch' },
  ],
};
