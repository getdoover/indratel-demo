from pathlib import Path

from pydoover import config
from pydoover.processor import SubscriptionConfig


class IndratelDemoConfig(config.Schema):
    """Configuration for the Indratel demo dashboard.

    Every panel is driven by another app installed on the same device, so all
    we need here is which app key to read each one from. Units, ranges and
    display names come from that app's own entry in `deployment_config`.

    Note: a config element's key is derived from its *display name*, not the
    attribute name. Keep the two identical or `$config.app().<key>` lookups in
    `app_ui.py` resolve to nothing.
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
        description="App install key of the 4-20mA sensor measuring tank 1.",
    )
    tank_2_app = config.String(
        "Tank 2 App",
        default="4_20ma_sensor_2",
        description="App install key of the 4-20mA sensor measuring tank 2.",
    )
    flow_1_app = config.String(
        "Flow 1 App",
        default="analog_flow_meter_1",
        description="App install key of the first pulse flow meter.",
    )
    flow_2_app = config.String(
        "Flow 2 App",
        default="analog_flow_meter_2",
        description="App install key of the second pulse flow meter.",
    )

    elpro_app = config.String(
        "Elpro App",
        default="elpro_quantum_diagnostics_1",
        description=(
            "App install key of the ELPRO Quantum diagnostics app, which supplies "
            "the battery, charger and radio readings. Without it the panel falls "
            "back to the bare voltage the platform interface publishes."
        ),
    )
    platform_app = config.String(
        "Platform App",
        default="platform",
        description=(
            "Tag namespace the platform interface publishes under. Used only as "
            "a fallback when the ELPRO diagnostics app is not installed. This is "
            "the app's tag key ('platform'), not its install key."
        ),
    )
    show_diagnostics = config.Boolean(
        "Show Diagnostics",
        default=True,
        description="Show the hardware diagnostics panel.",
    )


def export():
    IndratelDemoConfig.export(
        Path(__file__).parents[2] / "doover_config.json",
        "indratel_demo",
    )
