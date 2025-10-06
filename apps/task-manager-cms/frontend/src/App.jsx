import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Typography, Box, TextField, Button, 
  Table, TableBody, TableCell, TableHead, TableRow, Paper 
} from '@mui/material';

function App() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ name: '', description: '', command: '' });

  useEffect(() => {
    // Fetch tasks from the backend when the component mounts
    const fetchTasks = async () => {
      try {
        const response = await axios.get('/api/tasks');
        if (response.data.success) {
          setTasks(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
      }
    };

    fetchTasks();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTask(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateTask = async () => {
    if (!newTask.name || !newTask.command) {
      alert('Task Name and Command are required.');
      return;
    }
    try {
      const response = await axios.post('/api/tasks', newTask);
      if (response.data.success) {
        setTasks(prevTasks => [response.data.data, ...prevTasks]);
        setNewTask({ name: '', description: '', command: '' }); // Reset form
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task.');
    }
  };

  const handleRunTask = async (taskId) => {
    try {
      // Optimistically update status to running
      setTasks(tasks.map(t => t._id === taskId ? { ...t, status: 'running' } : t));
      const response = await axios.post(`/api/tasks/${taskId}/run`);
      if (response.data.success) {
        // Update task with final status from backend
        setTasks(tasks.map(t => t._id === taskId ? response.data.data : t));
      }
    } catch (error) {
      console.error('Error running task:', error);
      alert('Failed to run task.');
      // Revert status on error
      setTasks(tasks.map(t => t._id === taskId ? { ...t, status: 'error' } : t));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await axios.delete(`/api/tasks/${taskId}`);
        setTasks(tasks.filter(t => t._id !== taskId));
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task.');
      }
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Task Manager CMS
        </Typography>
        
        {/* Form to Create New Task */}
        <Paper sx={{ p: 2, mb: 4 }}>
          <Typography variant="h6">Create New Task</Typography>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Task Name"
              name="name"
              value={newTask.name}
              onChange={handleInputChange}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={newTask.description}
              onChange={handleInputChange}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Command"
              name="command"
              value={newTask.command}
              onChange={handleInputChange}
              margin="normal"
            />
            <Button variant="contained" color="primary" onClick={handleCreateTask}>
              Create Task
            </Button>
          </Box>
        </Paper>

        {/* Table of Existing Tasks */}
        <Typography variant="h6">Managed Tasks</Typography>
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Command</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task._id}>
                  <TableCell>{task.name}</TableCell>
                  <TableCell>{task.description}</TableCell>
                  <TableCell><code>{task.command}</code></TableCell>
                  <TableCell>{task.status}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleRunTask(task._id)} disabled={task.status === 'running'}>Run</Button>
                    <Button size="small" color="error" onClick={() => handleDeleteTask(task._id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </Body>
          </Table>
        </Paper>
      </Box>
    </Container>
  );
}

export default App;
