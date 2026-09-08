"""Mirror the widget's placement onto its own widget channel.

The control plane places a widget in two channels on deploy: the bundle goes
to ``<install>_widget`` (as an attachment, with only ``deployment_id`` in the
data) and the resolved ``uiRemoteComponent`` node goes to ``ui_state``. The
cloud site reads the node from ``ui_state`` and everything works.

A device-local HMI (the ``hmi_engine`` kiosk) renders the widget through the
device agent's local viewer instead, and that viewer only sees the device's
*local* ``ui_state`` — the part device apps wrote through the agent. This app
is a cloud processor, so its node is never there. The viewer then falls back to
the widget channel's data, and, finding no ``scope``/``module`` in it, sniffs
the bundle for ``uniqueName`` — which this widget's toolchain
(@module-federation/rsbuild-plugin 0.21) hashes to ``IndratelDemoWidget_1b4c1ad8``
— and looks up a container that doesn't exist.

Fix, widget side: mirror the resolved node into the widget channel's data.
The viewer's fallback then has the real container name, module and every
widget prop, online or offline. The control plane's deploy write to this
channel is a merge (it only clears attachments), so the keys survive a redeploy;
the app rewrites them whenever they change.
"""

from __future__ import annotations

from typing import Any

REMOTE_COMPONENT = "uiRemoteComponent"

# Element bookkeeping the viewer must not read off the aggregate. ``children``
# would be rendered as sub-elements; a truthy ``hidden``/``hide`` blanks the
# page with no error; the rest are layout defaults the viewer already applies.
STRUCTURAL_KEYS = frozenset(
    {
        "children",
        "type",
        "hidden",
        "hide",
        "position",
        "showActivity",
        "isAvailable",
        "helpString",
        "verboseString",
        "form",
        "graphic",
        "layout",
        "conditions",
        "units",
        "icon",
        "colour",
    }
)


def remote_component_nodes(schema: dict[str, Any]) -> list[dict[str, Any]]:
    """Every ``uiRemoteComponent`` node in a UI schema, depth first."""
    found: list[dict[str, Any]] = []

    def visit(node: Any) -> None:
        if not isinstance(node, dict):
            return
        if node.get("type") == REMOTE_COMPONENT:
            found.append(node)
        children = node.get("children")
        if isinstance(children, dict):
            for child in children.values():
                visit(child)

    visit(schema)
    return found


def widget_channel_name(deployment_config: dict[str, Any], app_key: str) -> str:
    """The channel the control plane published this install's bundle to."""
    name = deployment_config.get("dv_widget_url")
    if isinstance(name, str) and name:
        return name
    return f"{app_key}_widget"


def widget_channel_payload(node: dict[str, Any]) -> dict[str, Any]:
    """The data to merge into the widget channel for one *resolved* node.

    ``node`` comes from ``UI.to_schema()``, which has already resolved every
    ``$config.app()`` reference through the app's config schema (declared
    defaults included). Structural keys are dropped. A prop that resolved to
    nothing is kept as ``None`` on purpose: a null in an aggregate patch clears
    the field, which is how a prop removed from the config leaves the channel
    instead of lingering from an earlier deploy.
    """
    return {key: value for key, value in node.items() if key not in STRUCTURAL_KEYS}


def needs_publish(current: dict[str, Any] | None, payload: dict[str, Any]) -> bool:
    """Whether ``payload`` would change what the channel already holds.

    Every write lands on the device as an aggregate event, and the HMI engine
    reloads its panel on each one — so a deploy of some *other* app on the
    device (which also updates ``deployment_config``) must not cost a reload.
    A missing key and a null are the same thing to the aggregate.
    """
    if current is None:
        return True
    return any(current.get(key) != value for key, value in payload.items())
