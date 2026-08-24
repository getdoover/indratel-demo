"""Smoke tests for the template application.

These validate that modules are importable, the config schema is well-formed,
the Tags/UI classes subclass the correct bases, and the config export entry
point runs end-to-end.
"""

import json

from pydoover.config import Schema
from pydoover.tags import Tags
from pydoover.ui import UI


def test_import_app():
    from indratel_demo.application import IndratelDemoApplication
    assert IndratelDemoApplication.config_cls is not None
    assert IndratelDemoApplication.tags_cls is not None
    assert IndratelDemoApplication.ui_cls is not None


def test_config_schema():
    from indratel_demo.app_config import IndratelDemoConfig
    assert issubclass(IndratelDemoConfig, Schema)

    schema = IndratelDemoConfig.to_schema()
    assert isinstance(schema, dict)
    assert schema["type"] == "object"
    assert len(schema["properties"]) > 0
    assert "a_funny_message" in schema["required"]
    assert "simulator_app_key" in schema["required"]


def test_tags():
    from indratel_demo.app_tags import SampleTags
    assert issubclass(SampleTags, Tags)


def test_ui():
    from indratel_demo.app_ui import IndratelDemoUI
    assert issubclass(IndratelDemoUI, UI)


def test_state_machine():
    from indratel_demo.app_state import IndratelDemoState
    state = IndratelDemoState()
    assert state.state == "off"


def test_config_export(tmp_path):
    from indratel_demo.app_config import IndratelDemoConfig

    fp = tmp_path / "doover_config.json"
    IndratelDemoConfig.export(fp, "indratel_demo")

    data = json.loads(fp.read_text())
    assert "indratel_demo" in data
    assert "config_schema" in data["indratel_demo"]
    assert "properties" in data["indratel_demo"]["config_schema"]


def test_ui_export(tmp_path):
    from indratel_demo.app_ui import IndratelDemoUI

    fp = tmp_path / "doover_config.json"
    IndratelDemoUI(None, None, None).export(fp, "indratel_demo")

    data = json.loads(fp.read_text())
    assert "ui_schema" in data["indratel_demo"]
    assert data["indratel_demo"]["ui_schema"]["type"] == "uiApplication"
    assert "is_working" in data["indratel_demo"]["ui_schema"]["children"]
