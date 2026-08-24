"""Smoke tests: the lambda entrypoint and both schema exports must work.

These are what break first when a pydoover API shifts under us, and they are
what `doover app publish` runs before uploading anything.
"""

import json
from pathlib import Path

CONFIG_PATH = Path(__file__).parents[1] / "doover_config.json"


def test_handler_importable():
    from indratel_demo import handler

    assert callable(handler)


def test_application_wiring():
    from indratel_demo.application import IndratelDemoApp
    from indratel_demo.app_config import IndratelDemoConfig
    from indratel_demo.app_ui import IndratelDemoUI

    assert IndratelDemoApp.config_cls is IndratelDemoConfig
    assert IndratelDemoApp.ui_cls is IndratelDemoUI


def test_config_keys_match_ui_references():
    """`app_ui.py` resolves `$config.app().<key>` at runtime, and the key is
    derived from the config element's *display name*. A mismatch fails silently
    in production, so assert the two line up here."""
    config = json.loads(CONFIG_PATH.read_text())["indratel_demo"]
    properties = set(config["config_schema"]["properties"])
    widget = config["ui_schema"]["children"]["IndratelDemoWidget"]

    # References look like `$config.app().<key>` with an optional
    # `:<type>:<default>` suffix.
    referenced = {
        value.removeprefix("$config.app().").split(":")[0]
        for value in widget.values()
        if isinstance(value, str) and value.startswith("$config.app().")
    }
    # APP_KEY and dv_widget_url are injected by the platform, not by our schema.
    referenced -= {"APP_KEY", "dv_widget_url"}

    assert referenced <= properties, f"unresolvable config refs: {referenced - properties}"


def test_widget_is_declared():
    config = json.loads(CONFIG_PATH.read_text())["indratel_demo"]
    assert config["widget"] == "dashboard-widget/assets/IndratelDemoWidget.js"
    assert config["ui_schema"]["children"]["IndratelDemoWidget"]["scope"] == "IndratelDemoWidget"
