import React, { useState, useEffect } from 'react';
import { Button, TextField, Box, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

const TaskForm = ({ onSubmit, taskToEdit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setStatus(taskToEdit.status);
    } else {
      setTitle('');
      setDescription('');
      setStatus('pending');
    }
  }, [taskToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title) {
      alert('Title is required');
      return;
    }
    onSubmit({ title, description, status });
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 4, p: 2, border: '1px solid #ccc', borderRadius: '8px' }}>
      <TextField
        fullWidth
        label="Task Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        margin="normal"
        variant="outlined"
        required
      />
      <TextField
        fullWidth
        label="Task Description (Optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        margin="normal"
        variant="outlined"
        multiline
        rows={3}
      />
      <FormControl fullWidth margin="normal">
        <InputLabel>Status</InputLabel>
        <Select
          value={status}
          label="Status"
          onChange={(e) => setStatus(e.target.value)}
        >
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="in-progress">In Progress</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
        </Select>
      </FormControl>
      <Button type="submit" variant="contained" color="primary" sx={{ mt: 1 }}>
        {taskToEdit ? 'Update Task' : 'Add Task'}
      </Button>
    </Box>
  );
};

export default TaskForm;
