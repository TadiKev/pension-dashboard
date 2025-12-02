# backend-django/api/views.py
import os
import uuid
import logging
import httpx
from httpx import ConnectError, RequestError

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt

from rest_framework import viewsets, status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    authentication_classes,
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Company, Member, PensionAccount, Transaction, AssumptionSet
from .serializers import (
    CompanySerializer,
    MemberSerializer,
    PensionAccountSerializer,
    TransactionSerializer,
    AssumptionSetSerializer,
)

logger = logging.getLogger("pensionlib_api")


# ---- ViewSets ----
class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer


class MemberViewSet(viewsets.ModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer


class PensionAccountViewSet(viewsets.ModelViewSet):
    queryset = PensionAccount.objects.all()
    serializer_class = PensionAccountSerializer


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer


class AssumptionSetViewSet(viewsets.ModelViewSet):
    queryset = AssumptionSet.objects.all()
    serializer_class = AssumptionSetSerializer


# ---- Helpers ----
def _ok_options_if_options(request):
    """
    Respond 200 to preflight OPTIONS so browser can preflight without auth.
    """
    if request.method == "OPTIONS":
        return Response(status=status.HTTP_200_OK)
    return None


# ---- Small helper endpoints ----
@api_view(["GET", "OPTIONS"])
@permission_classes([IsAuthenticated])
def me(request):
    opt = _ok_options_if_options(request)
    if opt is not None:
        return opt

    user = request.user
    return Response(
        {
            "username": user.username,
            "email": user.email,
            "is_company_user": getattr(user, "is_company_user", False),
            "is_talent_verify": getattr(user, "is_talent_verify", False),
            "is_staff": user.is_staff,
        }
    )


# ---- Upload CSV and forward to FastAPI batch endpoint ----
@api_view(["POST", "OPTIONS"])
@permission_classes([AllowAny])  # token validated manually below for clearer errors
def upload_csv_and_process(request):
    # Allow preflight
    if request.method == "OPTIONS":
        return Response(status=status.HTTP_200_OK)

    # Check Authorization header exists (we want to forward it)
    auth_header = request.META.get("HTTP_AUTHORIZATION")
    if not auth_header:
        return Response(
            {"detail": "Authorization header is required (Bearer <token>)"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Validate JWT (so we can give a helpful error)
    jwt_auth = JWTAuthentication()
    try:
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise ValueError("Malformed Authorization header")
        raw_token = parts[1]
        validated = jwt_auth.get_validated_token(raw_token)
        user = jwt_auth.get_user(validated)
        request.user = user
    except Exception as e:
        logger.warning("Upload: token validation failed: %s", e)
        return Response(
            {"detail": "Given token not valid", "error": str(e)},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Get the uploaded file
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return Response(
            {"detail": "No file provided (field name must be 'file')"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Save to media/uploads (so FastAPI can read it if needed or for audit)
    base_dir = getattr(settings, "BASE_DIR", os.getcwd())
    uploads_dir = os.path.join(base_dir, "media", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}_{uploaded_file.name}"
    dest_path = os.path.join(uploads_dir, unique_name)

    try:
        with open(dest_path, "wb") as fh:
            for chunk in uploaded_file.chunks():
                fh.write(chunk)
    except Exception as ex:
        logger.exception("Failed to save uploaded file")
        return Response(
            {"detail": f"Failed to save file: {ex}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Determine FastAPI batch URL
    fastapi_batch = os.environ.get("FASTAPI_BATCH_URL")
    if not fastapi_batch:
        base = os.environ.get("FASTAPI_BASE_URL") or os.environ.get("FASTAPI_URL")
        if base:
            fastapi_batch = base.rstrip("/") + "/batch/dc_project"

    if not fastapi_batch or not fastapi_batch.startswith("http"):
        logger.error("FASTAPI_BATCH_URL / FASTAPI_BASE_URL not configured correctly")
        return Response(
            {"detail": "FASTAPI_BATCH_URL or FASTAPI_BASE_URL not configured"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    # Forward the saved file to FastAPI
    headers = {"Authorization": auth_header}
    try:
        with httpx.Client(timeout=120.0) as client:
            with open(dest_path, "rb") as fobj:
                files = {"file": (uploaded_file.name, fobj, "text/csv")}
                resp = client.post(fastapi_batch, files=files, headers=headers)
            if resp.status_code >= 400:
                logger.error(
                    "FastAPI batch returned %s: %s", resp.status_code, resp.text
                )
                return Response(
                    {
                        "detail": f"FastAPI returned error: {resp.status_code}",
                        "body": resp.text,
                    },
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            try:
                return Response({"status": "ok", "fastapi_result": resp.json()})
            except Exception:
                return Response({"status": "ok", "fastapi_result": {"text": resp.text}})
    except httpx.RequestError as re:
        logger.exception("Forwarding to FastAPI failed (request error)")
        return Response(
            {"detail": f"Forwarding failed: {str(re)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    except Exception as exc:
        logger.exception("Forwarding to FastAPI failed (unexpected)")
        return Response(
            {"detail": f"Forwarding failed: {exc}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ---- Single, clear proxy endpoint for DC project ----
@api_view(["POST", "OPTIONS"])
@authentication_classes([])  # don't let DRF try to validate JWT here
@permission_classes([AllowAny])  # public for dev; secure in prod
@csrf_exempt
def proxy_project_dc(request):
    """
    Proxy POST -> FastAPI endpoint. Uses env FASTAPI_BASE_URL (e.g. http://localhost:8001/v1)
    Frontend posts to /api/v1/proxy/dc/project/ and this forwards to {FASTAPI_BASE_URL}/dc/project
    """
    # allow preflight
    opt = _ok_options_if_options(request)
    if opt is not None:
        return opt

    fastapi_base = os.environ.get(
        "FASTAPI_BASE_URL", "http://localhost:8001/v1"
    ).rstrip("/")
    fastapi_url = fastapi_base + "/dc/project"
    if not fastapi_url.startswith("http"):
        logger.error(
            "proxy_project_dc: FASTAPI_BASE_URL misconfigured: %s", fastapi_base
        )
        return Response(
            {"detail": "FASTAPI_BASE_URL not configured correctly on server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    auth_header = request.META.get("HTTP_AUTHORIZATION")
    content_type = request.META.get("CONTENT_TYPE", "application/json")

    headers = {}
    if auth_header:
        headers["Authorization"] = auth_header
    if content_type:
        headers["Content-Type"] = content_type

    try:
        with httpx.Client(timeout=30.0) as client:
            if content_type and "application/json" in content_type:
                # use request.data (DRF parsed) to avoid double-JSON issues
                resp = client.post(fastapi_url, json=request.data, headers=headers)
            else:
                resp = client.post(fastapi_url, content=request.body, headers=headers)

            return HttpResponse(
                resp.content,
                status=resp.status_code,
                content_type=resp.headers.get("content-type", "application/json"),
            )
    except ConnectError as ce:
        logger.exception("proxy_project_dc: fastapi connection failed")
        return Response(
            {"detail": f"FastAPI unreachable at {fastapi_url}: {str(ce)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except RequestError as re:
        logger.exception("proxy_project_dc: httpx request error")
        return Response(
            {"detail": f"Proxy request failed: {str(re)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except Exception as exc:
        logger.exception("proxy_project_dc: unexpected error")
        return Response(
            {"detail": f"Proxy unexpected error: {exc}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
