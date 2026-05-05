-- =============================================
-- DATABASE SCHEMA CREATION SCRIPT
-- =============================================

-- =============================================
-- 1. ENUM TYPE DEFINITIONS
-- =============================================

CREATE TYPE subject_type AS ENUM ('Theory', 'Lab');
CREATE TYPE room_type AS ENUM ('Classroom', 'Lab');
CREATE TYPE day_of_week_enum AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE');
CREATE TYPE attendance_source AS ENUM ('FINGERPRINT', 'LEAVE', 'MANUAL');
CREATE TYPE leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE notification_type AS ENUM ('INFO', 'ATTENDANCE', 'REALLOCATION');
CREATE TYPE user_role AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');


-- =============================================
-- 2. CORE MASTER DATA TABLES
-- =============================================

-- 1. Department Table
CREATE TABLE Department (
    dept_id SERIAL PRIMARY KEY,
    dept_name VARCHAR(50) UNIQUE NOT NULL
);

-- 2. Teacher Table
CREATE TABLE Teacher (
    teacher_id SERIAL PRIMARY KEY,
    dept_id INT REFERENCES Department(dept_id),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    biometric_id VARCHAR(50) UNIQUE,
    max_load_per_week INT DEFAULT 20,
    designation VARCHAR(50)
);

-- 3. Section Table
CREATE TABLE Section (
    section_id SERIAL PRIMARY KEY,
    dept_id INT NOT NULL REFERENCES Department(dept_id) ON DELETE CASCADE,
    section_name VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    semester INT NOT NULL,
    total_students INT
);

-- 4. Student Table
CREATE TABLE Student (
    student_id SERIAL PRIMARY KEY,
    section_id INT REFERENCES Section(section_id),
    name VARCHAR(100) NOT NULL,
    register_no VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

-- 5. Subject Table
CREATE TABLE Subject (
    subject_id SERIAL PRIMARY KEY,
    dept_id INT REFERENCES Department(dept_id),
    subject_name VARCHAR(100) UNIQUE NOT NULL,
    subject_code VARCHAR(20) UNIQUE NOT NULL,
    credit_hours INT NOT NULL,
    type subject_type NOT NULL
);

-- 6. Teacher_Subject_Map Table (Many-to-Many)
CREATE TABLE Teacher_Subject_Map (
    ts_id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES Teacher(teacher_id),
    subject_id INT NOT NULL REFERENCES Subject(subject_id)
);

-- 7. Rooms / Labs Table
CREATE TABLE Rooms (
    room_id SERIAL PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    dept_id INT REFERENCES Department(dept_id), -- Nullable for shared rooms
    room_type room_type NOT NULL,
    capacity INT NOT NULL
);


-- =============================================
-- 3. TIMETABLE & SCHEDULING TABLES
-- =============================================

-- 1. Static_Timetable
CREATE TABLE Static_Timetable (
    static_tt_id SERIAL PRIMARY KEY,
    day_of_week day_of_week_enum NOT NULL,
    period_no INT NOT NULL,
    section_id INT NOT NULL REFERENCES Section(section_id),
    subject_id INT NOT NULL REFERENCES Subject(subject_id),
    teacher_id INT NOT NULL REFERENCES Teacher(teacher_id),
    room_id INT NOT NULL REFERENCES Rooms(room_id),
    -- A section can only have one class at a given time slot
    UNIQUE (day_of_week, period_no, section_id)
);

-- 2. Daily_Timetable
CREATE TABLE Daily_Timetable (
    daily_tt_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    period_no INT NOT NULL,
    section_id INT REFERENCES Section(section_id),
    subject_id INT REFERENCES Subject(subject_id),
    teacher_id INT REFERENCES Teacher(teacher_id),
    room_id INT REFERENCES Rooms(room_id),
    is_changed_from_static BOOLEAN DEFAULT FALSE,
    reason VARCHAR(255) -- e.g., "Teacher Absent"
);


-- =============================================
-- 4. ATTENDANCE & LEAVE TABLES
-- =============================================

-- 1. Teacher_Attendance
CREATE TABLE Teacher_Attendance (
    attendance_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    teacher_id INT NOT NULL REFERENCES Teacher(teacher_id),
    status attendance_status NOT NULL,
    "timestamp" TIMESTAMP NOT NULL,
    source attendance_source NOT NULL,
    UNIQUE (date, teacher_id)
);

-- 2. Teacher_Leave
CREATE TABLE Teacher_Leave (
    leave_id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES Teacher(teacher_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status leave_status DEFAULT 'PENDING',
    reason VARCHAR(200)
);


-- =============================================
-- 5. AUTHENTICATION, MESSAGING & LOGS
-- =============================================

-- 1. Users Table (Created before tables it references, FKs added later)
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    role user_role NOT NULL,
    linked_teacher_id INT UNIQUE, -- Nullable
    linked_student_id INT UNIQUE  -- Nullable
);

-- Add Foreign Key constraints to Users table
ALTER TABLE Users ADD CONSTRAINT fk_linked_teacher FOREIGN KEY (linked_teacher_id) REFERENCES Teacher(teacher_id);
ALTER TABLE Users ADD CONSTRAINT fk_linked_student FOREIGN KEY (linked_student_id) REFERENCES Student(student_id);

-- 2. Notification Table
CREATE TABLE Notification (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES Users(user_id),
    message VARCHAR(255) NOT NULL,
    type notification_type NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE
);

-- 3. System_Log Table
CREATE TABLE System_Log (
    log_id SERIAL PRIMARY KEY,
    action VARCHAR(100),
    performed_by VARCHAR(50), -- e.g., 'admin' or 'system'
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =============================================
-- 6. INDEXES FOR PERFORMANCE
-- =============================================

-- Speeds up timetable queries by department and semester
CREATE INDEX idx_section_dept_semester ON Section(dept_id, semester);

-- Ensures a teacher is mapped to a subject only once
CREATE UNIQUE INDEX idx_teacher_subject_map_unique ON Teacher_Subject_Map(teacher_id, subject_id);

-- Speeds up queries for a specific day's timetable
CREATE INDEX idx_daily_timetable_date_section_period ON Daily_Timetable(date, section_id, period_no);

-- =============================================
-- END OF SCRIPT
-- =============================================