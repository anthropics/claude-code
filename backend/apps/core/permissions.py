"""
Core Permissions - Workspace-scoped access control
"""
from rest_framework import permissions


class IsWorkspaceMember(permissions.BasePermission):
    """
    Check if user is a member of the object's workspace.
    Works with models that have a 'workspace' field or a 'brand.workspace' path.
    """

    def has_object_permission(self, request, view, obj):
        # Get workspace from object
        workspace = getattr(obj, "workspace", None)

        # Try nested path through brand
        if workspace is None and hasattr(obj, "brand"):
            workspace = getattr(obj.brand, "workspace", None)

        # Try nested path through content_plan
        if workspace is None and hasattr(obj, "content_plan"):
            workspace = getattr(obj.content_plan.brand, "workspace", None)

        # Try nested path through plan_item
        if workspace is None and hasattr(obj, "plan_item"):
            workspace = getattr(obj.plan_item.content_plan.brand, "workspace", None)

        # For Workspace objects themselves
        if workspace is None and hasattr(obj, "memberships"):
            workspace = obj

        if workspace is None:
            return False

        return workspace.memberships.filter(user=request.user).exists()


class IsWorkspaceOwnerOrAdmin(permissions.BasePermission):
    """
    Check if user is owner or admin of the object's workspace.
    """

    def has_object_permission(self, request, view, obj):
        workspace = getattr(obj, "workspace", None)

        if workspace is None and hasattr(obj, "brand"):
            workspace = getattr(obj.brand, "workspace", None)

        if workspace is None and hasattr(obj, "memberships"):
            workspace = obj

        if workspace is None:
            return False

        return workspace.memberships.filter(
            user=request.user,
            role__in=["owner", "admin"]
        ).exists()


class IsOwner(permissions.BasePermission):
    """
    Check if user is the owner of the object.
    """

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, "owner"):
            return obj.owner == request.user
        if hasattr(obj, "user"):
            return obj.user == request.user
        return False
