# backend/accounts/views.py

from rest_framework import generics, permissions
from .models import Department
from .serializers import UserRegistrationSerializer, DepartmentSerializer, UserDetailSerializer, CustomTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# View for user registration (Signup)
class RegisterView(generics.CreateAPIView):
    """
    API endpoint that allows users to be created.
    """
    permission_classes = [permissions.AllowAny] # Anyone can access this view
    serializer_class = UserRegistrationSerializer

# View to get a list of all Departments (and their subjects)
class DepartmentListView(generics.ListAPIView):
    """
    API endpoint to retrieve a list of all departments along with their subjects.
    Useful for populating dropdowns on the signup form.
    """
    permission_classes = [permissions.AllowAny]
    queryset = Department.objects.prefetch_related('subjects').all()
    serializer_class = DepartmentSerializer

class UserDetailView(generics.RetrieveAPIView):
    """
    API endpoint to retrieve the currently logged-in user's details.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserDetailSerializer

    def get_object(self):
        return self.request.user


# ===================================================================
# ACCOUNT APPROVAL VIEWS (Admin Only)
# ===================================================================

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import CustomUser

class IsAdminUserRole(permissions.BasePermission):
    """
    Allows access only to users with the 'ADMIN' role.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')

class AccountApprovalListView(generics.ListAPIView):
    """
    API endpoint that returns a list of unapproved users.
    If the requesting admin has a Teacher profile (e.g., an HOD), 
    it only returns users belonging to their department.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = UserDetailSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = CustomUser.objects.filter(is_approved=False)
        
        # Check if the admin is tied to a specific department
        try:
            admin_dept = user.teacher.dept
            if admin_dept:
                # Filter unapproved users whose teacher profile matches the admin's department
                queryset = queryset.filter(teacher__dept=admin_dept)
        except Exception:
            # If the admin doesn't have a Teacher profile, they are a global admin.
            pass
            
        return queryset

class ApproveAccountView(APIView):
    """
    API endpoint to approve a user account.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        user_to_approve = get_object_or_404(CustomUser, pk=pk, is_approved=False)
        
        # Verify department match if admin is department-scoped
        try:
            admin_dept = request.user.teacher.dept
            if admin_dept and hasattr(user_to_approve, 'teacher') and user_to_approve.teacher.dept != admin_dept:
                return Response({'error': 'You can only approve accounts in your department.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        user_to_approve.is_approved = True
        user_to_approve.save()
        return Response({'message': 'Account approved successfully.'}, status=status.HTTP_200_OK)

class RejectAccountView(APIView):
    """
    API endpoint to reject (hard delete) a user account.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        user_to_reject = get_object_or_404(CustomUser, pk=pk, is_approved=False)
        
        # Verify department match if admin is department-scoped
        try:
            admin_dept = request.user.teacher.dept
            if admin_dept and hasattr(user_to_reject, 'teacher') and user_to_reject.teacher.dept != admin_dept:
                return Response({'error': 'You can only reject accounts in your department.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        # Hard delete the user
        user_to_reject.delete()
        return Response({'message': 'Account rejected and deleted successfully.'}, status=status.HTTP_200_OK)

class ActiveAccountListView(generics.ListAPIView):
    """
    API endpoint that returns a list of approved users (TEACHER, SUPER_TEACHER).
    If the requesting admin has a Teacher profile, it only returns users in their department.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = UserDetailSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = CustomUser.objects.filter(is_approved=True, is_active=True, role__in=['TEACHER', 'SUPER_TEACHER'])
        
        try:
            admin_dept = user.teacher.dept
            if admin_dept:
                queryset = queryset.filter(teacher__dept=admin_dept)
        except Exception:
            pass
            
        return queryset

class DeactivatedAccountListView(generics.ListAPIView):
    """
    API endpoint that returns a list of deactivated users (TEACHER, SUPER_TEACHER).
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]
    serializer_class = UserDetailSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = CustomUser.objects.filter(is_approved=True, is_active=False, role__in=['TEACHER', 'SUPER_TEACHER'])
        
        try:
            admin_dept = user.teacher.dept
            if admin_dept:
                queryset = queryset.filter(teacher__dept=admin_dept)
        except Exception:
            pass
            
        return queryset

class DeleteAccountView(APIView):
    """
    API endpoint to deactivate an active user account.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]

    def delete(self, request, pk):
        user_to_deactivate = get_object_or_404(CustomUser, pk=pk, is_approved=True)
        
        # Verify department match if admin is department-scoped
        try:
            admin_dept = request.user.teacher.dept
            if admin_dept and hasattr(user_to_deactivate, 'teacher') and user_to_deactivate.teacher.dept != admin_dept:
                return Response({'error': 'You can only deactivate accounts in your department.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        # Deactivate the user instead of deleting
        user_to_deactivate.is_active = False
        user_to_deactivate.save()
        return Response({'message': 'Account deactivated successfully.'}, status=status.HTTP_200_OK)

class ReactivateAccountView(APIView):
    """
    API endpoint to reactivate a deactivated user account.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        user_to_reactivate = get_object_or_404(CustomUser, pk=pk, is_approved=True, is_active=False)
        
        # Verify department match if admin is department-scoped
        try:
            admin_dept = request.user.teacher.dept
            if admin_dept and hasattr(user_to_reactivate, 'teacher') and user_to_reactivate.teacher.dept != admin_dept:
                return Response({'error': 'You can only reactivate accounts in your department.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        user_to_reactivate.is_active = True
        user_to_reactivate.save()
        return Response({'message': 'Account reactivated successfully.'}, status=status.HTTP_200_OK)

class ToggleSuperTeacherView(APIView):
    """
    API endpoint to toggle the SUPER_TEACHER role for an active teacher account.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUserRole]

    def post(self, request, pk):
        user_to_toggle = get_object_or_404(CustomUser, pk=pk, is_approved=True, role__in=['TEACHER', 'SUPER_TEACHER'])
        
        # Verify department match if admin is department-scoped
        try:
            admin_dept = request.user.teacher.dept
            if admin_dept and hasattr(user_to_toggle, 'teacher') and user_to_toggle.teacher.dept != admin_dept:
                return Response({'error': 'You can only modify accounts in your department.'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass
            
        # Toggle role
        if user_to_toggle.role == 'TEACHER':
            user_to_toggle.role = 'SUPER_TEACHER'
            msg = 'Promoted to Super Teacher.'
        else:
            user_to_toggle.role = 'TEACHER'
            msg = 'Demoted to regular Teacher.'
            
        user_to_toggle.save()
        return Response({'message': msg, 'role': user_to_toggle.role}, status=status.HTTP_200_OK)