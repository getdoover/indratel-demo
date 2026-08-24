import {describe, expect, it} from "vitest";

import {
  buildConnection,
  buildDiagnostics,
  buildFlow,
  buildTank,
  fraction,
  resolveAppKey,
  supplyHealth,
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
};

const TAGS = {
  "4_20ma_sensor_1": {value: 3.15, raw_value: 4.5},
  "4_20ma_sensor_2": {value: 5.74, raw_value: 4.91},
  analog_flow_meter_1: {flow_rate: 0, totaliser: 0, sensor_fault_hidden: true},
  platform: {
    AI0: 4.5,
    AI2: 0.0000529,
    AO0: 4.5,
    DI0: false,
    DI2: true,
    DI10: true,
    DO0: false,
    voltage: 11.957,
    power_watts: -6.309,
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
  const diagnostics = buildDiagnostics("platform", APPLICATIONS, TAGS);

  it("reads the device type off any app install", () => {
    expect(diagnostics.deviceType).toBe("Elpro Quantum");
  });

  it("reads the supply rail and power draw", () => {
    expect(diagnostics.voltage).toBe(11.957);
    expect(diagnostics.powerWatts).toBe(-6.309);
  });

  it("reports nothing published when the namespace is empty", () => {
    expect(buildDiagnostics("platform", APPLICATIONS, {}).reporting).toBe(false);
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

  it("bands the Elpro supply rail", () => {
    expect(supplyHealth(9)).toBe("low");
    expect(supplyHealth(11.96)).toBe("ok");
    expect(supplyHealth(24)).toBe("ok");
    expect(supplyHealth(31)).toBe("high");
  });
});
