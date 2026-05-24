# backend/core/urls.py
from django.contrib import admin
from django.urls import path, include  # Make sure 'include' is imported
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from accounts.views import CustomTokenObtainPairView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')), # Changed from 'accounts/' to 'auth/'
    path('api/dashboard/', include('dashboard.urls')), # New dashboard URLs
    
    # API endpoints for JWT token management (Login)
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

# This is needed to serve media files (like profile photos) during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)