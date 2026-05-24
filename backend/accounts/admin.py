# backend/accounts/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Department, Subject, Teacher, Student

# We create a custom admin class to display our custom user fields
class CustomUserAdmin(UserAdmin):
    # This is the configuration for the list view of users
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_staff', 'is_approved')
    search_fields = ('email', 'first_name', 'last_name')
    list_filter = ('role', 'is_staff', 'is_approved')
    
    # This is the configuration for the detailed edit view of a user
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'role', 'profile_photo')}),
        ('Permissions', {'fields': ('is_active', 'is_approved', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    # The 'add_fieldsets' is used for the user creation form in the admin
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password', 'first_name', 'last_name', 'role', 'is_approved'),
        }),
    )
    ordering = ('email',)

# Register your models here so they appear in the admin panel
admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Department)
admin.site.register(Subject)
admin.site.register(Teacher)
admin.site.register(Student)