import json
from typing import Any

from django.utils.translation import gettext_lazy as _
from rest_framework.renderers import JSONRenderer


class GenericJSONRenderer(JSONRenderer):
    charset = "utf-8"
    object_label = "object"

    def render(
        self,
        data: Any,
        accepted_media_type: str | None = None,
        renderer_context: dict | None = None,
    ) -> bytes | str:
        if renderer_context is None:
            renderer_context = {}

        view = renderer_context.get("view")
        object_label = view.object_label if hasattr(view, "object_label") else self.object_label

        response = renderer_context.get("response")

        if not response:
            raise ValueError(_("Response not found in renderer context"))

        status_code = response.status_code
        errors = data.get("errors", None)

        if errors is not None:
            return super().render(data)

        return json.dumps({"status_code": status_code, object_label: data}).encode(self.charset)
