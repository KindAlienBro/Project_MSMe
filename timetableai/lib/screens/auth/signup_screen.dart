import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/auth_service.dart';
import '../../models/department.dart';
import '../../widgets/gradient_button.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _authService = AuthService();
  
  bool _isLoadingDeps = true;
  List<Department> _departments = [];

  // Common fields
  String _firstName = '';
  String _lastName = '';
  String _email = '';
  String _password = '';
  String _role = 'STUDENT';

  // Student specific
  int? _selectedDept;
  int _semester = 1;
  int _year = 1;
  String _registerNumber = '';

  // Teacher specific
  String _designation = 'ASSISTANT_PROFESSOR';
  String _phone = '';

  @override
  void initState() {
    super.initState();
    _fetchDepartments();
  }

  Future<void> _fetchDepartments() async {
    try {
      final deps = await _authService.getDepartments();
      setState(() {
        _departments = deps;
        if (deps.isNotEmpty) _selectedDept = deps.first.id;
        _isLoadingDeps = false;
      });
    } catch (e) {
      setState(() => _isLoadingDeps = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to load departments')),
        );
      }
    }
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    final data = <String, dynamic>{
      'first_name': _firstName,
      'last_name': _lastName,
      'email': _email,
      'password': _password,
      'role': _role,
    };

    if (_role == 'STUDENT') {
      data['dept_id'] = _selectedDept;
      data['semester'] = _semester;
      data['year'] = _year;
      data['register_number'] = _registerNumber;
    } else if (_role == 'TEACHER') {
      data['dept_id'] = _selectedDept;
      data['designation'] = _designation;
      data['phone'] = _phone;
      data['max_load_per_week'] = 20; // Default
    }

    final authProvider = context.read<AuthProvider>();
    final success = await authProvider.register(data);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Registration successful. Please wait for admin approval (if teacher) or login.'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context); // Go back to login
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authProvider.error ?? 'Registration failed'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: _isLoadingDeps
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            decoration: const InputDecoration(labelText: 'First Name'),
                            validator: (v) => v!.isEmpty ? 'Required' : null,
                            onSaved: (v) => _firstName = v!,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: TextFormField(
                            decoration: const InputDecoration(labelText: 'Last Name'),
                            validator: (v) => v!.isEmpty ? 'Required' : null,
                            onSaved: (v) => _lastName = v!,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress,
                      validator: (v) => v!.isEmpty || !v.contains('@') ? 'Valid email required' : null,
                      onSaved: (v) => _email = v!,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      decoration: const InputDecoration(labelText: 'Password'),
                      obscureText: true,
                      validator: (v) => v!.length < 6 ? 'Min 6 characters' : null,
                      onSaved: (v) => _password = v!,
                    ),
                    const SizedBox(height: 24),
                    DropdownButtonFormField<String>(
                      value: _role,
                      decoration: const InputDecoration(labelText: 'Role'),
                      items: const [
                        DropdownMenuItem(value: 'STUDENT', child: Text('Student')),
                        DropdownMenuItem(value: 'TEACHER', child: Text('Teacher')),
                        DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
                      ],
                      onChanged: (val) {
                        setState(() => _role = val!);
                      },
                    ),
                    const SizedBox(height: 24),

                    if (_role == 'STUDENT' || _role == 'TEACHER') ...[
                      const Divider(),
                      const SizedBox(height: 16),
                      Text(
                        '${_role == 'STUDENT' ? 'Student' : 'Teacher'} Information',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<int>(
                        value: _selectedDept,
                        decoration: const InputDecoration(labelText: 'Department'),
                        items: _departments.map((d) {
                          return DropdownMenuItem(value: d.id, child: Text(d.deptName));
                        }).toList(),
                        onChanged: (val) => setState(() => _selectedDept = val),
                        validator: (v) => v == null ? 'Required' : null,
                      ),
                      const SizedBox(height: 16),
                    ],

                    if (_role == 'STUDENT') ...[
                      Row(
                        children: [
                          Expanded(
                            child: DropdownButtonFormField<int>(
                              value: _semester,
                              decoration: const InputDecoration(labelText: 'Semester'),
                              items: List.generate(8, (i) => DropdownMenuItem(value: i + 1, child: Text('${i + 1}'))),
                              onChanged: (v) => setState(() => _semester = v!),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: DropdownButtonFormField<int>(
                              value: _year,
                              decoration: const InputDecoration(labelText: 'Year'),
                              items: List.generate(4, (i) => DropdownMenuItem(value: i + 1, child: Text('${i + 1}'))),
                              onChanged: (v) => setState(() => _year = v!),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        decoration: const InputDecoration(labelText: 'Register Number'),
                        onSaved: (v) => _registerNumber = v!,
                      ),
                    ],

                    if (_role == 'TEACHER') ...[
                      DropdownButtonFormField<String>(
                        value: _designation,
                        decoration: const InputDecoration(labelText: 'Designation'),
                        items: const [
                          DropdownMenuItem(value: 'ASSISTANT_PROFESSOR', child: Text('Assistant Professor')),
                          DropdownMenuItem(value: 'ASSOCIATE_PROFESSOR', child: Text('Associate Professor')),
                          DropdownMenuItem(value: 'PROFESSOR', child: Text('Professor')),
                        ],
                        onChanged: (v) => setState(() => _designation = v!),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        decoration: const InputDecoration(labelText: 'Phone Number (Optional)'),
                        keyboardType: TextInputType.phone,
                        onSaved: (v) => _phone = v ?? '',
                      ),
                    ],

                    const SizedBox(height: 32),
                    GradientButton(
                      text: 'Create Account',
                      isLoading: authProvider.loading,
                      onPressed: _submit,
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
