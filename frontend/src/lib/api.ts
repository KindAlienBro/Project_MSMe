import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If the error is 401 and we haven't tried to refresh the token yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_BASE}/token/refresh/`, {
                        refresh: refreshToken,
                    });

                    const newAccessToken = response.data.access;
                    localStorage.setItem('access_token', newAccessToken);

                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // If refresh fails, redirect to login
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            } else {
                // No refresh token, redirect to login
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const endpoints = {
    notifications: {
        list: () => api.get('/dashboard/notifications/'),
        markRead: (id: number) => api.post(`/dashboard/notifications/${id}/read/`),
        markAllRead: () => api.post(`/dashboard/notifications/mark-all-read/`),
        delete: (id: number) => api.delete(`/dashboard/notifications/${id}/`),
    },

    auth: {
        login: (data: any) => api.post('/token/', data),
        register: (data: any) => api.post('/auth/register/', data),
        refreshToken: (data: any) => api.post('/token/refresh/', data),
        me: () => api.get('/auth/me/'),
    },

    approvals: {
        list: () => api.get('/auth/approvals/'),
        approve: (id: number) => api.post(`/auth/approvals/${id}/approve/`),
        reject: (id: number) => api.post(`/auth/approvals/${id}/reject/`),
        activeList: () => api.get('/auth/active/'),
        deactivatedList: () => api.get('/auth/deactivated/'),
        delete: (id: number) => api.delete(`/auth/${id}/delete/`),
        reactivate: (id: number) => api.post(`/auth/${id}/reactivate/`),
        toggleSuperTeacher: (id: number) => api.post(`/auth/${id}/toggle-super-teacher/`),
    },

    stats: () => api.get('/dashboard/stats/'),
    resourceVisualization: () => api.get('/dashboard/resource-visualization/'),
    syncTimetable: (data: any) => api.post('/dashboard/timetable/sync/', data),

    student: {
        timetable: () => api.get('/dashboard/student/timetable/'),
        notifications: () => api.get('/dashboard/student/notifications/'),
    },

    timetableChange: {
        notify: (data: { message: string; notification_type?: string }) =>
            api.post('/dashboard/notify-timetable-change/', data),
    },

    attendance: {
        getStudentsForClass: (section: string) =>
            api.get(`/dashboard/attendance/students/?section=${encodeURIComponent(section)}`),
        submit: (data: {
            subject_code: string; subject_name: string; section: string;
            faculty_name: string; date: string; period_index: number;
            time_slot: string; records: { student_id: number; status: 'P' | 'A' }[];
        }) => api.post('/dashboard/attendance/submit/', data),
        getStatus: (params: { subject_code: string; section: string; date: string; period_index: number }) =>
            api.get(`/dashboard/attendance/status/?subject_code=${encodeURIComponent(params.subject_code)}&section=${encodeURIComponent(params.section)}&date=${params.date}&period_index=${params.period_index}`),
        getMyAttendance: () => api.get('/dashboard/attendance/my/'),
        getHistory: () => api.get('/dashboard/attendance/history/'),
    },
};

export default api;
