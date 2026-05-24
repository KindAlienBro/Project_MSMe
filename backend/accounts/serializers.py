# backend/accounts/serializers.py

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed
from .models import CustomUser, Teacher, Student, Department, Subject

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_approved:
            raise AuthenticationFailed('Your account is pending approval by an administrator.', code='account_unapproved')
        return data


class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ['id', 'subject_name', 'subject_code']

class DepartmentSerializer(serializers.ModelSerializer):
    # This nested serializer will show all subjects related to a department
    subjects = SubjectSerializer(many=True, read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'dept_name', 'subjects']

# This serializer is specifically for creating a new user (Teacher, Admin, or Student)
class UserRegistrationSerializer(serializers.ModelSerializer):
    # We include fields from the Teacher model directly here.
    # 'write_only=True' means these fields are used for creation but not shown in API responses.
    dept = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True
    )
    designation = serializers.ChoiceField(
        choices=Teacher.Designation.choices, required=False
    )
    subjects_of_interest = serializers.PrimaryKeyRelatedField(
        queryset=Subject.objects.all(), many=True, required=False
    )
    # The password is write-only for security
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    # Student-specific fields
    semester = serializers.IntegerField(required=False, min_value=1, max_value=8)
    year = serializers.IntegerField(required=False, min_value=1, max_value=4)

    class Meta:
        model = CustomUser
        fields = [
            'email', 'password', 'first_name', 'last_name', 'role', 'profile_photo',
            # Fields for the Teacher profile
            'dept', 'designation', 'subjects_of_interest',
            # Fields for the Student profile
            'semester', 'year',
        ]

    def validate(self, attrs):
        # Custom validation based on role
        role = attrs.get('role')
        if role == CustomUser.Role.TEACHER:
            if not attrs.get('dept'):
                raise serializers.ValidationError({"dept": "Department is required for teachers."})
            if not attrs.get('designation'):
                raise serializers.ValidationError({"designation": "Designation is required for teachers."})
        elif role == CustomUser.Role.STUDENT:
            if not attrs.get('dept'):
                raise serializers.ValidationError({"dept": "Department is required for students."})
            if not attrs.get('semester'):
                raise serializers.ValidationError({"semester": "Semester is required for students."})
            if not attrs.get('year'):
                raise serializers.ValidationError({"year": "Year is required for students."})
        return attrs

    def create(self, validated_data):
        # Separate the CustomUser data from the profile data
        role = validated_data.get('role')
        
        teacher_data = {
            'dept': validated_data.pop('dept', None),
            'designation': validated_data.pop('designation', None),
        }
        subjects = validated_data.pop('subjects_of_interest', [])

        # Student-specific data
        student_data = {
            'semester': validated_data.pop('semester', None),
            'year': validated_data.pop('year', None),
        }

        # Create the CustomUser instance
        user = CustomUser.objects.create_user(**validated_data)

        # If the role is Teacher, create the associated Teacher profile
        if role == CustomUser.Role.TEACHER:
            teacher_profile = Teacher.objects.create(user=user, **teacher_data)
            teacher_profile.subjects_of_interest.set(subjects)
        elif role == CustomUser.Role.STUDENT:
            # Students are auto-approved so they can log in immediately
            user.is_approved = True
            user.save()
            Student.objects.create(
                user=user,
                dept=teacher_data['dept'],  # dept was popped into teacher_data
                semester=student_data['semester'],
                year=student_data['year'],
            )

        return user

class TeacherProfileSerializer(serializers.ModelSerializer):
    dept_name = serializers.CharField(source='dept.dept_name', read_only=True)

    class Meta:
        model = Teacher
        fields = ['dept_name', 'designation', 'phone']

class StudentProfileSerializer(serializers.ModelSerializer):
    dept_name = serializers.CharField(source='dept.dept_name', read_only=True)

    class Meta:
        model = Student
        fields = ['dept_name', 'semester', 'year', 'register_number', 'section']

class UserDetailSerializer(serializers.ModelSerializer):
    teacher_profile = TeacherProfileSerializer(source='teacher', read_only=True)
    student_profile = StudentProfileSerializer(source='student', read_only=True)

    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'profile_photo', 'teacher_profile', 'student_profile']