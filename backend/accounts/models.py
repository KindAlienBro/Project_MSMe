# backend/accounts/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.conf import settings


# ===================================================================
# CUSTOM USER MANAGER
# This manager is necessary for our custom user model to handle
# user creation correctly, especially for 'createsuperuser'.
# ===================================================================
class CustomUserManager(BaseUserManager):
    """
    Custom user model manager where email is the unique identifier
    for authentication instead of usernames.
    """
    def create_user(self, email, password=None, **extra_fields):
        """
        Create and save a User with the given email and password.
        """
        if not email:
            raise ValueError('The Email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create and save a SuperUser with the given email and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_approved', True) # Superusers are approved by default

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        # The 'role' must be set for a superuser. We default it to ADMIN.
        extra_fields.setdefault('role', 'ADMIN')

        return self.create_user(email, password, **extra_fields)


# ===================================================================
# AUTHENTICATION MODEL (CustomUser)
# This is our main user model, replacing Django's default User.
# ===================================================================
class CustomUser(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        SUPER_TEACHER = "SUPER_TEACHER", "Super Teacher"
        TEACHER = "TEACHER", "Teacher"
        STUDENT = "STUDENT", "Student"

    # We disable the default username and use email as the unique identifier.
    username = None
    email = models.EmailField(unique=True)
    
    role = models.CharField(max_length=50, choices=Role.choices)
    profile_photo = models.ImageField(upload_to='profile_photos/', null=True, blank=True)
    is_approved = models.BooleanField(default=False)

    # Set the email field as the username field
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name', 'role']

    # Link our custom manager to this model
    objects = CustomUserManager()

    def __str__(self):
        return self.email


# ===================================================================
# CORE MASTER DATA MODELS
# These models represent the core data of the application.
# ===================================================================

class Department(models.Model):
    """ Represents an academic department, e.g., CSE, ISE. """
    dept_name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.dept_name

class Subject(models.Model):
    """ Represents a subject or course. """
    class SubjectType(models.TextChoices):
        THEORY = "THEORY", "Theory"
        LAB = "LAB", "Lab"

    dept = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='subjects')
    subject_name = models.CharField(max_length=100)
    subject_code = models.CharField(max_length=20, unique=True)
    credit_hours = models.IntegerField()
    type = models.CharField(max_length=10, choices=SubjectType.choices)

    def __str__(self):
        return f"{self.subject_name} ({self.subject_code})"

class Teacher(models.Model):
    """
    Acts as a 'profile' for a user with the Teacher role,
    storing teacher-specific information.
    """
    class Designation(models.TextChoices):
        ASSISTANT_PROFESSOR = "ASSISTANT_PROFESSOR", "Assistant Professor"
        ASSOCIATE_PROFESSOR = "ASSOCIATE_PROFESSOR", "Associate Professor"
        PROFESSOR = "PROFESSOR", "Professor"

    # A OneToOneField ensures that each user can only have one teacher profile.
    # 'primary_key=True' makes this link the primary key for the Teacher table.
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True)
    
    dept = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    phone = models.CharField(max_length=15, null=True, blank=True)
    biometric_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    max_load_per_week = models.IntegerField(default=20)
    designation = models.CharField(max_length=50, choices=Designation.choices)
    
    # Django will automatically create the many-to-many join table for this.
    subjects_of_interest = models.ManyToManyField(Subject, blank=True)

    def __str__(self):
        # Get the full name from the linked CustomUser model.
        return self.user.get_full_name()


class Student(models.Model):
    """
    Acts as a 'profile' for a user with the Student role,
    storing student-specific information.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name='student')
    dept = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    semester = models.IntegerField(default=1)  # 1-8
    year = models.IntegerField(default=1)      # 1-4
    register_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    # e.g. "CSE-3A" — matches section IDs used in the timetable generator
    section = models.CharField(max_length=20, null=True, blank=True)

    def __str__(self):
        return f"{self.user.get_full_name()} (Sem {self.semester}, {self.section or 'No Section'})"