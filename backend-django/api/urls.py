# backend-django/api/urls.py
from django.urls import path, include
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from api.views import proxy_dc_project

from .views import (
    CompanyViewSet,
    MemberViewSet,
    PensionAccountViewSet,
    TransactionViewSet,
    AssumptionSetViewSet,
    me,
    upload_csv_and_process,
    proxy_project_dc,
)

router = routers.DefaultRouter()
router.register(r'companies', CompanyViewSet)
router.register(r'members', MemberViewSet)
router.register(r'accounts', PensionAccountViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'assumptions', AssumptionSetViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # JWT endpoints
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # convenience endpoint to return profile/role info
    path('auth/me/', me, name='me'),
    # file uploads -> Django saves and forwards to FastAPI batch endpoint
    path('uploads/', upload_csv_and_process, name='upload_csv'),
    # server-side proxy to FastAPI
    path('proxy/dc/project/', proxy_project_dc, name='proxy_project_dc'),
    path("api/v1/proxy/dc/project/", proxy_dc_project),
]
