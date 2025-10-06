import React from 'react';
import {
  List, ListItem, ListItemText, IconButton, Paper, Typography, Box, Chip
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';

const statusColors = {
  pending: 'warning',
  'in-progress': 'info',
  completed: 'success',
};

const TaskList = ({ tasks, onEdit, onDelete }) => {
  if (tasks.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 3, textAlign: 'center', mt: 2 }}>
        <Typography variant="body1">No tasks yet. Add one to get started!</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ mt: 2 }}>
      <List>
        {tasks.map((task) => (
          <ListItem
            key={task._id}
            divider
            secondaryAction={
              <Box>
                <IconButton edge="end" aria-label="edit" onClick={() => onEdit(task)}>
                  <Edit />
                </IconButton>
                <IconButton edge="end" aria-label="delete" onClick={() => onDelete(task._id)} sx={{ ml: 1 }}>
                  <Delete />
                </IconButton>
              </Box>
            }
          >
            <ListItemText
              primary={<Typography variant="h6">{task.title}</Typography>}
              secondary={
                <>
                  {task.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{task.description}</Typography>}
                  <Chip label={task.status} color={statusColors[task.status] || 'default'} size="small" />
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default TaskList;
