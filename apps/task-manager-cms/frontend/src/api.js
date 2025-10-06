import axios from 'axios';

// For local development, Vercel CLI typically runs the backend on a different port.
// You might need to adjust this URL based on the port your backend is running on.
// When deployed, you should set a production API URL via environment variables.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
});

export const getTasks = () => api.get('/tasks');
export const createTask = (task) => api.post('/tasks', task);
export const updateTask = (id, task) => api.put(`/tasks/${id}`, task);
export const deleteTask = (id) => api.delete(`/tasks/${id}`);

export default api;
