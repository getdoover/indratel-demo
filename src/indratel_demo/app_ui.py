from pathlib import Path

from pydoover import ui


class IndratelDemoUI(ui.UI, default_open=True):
    widget = ui.RemoteComponent(
        name="IndratelDemoWidget",
        display_name="Site Overview",
        component_url="$config.app().dv_widget_url",
        scope="IndratelDemoWidget",
        module="./IndratelDemoWidget",
        app_key="$config.app().APP_KEY",
        site_name="$config.app().site_name",
        tank_1_app="$config.app().tank_1_app",
        tank_2_app="$config.app().tank_2_app",
        flow_meter_app="$config.app().flow_meter_app",
        rain_gauge_app="$config.app().rain_gauge_app",
    )


def export():
    IndratelDemoUI(None, None, None).export(
        Path(__file__).parents[2] / "doover_config.json", "indratel_demo"
    )
