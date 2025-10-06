import React, { useState, useEffect } from 'react';
import {
  Container, Typography, CircularProgress, Alert, Box, CssBaseline, AppBar, Toolbar
} from '@mui/material';
import { getTasks, createTask, updateTask, deleteTask } from './api';
import TaskList from './components/TaskList';
import TaskForm from './components/TaskForm';

function App() {
  const [tasks, setTasks] = useState([]);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await getTasks();
      setTasks(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch tasks. Make sure the backend server is running and the API URL is correct.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (taskData) => {
    try {
      let updatedTask;
      if (taskToEdit) {
        const response = await updateTask(taskToEdit._id, taskData);
        updatedTask = response.data;
        setTasks(tasks.map(t => t._id === taskToEdit._id ? updatedTask : t));
      } else {
        const response = await createTask(taskData);
        updatedTask = response.data;
        setTasks([updatedTask, ...tasks]);
      }
      setTaskToEdit(null); // Reset form
    } catch (err) {
      setError('Failed to save task.');
      console.error(err);
    }
  };

  const handleEdit = (task) => {
    setTaskToEdit(task);
  };

  const handleDelete = async (id) => {
    try {
      await deleteTask(id);
      setTasks(tasks.filter(t => t._id !== id));
    } catch (err) {
      setError('Failed to delete task.');
      console.error(err);
    }
  };

  return (
    <>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div">
            Task Manager CMS
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {taskToEdit ? 'Edit Task' : 'Create a New Task'}
          </Typography>
          
          <TaskForm onSubmit={handleFormSubmit} taskToEdit={taskToEdit} />

          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>}
          {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
          
          {!loading && !error && (
            <TaskList tasks={tasks} onEdit={handleEdit} onDelete={handleDelete} />
          )}
        </Box>
      </Container>
    </>
  );
}

export default App;