# backend/accounts/urls.py
from django.urls import path
from .views import RegisterView, DepartmentListView, UserDetailView, AccountApprovalListView, ApproveAccountView, RejectAccountView, ActiveAccountListView, DeleteAccountView, ToggleSuperTeacherView, DeactivatedAccountListView, ReactivateAccountView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('departments/', DepartmentListView.as_view(), name='department_list'),
    path('me/', UserDetailView.as_view(), name='user_detail'),
    path('approvals/', AccountApprovalListView.as_view(), name='account_approvals'),
    path('approvals/<int:pk>/approve/', ApproveAccountView.as_view(), name='approve_account'),
    path('approvals/<int:pk>/reject/', RejectAccountView.as_view(), name='reject_account'),
    path('active/', ActiveAccountListView.as_view(), name='active_accounts'),
    path('deactivated/', DeactivatedAccountListView.as_view(), name='deactivated_accounts'),
    path('<int:pk>/delete/', DeleteAccountView.as_view(), name='delete_account'),
    path('<int:pk>/reactivate/', ReactivateAccountView.as_view(), name='reactivate_account'),
    path('<int:pk>/toggle-super-teacher/', ToggleSuperTeacherView.as_view(), name='toggle_super_teacher'),
]