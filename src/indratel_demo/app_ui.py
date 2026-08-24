from pathlib import Path

from pydoover import ui


class IndratelDemoUI(ui.UI, default_open=True):
    """Registers the remote component.

    Extra kwargs on `RemoteComponent` are passed through verbatim into the
    ui_state node, which is how the resolved config values reach the widget as
    fields on `uiElement`.
    """

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
        flow_1_app="$config.app().flow_1_app",
        flow_2_app="$config.app().flow_2_app",
        platform_app="$config.app().platform_app",
        show_diagnostics="$config.app().show_diagnostics:boolean:true",
    )


def export():
    IndratelDemoUI(None, None, None).export(
        Path(__file__).parents[2] / "doover_config.json", "indratel_demo"
    )
