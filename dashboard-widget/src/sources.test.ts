import {describe, expect, it} from "vitest";

import {
  batteryBand,
  buildConnection,
  buildDiagnostics,
  buildFlow,
  buildTank,
  chargerBand,
  fraction,
  radioBand,
  resolveAppKey,
  signalBand,
} from "./sources";

/** Trimmed from the demo device's real `deployment_config` aggregate. */
const APPLICATIONS = {
  "4_20ma_sensor_1": {
    APPLICATION_NAME: "4_20ma_sensor",
    APP_INSTALL_DISPLAY_NAME: "Tank Level 1",
    DEVICE_TYPE: "Elpro Quantum",
    measurement_units: "%",
    min_range: 0,
    max_range: 100,
    ai_pin_number: 0,
  },
  "4_20ma_sensor_2": {
    APPLICATION_NAME: "4_20ma_sensor",
    APP_INSTALL_DISPLAY_NAME: "Tank Level 2",
    DEVICE_TYPE: "Elpro Quantum",
    measurement_units: "%",
    min_range: 0,
    max_range: 100,
    ai_pin_number: 1,
  },
  analog_flow_meter_1: {
    APPLICATION_NAME: "analog_flow_meter",
    APP_INSTALL_DISPLAY_NAME: "Flow Meter 1",
    DEVICE_TYPE: "Elpro Quantum",
    flow_units: "L",
    flow_rate_time_base: "Per Hour",
    flow_decimal_precision: 1,
    kfactor_pulses_per_unit: 1,
    maximum_flow: 1000,
    meter_mode: "Pulse",
  },
  analog_flow_meter_2: {
    APPLICATION_NAME: "analog_flow_meter",
    APP_INSTALL_DISPLAY_NAME: "Flow Meter 2",
    DEVICE_TYPE: "Elpro Quantum",
    flow_units: "L",
    flow_rate_time_base: "Per Minute",
    flow_decimal_precision: 2,
    kfactor_pulses_per_unit: 10,
    maximum_flow: 500,
    meter_mode: "Pulse",
  },
  elpro_quantum_diagnostics_1: {
    APPLICATION_NAME: "elpro_quantum_diagnostics",
    APP_INSTALL_DISPLAY_NAME: "ELPRO Quantum Diagnostics",
    DEVICE_TYPE: "Elpro Quantum",
    weak_signal_threshold_dbm: -100,
  },
};

const TAGS = {
  "4_20ma_sensor_1": {value: 3.15, raw_value: 4.5},
  "4_20ma_sensor_2": {value: 5.74, raw_value: 4.91},
  analog_flow_meter_1: {flow_rate: 0, totaliser: 0, sensor_fault_hidden: true},
  // Trimmed from the demo unit's real ELPRO diagnostics tags.
  elpro_quantum_diagnostics_1: {
    active_source: "battery",
    battery_current_a: -0.528,
    battery_power_w: -6.31,
    battery_voltage_v: 11.957,
    charge_voltage_v: 13.8,
    charger_charging: false,
    charger_present: true,
    charger_status: "Not charging",
    pa_temperature_c: 33,
    radio_alarm: false,
    radio_driver_state: "AWAKE",
    radio_initialised: true,
    radio_present: true,
    radio_uptime_s: 940374,
    rssi_background_dbm: -117,
    rssi_dbm: -119,
    running_on_battery: true,
    tx_frequency_mhz: 472.1,
    tx_power_dbm: 20,
    unit_firmware: "2.15.0.0",
    unit_model: "QE-R-C4",
  },
  platform: {
    voltage: 11.955,
    power_watts: -6.582,
  },
};

describe("resolveAppKey", () => {
  it("prefers the configured key when the device knows it", () => {
    expect(resolveAppKey("4_20ma_sensor_2", APPLICATIONS, "4_20ma_sensor", 0)).toBe("4_20ma_sensor_2");
  });

  it("falls back to the nth install of the application type", () => {
    expect(resolveAppKey("renamed_away", APPLICATIONS, "analog_flow_meter", 1)).toBe("analog_flow_meter_2");
  });

  it("returns null when nothing of that type is installed", () => {
    expect(resolveAppKey(undefined, APPLICATIONS, "analog_rain_gauge", 0)).toBeNull();
  });
});

describe("buildTank", () => {
  it("takes units and range from the source app's own config", () => {
    const tank = buildTank("4_20ma_sensor_1", APPLICATIONS, TAGS, 0, "Tank 1");
    expect(tank).toMatchObject({
      appKey: "4_20ma_sensor_1",
      displayName: "Tank Level 1",
      value: 3.15,
      units: "%",
      min: 0,
      max: 100,
      rawMilliamps: 4.5,
    });
  });

  it("still names the panel when the sensor isn't installed", () => {
    const tank = buildTank("missing", {}, {}, 0, "Tank 1");
    expect(tank.appKey).toBeNull();
    expect(tank.displayName).toBe("Tank 1");
  });
});

describe("buildFlow", () => {
  it("mirrors the meter's configured rate time base", () => {
    expect(buildFlow("analog_flow_meter_1", APPLICATIONS, TAGS, 0, "Flow 1").rateUnits).toBe("L/hr");
    expect(buildFlow("analog_flow_meter_2", APPLICATIONS, TAGS, 1, "Flow 2").rateUnits).toBe("L/min");
  });

  it("carries the pulse k-factor and meter mode through", () => {
    const flow = buildFlow("analog_flow_meter_2", APPLICATIONS, TAGS, 1, "Flow 2");
    expect(flow.meterMode).toBe("Pulse");
    expect(flow.kFactor).toBe(10);
    expect(flow.maxFlow).toBe(500);
  });

  it("leaves tags undefined when the meter hasn't reported", () => {
    const flow = buildFlow("analog_flow_meter_2", APPLICATIONS, TAGS, 1, "Flow 2");
    expect(flow.flowRate).toBeUndefined();
    expect(flow.totaliser).toBeUndefined();
  });
});

describe("buildDiagnostics", () => {
  const diagnostics = buildDiagnostics(
    "elpro_quantum_diagnostics_1",
    "platform",
    APPLICATIONS,
    TAGS,
  );

  it("reads the device type off any app install", () => {
    expect(diagnostics.deviceType).toBe("Elpro Quantum");
  });

  it("prefers the ELPRO app's battery rail over the platform's plain voltage", () => {
    expect(diagnostics.detailed).toBe(true);
    expect(diagnostics.batteryVoltage).toBe(11.957);
    expect(diagnostics.batteryCurrent).toBe(-0.528);
    expect(diagnostics.runningOnBattery).toBe(true);
  });

  it("carries the charger setpoint and radio state through", () => {
    expect(diagnostics.chargeVoltage).toBe(13.8);
    expect(diagnostics.chargerStatus).toBe("Not charging");
    expect(diagnostics.radioState).toBe("AWAKE");
    expect(diagnostics.rssiDbm).toBe(-119);
  });

  it("takes the weak-signal threshold from the ELPRO app's own config", () => {
    expect(diagnostics.weakSignalDbm).toBe(-100);
  });

  it("falls back to the platform interface when the ELPRO app is absent", () => {
    const fallback = buildDiagnostics(undefined, "platform", {}, {platform: TAGS.platform});
    expect(fallback.detailed).toBe(false);
    expect(fallback.batteryVoltage).toBe(11.955);
    expect(fallback.reporting).toBe(true);
  });

  it("reports nothing published when neither app has reported", () => {
    expect(buildDiagnostics(undefined, "platform", APPLICATIONS, {}).reporting).toBe(false);
  });
});

describe("health bands", () => {
  const diagnostics = buildDiagnostics(
    "elpro_quantum_diagnostics_1",
    "platform",
    APPLICATIONS,
    TAGS,
  );

  it("bands the battery against the charger setpoint, not a fixed 12 V", () => {
    expect(batteryBand(11.957, 13.8)).toBe("fair");
    expect(batteryBand(11.2, 13.8)).toBe("poor");
    expect(batteryBand(13.1, 13.8)).toBe("good");
    // The same 11.957 V on a 24 V bank is nearly flat, not merely low.
    expect(batteryBand(11.957, 27.6)).toBe("poor");
    expect(batteryBand(25.5, 27.6)).toBe("good");
  });

  it("splits signal on the operator's own weak threshold", () => {
    expect(signalBand(-119, -100)).toBe("poor");
    expect(signalBand(-105, -100)).toBe("fair");
    expect(signalBand(-80, -100)).toBe("good");
    expect(signalBand(undefined, -100)).toBe("neutral");
  });

  it("flags a charger that isn't charging while the battery carries the unit", () => {
    expect(chargerBand(diagnostics)).toBe("fair");
    expect(chargerBand({...diagnostics, chargerCharging: true})).toBe("good");
    expect(chargerBand({...diagnostics, chargerPresent: false})).toBe("neutral");
  });

  it("calls the radio bad only when it is fitted and unhappy", () => {
    expect(radioBand(diagnostics)).toBe("good");
    expect(radioBand({...diagnostics, radioAlarm: true})).toBe("poor");
    expect(radioBand({...diagnostics, radioPresent: false})).toBe("neutral");
  });
});

describe("buildConnection", () => {
  it("flattens the doover_connection aggregate", () => {
    expect(
      buildConnection({
        determination: "Online",
        status: {status: "ContinuousOnline", latency_ms: 17},
      }),
    ).toMatchObject({determination: "Online", status: "ContinuousOnline", latencyMs: 17});
  });

  it("copes with an aggregate that hasn't arrived", () => {
    expect(buildConnection(undefined).determination).toBeNull();
  });
});

describe("scales", () => {
  it("clamps fractions and survives a zero-width range", () => {
    expect(fraction(150, 0, 100)).toBe(1);
    expect(fraction(-5, 0, 100)).toBe(0);
    expect(fraction(5, 10, 10)).toBe(0);
  });

});
