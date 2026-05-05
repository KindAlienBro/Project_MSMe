# constants.py

NUM_WORKING_DAYS = 5
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# 8 Teaching slots per day
NUM_TEACHING_SLOTS_PER_DAY = 8
TOTAL_TEACHING_SLOTS_PER_WEEK = NUM_TEACHING_SLOTS_PER_DAY * NUM_WORKING_DAYS

# INDICES (0-based) AFTER WHICH BREAKS OCCUR
# P1(0), P2(1) -> BREAK -> P3(2), P4(3) -> LUNCH -> P5(4)...
BREAK_AFTER_INDEX = 1
LUNCH_AFTER_INDEX = 3

# Valid Lab Start Indices (Computed to ensure labs don't cross breaks)
ALLOWED_LAB_START_INDICES = [0, 2, 4, 5, 6]

# Column Headers for Streamlit to match the reference image
TIMETABLE_HEADERS = [
    "8:45-9:40",      # P1
    "9:40-10:35",     # P2
    "10:35-10:50",    # BREAK
    "10:50-11:45",    # P3
    "11:45-12:40",    # P4
    "12:40-1:40",     # LUNCH
    "1:40-2:35",      # P5
    "2:35-3:30",      # P6
    "3:30-4:25",      # P7
    "4:25-5:20"       # P8
]