"""The widget channel carries the resolved remote-component node.

A device-local HMI resolves the widget from the widget channel's data when the
cloud app's ui_state node isn't on the device. These pin what gets written
there and when.
"""

import pytest

from indratel_demo.app_config import IndratelDemoConfig
from indratel_demo.app_ui import IndratelDemoUI
from indratel_demo.widget_channel import (
    needs_publish,
    remote_component_nodes,
    widget_channel_name,
    widget_channel_payload,
)

DEPLOYMENT_CONFIG = {
    "APP_KEY": "indratel_demo_1",
    "APP_DISPLAY_NAME": "Site Overview",
    "dv_widget_url": "indratel_demo_1_widget",
    "dv_app_position": 50,
    "site_name": "Indratel Demo Site",
    "tank_1_app": "4_20ma_sensor_1",
    "tank_2_app": "4_20ma_sensor_2",
    "flow_1_app": "analog_flow_meter_1",
    "flow_2_app": "analog_flow_meter_2",
    "elpro_app": "elpro_quantum_diagnostics_1",
    "platform_app": "platform",
    "show_diagnostics": True,
}


def make_ui(deployment_config=DEPLOYMENT_CONFIG, app_key="indratel_demo_1"):
    """The UI exactly as the processor builds it: config injected, then schema."""
    config = IndratelDemoConfig()
    config._inject_deployment_config(deployment_config)
    return IndratelDemoUI(config, None, app_key)


def resolved_node(deployment_config=DEPLOYMENT_CONFIG):
    nodes = remote_component_nodes(make_ui(deployment_config).to_schema())
    assert len(nodes) == 1
    return nodes[0]


def test_schema_declares_one_remote_component():
    node = resolved_node()
    assert node["name"] == "IndratelDemoWidget"
    assert node["scope"] == "IndratelDemoWidget"
    assert node["module"] == "./IndratelDemoWidget"


def test_payload_is_the_resolved_node():
    payload = widget_channel_payload(resolved_node())

    # The two fields the local viewer needs to find the federation container.
    assert payload["scope"] == "IndratelDemoWidget"
    assert payload["module"] == "./IndratelDemoWidget"
    # Placement fields the viewer's fallback reads straight off the aggregate.
    assert payload["name"] == "IndratelDemoWidget"
    assert payload["displayString"] == "Site Overview"
    assert payload["componentUrl"] == "indratel_demo_1_widget"
    assert payload["app_key"] == "indratel_demo_1"
    # Widget props resolved through the app's own config schema.
    assert payload["site_name"] == "Indratel Demo Site"
    assert payload["tank_1_app"] == "4_20ma_sensor_1"
    assert payload["elpro_app"] == "elpro_quantum_diagnostics_1"
    assert payload["show_diagnostics"] is True
    # Nothing unresolved leaks through (the viewer would reinterpret a
    # ``$...`` string as a channel lookup).
    assert not any(isinstance(v, str) and "$config" in v for v in payload.values())
    # Structural keys stay off the channel: children would render as
    # sub-elements and a stray truthy ``hidden`` blanks the panel silently.
    for key in ("children", "type", "hidden", "hide", "position", "showActivity"):
        assert key not in payload
    assert None not in payload.values()


def test_declared_defaults_fill_props_missing_from_the_deployment():
    minimal = {"APP_KEY": "indratel_demo_1", "dv_widget_url": "indratel_demo_1_widget"}
    payload = widget_channel_payload(resolved_node(minimal))
    # Every prop has a declared default in app_config.py, and the schema
    # resolver honours it — a fresh install renders with the standard app keys.
    assert payload["site_name"] == "Indratel Demo Site"
    assert payload["tank_1_app"] == "4_20ma_sensor_1"
    assert payload["show_diagnostics"] is True
    assert payload["scope"] == "IndratelDemoWidget"


def test_a_prop_resolving_to_nothing_is_published_as_null_to_clear_it():
    node = {"type": "uiRemoteComponent", "scope": "X", "module": "./X", "gone": None}
    payload = widget_channel_payload(node)
    # A null in an aggregate patch clears the field, so a prop dropped from the
    # config does not linger on the channel from an earlier deploy.
    assert "gone" in payload and payload["gone"] is None


def test_needs_publish_only_when_something_changes():
    payload = {"scope": "IndratelDemoWidget", "site_name": "X", "gone": None}
    assert needs_publish(None, payload)
    assert needs_publish({}, payload)
    assert needs_publish({"scope": "IndratelDemoWidget", "site_name": "old"}, payload)
    # Same values, extra platform keys, and a null for an absent key: no change.
    assert not needs_publish(
        {"deployment_id": "1", "scope": "IndratelDemoWidget", "site_name": "X"},
        payload,
    )


def test_widget_channel_name_prefers_platform_stamp():
    assert (
        widget_channel_name({"dv_widget_url": "renamed"}, "indratel_demo_1")
        == "renamed"
    )
    assert widget_channel_name({}, "indratel_demo_1") == "indratel_demo_1_widget"


class FakeAggregate:
    def __init__(self, data):
        self.data = data


class FakeApi:
    def __init__(self, current=None, fail_read=False):
        self.calls = []
        self.current = current
        self.fail_read = fail_read

    async def fetch_channel_aggregate(self, channel_name, **kwargs):
        if self.fail_read:
            raise RuntimeError("boom")
        return FakeAggregate(self.current or {})

    async def update_channel_aggregate(self, channel_name, data, **kwargs):
        self.calls.append((channel_name, data, kwargs))
        self.current = {**(self.current or {}), **data}


def make_app(api):
    from indratel_demo.application import IndratelDemoApp

    app = IndratelDemoApp()
    app.app_key = "indratel_demo_1"
    app.received_deployment_config = DEPLOYMENT_CONFIG
    app.ui = make_ui()
    app.api = api
    return app


@pytest.mark.asyncio
async def test_publish_widget_placement_merges_into_widget_channel():
    app = make_app(FakeApi(current={"deployment_id": "1"}))

    await app.publish_widget_placement()

    assert len(app.api.calls) == 1
    channel, data, kwargs = app.api.calls[0]
    assert channel == "indratel_demo_1_widget"
    assert data["scope"] == "IndratelDemoWidget"
    assert data["module"] == "./IndratelDemoWidget"
    assert data["site_name"] == "Indratel Demo Site"
    # A plain merge, never a replace: the bundle attachment and the control
    # plane's deployment_id must survive.
    assert kwargs == {}


@pytest.mark.asyncio
async def test_deployment_and_config_change_both_publish_once():
    app = make_app(FakeApi())

    await app.on_deployment(None)
    # The second invocation finds the channel already current and writes nothing,
    # so a deploy of another app on the device does not reload the HMI panel.
    await app.on_aggregate_update(None)
    assert [c[0] for c in app.api.calls] == ["indratel_demo_1_widget"]


@pytest.mark.asyncio
async def test_publishes_when_the_channel_cannot_be_read():
    app = make_app(FakeApi(fail_read=True))
    await app.publish_widget_placement()
    assert len(app.api.calls) == 1


@pytest.mark.asyncio
async def test_a_failed_mirror_does_not_fail_the_invocation():
    class BrokenApi(FakeApi):
        async def update_channel_aggregate(self, channel_name, data, **kwargs):
            raise RuntimeError("data api down")

    app = make_app(BrokenApi())
    await app.on_deployment(None)  # must not raise
