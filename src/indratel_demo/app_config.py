from pathlib import Path

from pydoover import config
from pydoover.processor import SubscriptionConfig


class IndratelDemoConfig(config.Schema):
    """Configuration for the Indratel demo dashboard.

    Every panel of the widget is driven by another app installed on the same
    device. We only need to know which app key to read each one from - all the
    units, ranges and display names come from that app's own deployment config.
    """

    subscription = SubscriptionConfig(default="deployment_config")

    site_name = config.String(
        "Site Name",
        default="Indratel Demo Site",
        description="Heading shown at the top of the dashboard.",
    )

    tank_1_app = config.String(
        "Tank 1 App",
        default="4_20ma_sensor_1",
        description="App install key of the 4-20mA sensor measuring tank 1 (as it appears on the device).",
    )
    tank_2_app = config.String(
        "Tank 2 App",
        default="4_20ma_sensor_2",
        description="App install key of the 4-20mA sensor measuring tank 2 (as it appears on the device).",
    )
    flow_meter_app = config.String(
        "Flow Meter App",
        default="analog_flow_meter_1",
        description="App install key of the analog flow meter.",
    )
    rain_gauge_app = config.String(
        "Rain Gauge App",
        default="analog_rain_gauge_1",
        description="App install key of the analog rain gauge. Leave as-is if not installed yet - the panel stays dormant until it reports.",
    )


def export():
    IndratelDemoConfig.export(
        Path(__file__).parents[2] / "doover_config.json",
        "indratel_demo",
    )
