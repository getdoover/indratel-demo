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
