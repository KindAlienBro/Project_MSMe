// frontend/src/components/SignupForm.tsx
'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import Link from 'next/link';
import { Input } from './Input';
import { Department } from '@/types';
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle, GraduationCap, BookOpen } from 'lucide-react';

export default function SignupForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'STUDENT',
    designation: 'ASSISTANT_PROFESSOR',
    selectedDept: '',
    semester: '1',
    year: '1',
  });
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Department['subjects']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await api.get('/auth/departments/');
        setDepartments(response.data);
      } catch (err) {
        setError('Failed to load initial data. Please try again.');
      }
    };
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (formData.selectedDept) {
      const department = departments.find(d => d.id === parseInt(formData.selectedDept));
      setAvailableSubjects(department ? department.subjects : []);
    } else {
      setAvailableSubjects([]); // Clear subjects if no department is selected
    }
    setSelectedSubjects([]); // Always reset selected subjects when department changes
  }, [formData.selectedDept, departments]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubjectChange = (subjectId: number) => {
    setSelectedSubjects(prev => prev.includes(subjectId) ? prev.filter(id => id !== subjectId) : [...prev, subjectId]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const submissionData = new FormData();
    submissionData.append('email', formData.email);
    submissionData.append('password', formData.password);
    submissionData.append('first_name', formData.firstName);
    submissionData.append('last_name', formData.lastName);
    submissionData.append('role', formData.role);

    if (formData.role === 'TEACHER') {
      submissionData.append('dept', formData.selectedDept);
      submissionData.append('designation', formData.designation);
      selectedSubjects.forEach(id => submissionData.append('subjects_of_interest', id.toString()));
    }

    if (formData.role === 'STUDENT') {
      submissionData.append('dept', formData.selectedDept);
      submissionData.append('semester', formData.semester);
      submissionData.append('year', formData.year);
    }

    try {
      await api.post('/auth/register/', submissionData);
      if (formData.role === 'STUDENT') {
        setSuccess('Registration successful! You can now log in.');
      } else {
        setSuccess('Registration successful! Your account is pending admin approval.');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data;

        let message = 'An unexpected error occurred.';

        if (typeof data === 'string') {
          message = data;
        } else if (typeof data === 'object' && data !== null) {
          message = Object.entries(data)
            .map(([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(', ') : value}`
            )
            .join(' ');
        }

        setError(message);
      } else {
        setError('Something went wrong.');
      }
    }
    finally {
      setIsLoading(false);
    }
  };

  const selectStyle = "block w-full rounded-md border-gray-300 bg-[--color-input] py-3 px-3 shadow-sm focus:border-[--color-primary] focus:ring-[--color-primary] sm:text-sm";

  return (
    <div className="w-full max-w-lg mx-auto">
      <h2 className="text-3xl font-bold text-[--color-foreground]">Create Account</h2>
      <p className="mt-2 text-gray-600">Get started by filling out the information below.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="firstName" label="First Name" Icon={User} type="text" placeholder="John" name="firstName" value={formData.firstName} onChange={handleInputChange} required autoComplete="given-name" />
          <Input id="lastName" label="Last Name" Icon={User} type="text" placeholder="Doe" name="lastName" value={formData.lastName} onChange={handleInputChange} required autoComplete="family-name" />
        </div>
        <Input id="email" label="Email" Icon={Mail} type="email" placeholder="you@example.com" name="email" value={formData.email} onChange={handleInputChange} required autoComplete="email" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input id="password" label="Password" Icon={Lock} type="password" placeholder="••••••••" name="password" value={formData.password} onChange={handleInputChange} required autoComplete="new-password" />
          <Input id="confirmPassword" label="Confirm Password" Icon={Lock} type="password" placeholder="••••••••" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} required autoComplete="new-password" />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">Your Role</label>
          <select id="role" name="role" value={formData.role} onChange={handleInputChange} className={`mt-1 ${selectStyle}`}>
            <option value="STUDENT">Register as a Student</option>
            <option value="TEACHER">Register as a Teacher</option>
            <option value="ADMIN">Register as an Admin</option>
          </select>
        </div>

        {/* ========== STUDENT FIELDS ========== */}
        {formData.role === 'STUDENT' && (
          <div className="p-4 border border-blue-200 rounded-lg space-y-4 bg-blue-50/40">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Student Information</span>
            </div>

            <div>
              <label htmlFor="selectedDept" className="block text-sm font-medium text-gray-700">Department</label>
              <select id="selectedDept" name="selectedDept" value={formData.selectedDept} onChange={handleInputChange} required className={`mt-1 ${selectStyle}`}>
                <option value="">Select Department</option>
                {departments.map(d => (<option key={d.id} value={d.id}>{d.dept_name}</option>))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="semester" className="block text-sm font-medium text-gray-700">Semester</label>
                <select id="semester" name="semester" value={formData.semester} onChange={handleInputChange} required className={`mt-1 ${selectStyle}`}>
                  {[1,2,3,4,5,6,7,8].map(s => (<option key={s} value={s}>Semester {s}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year</label>
                <select id="year" name="year" value={formData.year} onChange={handleInputChange} required className={`mt-1 ${selectStyle}`}>
                  {[1,2,3,4].map(y => (<option key={y} value={y}>Year {y}</option>))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ========== TEACHER FIELDS ========== */}
        {formData.role === 'TEACHER' && (
          <div className="p-4 border border-gray-200 rounded-lg space-y-4 bg-slate-50/70">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-semibold text-gray-800">Teacher Information</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="designation" className="block text-sm font-medium text-gray-700">Designation</label>
                <select id="designation" name="designation" value={formData.designation} onChange={handleInputChange} className={`mt-1 ${selectStyle}`}>
                  <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
                  <option value="ASSOCIATE_PROFESSOR">Associate Professor</option>
                  <option value="PROFESSOR">Professor</option>
                </select>
              </div>
              <div>
                <label htmlFor="selectedDept" className="block text-sm font-medium text-gray-700">Department</label>
                <select id="selectedDept" name="selectedDept" value={formData.selectedDept} onChange={handleInputChange} required className={`mt-1 ${selectStyle}`}>
                  <option value="">Select Department</option>
                  {departments.map(d => (<option key={d.id} value={d.id}>{d.dept_name}</option>))}
                </select>
              </div>
            </div>

            {/* --- THIS IS THE MISSING BLOCK THAT IS NOW ADDED --- */}
            {availableSubjects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Area of Interest</label>
                <div className="mt-2 grid grid-cols-2 gap-2 p-3 bg-white rounded-md border max-h-32 overflow-y-auto">
                  {availableSubjects.map(s => (
                    <label key={s.id} className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSubjects.includes(s.id)}
                        onChange={() => handleSubjectChange(s.id)}
                        className="h-4 w-4 rounded border-gray-300 text-[--color-primary] focus:ring-[--color-primary]"
                      />
                      <span className="text-sm text-gray-700">{s.subject_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* --- END OF THE MISSING BLOCK --- */}

          </div>
        )}

        {error && (
          <div className="flex items-center gap-x-3 p-3 text-sm text-[--color-destructive] bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-5 w-5" /> <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-x-3 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
            <CheckCircle className="h-5 w-5" /> <p>{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="
                    w-full flex items-center justify-center gap-2
                    py-3 px-4 rounded-xl
                    bg-gradient-to-r from-indigo-600 to-purple-600
                    hover:from-indigo-500 hover:to-purple-500
                    text-white font-semibold tracking-wide
                    shadow-lg hover:shadow-xl
                    transition-all duration-300
                    disabled:opacity-60 disabled:cursor-not-allowed
                    active:scale-[0.98]
                  "
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin w-5 h-5" />
              Creating...
            </>
          ) : (
            "Create Account"
          )}
        </button>


        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[--color-primary] hover:underline">
            Sign in instead
          </Link>
        </p>
      </form>
    </div>
  );
}